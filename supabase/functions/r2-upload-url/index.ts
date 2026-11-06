// F7-22 Fase 7a: Edge Function para generar URL firmada de upload
//
// Flujo:
// 1. Frontend solicita URL firmada para subir archivo
// 2. Edge Function valida: sesión, clínica, RBAC, paciente
// 3. Genera r2_object_key único
// 4. Guarda metadata en archivos_clinicos (estado: activo)
// 5. Genera URL firmada S3 (PUT, expiración 15 min)
// 6. Registra en audit_log: "upload_initiated"
//
// Input (JSON body):
// {
//   "paciente_id": "uuid",
//   "categoria": "radiografia" | "foto_intraoral" | "foto_clinica" | "pdf" | "documento" | "otro" | "laboratorio",
//   "nombre_archivo": "radiografia_panoramica.jpg",
//   "mime_type": "image/jpeg",
//   "tamano_bytes": 5242880,
//   "orden_laboratorio_id": "uuid", "tipo_documento": "foto_diseno"
// }
//
// Output (JSON):
// {
//   "archivo_id": "uuid",
//   "r2_object_key": "clinica_id/paciente_id/categoria/uuid-nombre.ext",
//   "upload_url": "https://bucket.r2.cloudflarestorage.com/...",
//   "expires_in": 900
// }

import { safeError, safeInternalError, jsonResponse } from "../_shared/safeResponse.ts"
import { validarFormatoArchivo, CategoriaArchivo } from "./validarFormatoArchivo.ts";

// ============================================================
// HELPERS: AWS v4 Signature (Web Crypto API)
// ============================================================

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return toHex(hash);
}

async function hmacSha256(
  key: ArrayBuffer | Uint8Array,
  data: string
): Promise<ArrayBuffer> {
  // F7-34 FIX: Cast explicito para resolver TS2769 (deuda tecnica F7-22)
  const keyData = key instanceof Uint8Array ? key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

async function getSignatureKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  // F7-34 FIX: encoder.encode retorna Uint8Array, cast a ArrayBuffer (TS2345)
  let k = await hmacSha256(encoder.encode("AWS4" + secret) as unknown as ArrayBuffer, dateStamp);
  k = await hmacSha256(k as ArrayBuffer, region);
  k = await hmacSha256(k as ArrayBuffer, service);
  k = await hmacSha256(k as ArrayBuffer, "aws4_request");
  return k;
}

function getAmzDate(): { amzDate: string; dateStamp: string } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

// F7-35 post-audit fix: exportar handler para permitir tests unitarios (TS2305)
export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 1. Validar JWT de Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
    }

    const jwt = authHeader.split(" ")[1];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar JWT con Supabase
    const { data: userData, error: authError } = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: supabaseServiceKey,
        },
      }
    ).then(async (res) => {
      if (!res.ok) {
        return { data: null, error: await res.text() };
      }
      return { data: await res.json(), error: null };
    });

    if (authError || !userData) {
      return safeError(req, "INVALID_JWT", authError, 401, "[r2-upload-url]");
    }

    const userId = userData.id;

    // 2. Parsear body
    const body = await req.json();
    const {
      paciente_id,
      categoria,
      nombre_archivo,
      mime_type,
      tamano_bytes,
      orden_laboratorio_id,
      tipo_documento,
    } = body;

    // 3. Validar inputs
    if (!paciente_id || !categoria || !nombre_archivo || !mime_type || !tamano_bytes) {
      return jsonResponse(
        { error: "Missing required fields: paciente_id, categoria, nombre_archivo, mime_type, tamano_bytes" },
        400
      );
    }

    const validCategorias = ["radiografia", "foto_intraoral", "foto_clinica", "pdf", "documento", "otro", "laboratorio"];
    if (!validCategorias.includes(categoria)) {
      return jsonResponse({ error: `Invalid categoria. Must be one of: ${validCategorias.join(", ")}` }, 400);
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof paciente_id !== "string" || !uuidPattern.test(paciente_id)) {
      return jsonResponse({ error: "Invalid patient reference" }, 400);
    }
    if (categoria === "laboratorio") {
      const tiposDocumento = [
        "orden_trabajo", "receta_protesica", "diseno_cad", "foto_diseno",
        "radiografia_control", "certificado_materiales", "garantia_trabajo",
        "evidencia_garantia", "otro",
      ];
      if (typeof orden_laboratorio_id !== "string" || !uuidPattern.test(orden_laboratorio_id)
          || typeof tipo_documento !== "string" || !tiposDocumento.includes(tipo_documento)) {
        return jsonResponse({ error: "A laboratory file requires a valid order and document type" }, 400);
      }
    } else if (orden_laboratorio_id !== undefined || tipo_documento !== undefined) {
      return jsonResponse({ error: "Order links are only supported for laboratory files" }, 400);
    }

    if (tamano_bytes < 0 || tamano_bytes > 50 * 1024 * 1024) {
      return jsonResponse({ error: "Invalid tamano_bytes. Must be between 0 and 50MB" }, 400);
    }

    // 3b. F7-22b: Validar formato del archivo (mime_type + extensión)
    // Defensa en profundidad: lista blanca por categoría + validación extensión vs mime_type
    const validacionFormato = validarFormatoArchivo(
      categoria as CategoriaArchivo,
      mime_type,
      nombre_archivo
    );
    if (!validacionFormato.valido) {
      // F7-34: Log sanitizado (sin PHI)
      console.log('[F7-22b] Formato rechazado', {
        categoria,
        mime_type,
        // nombre_archivo removido (PHI potencial)
      });
      return jsonResponse(
        {
          error: validacionFormato.error,
          code: "INVALID_FILE_FORMAT",
          ...(validacionFormato.esperado && { expected_formats: validacionFormato.esperado }),
        },
        400
      );
    }

    // 4. Confirmar la clínica seleccionada y la membresía activa antes de
    // consultar referencias clínicas usando la clave de servicio.
    const clinicaId = userData.user_metadata?.clinica_id;
    if (typeof clinicaId !== "string" || !uuidPattern.test(clinicaId)) {
      return jsonResponse({ error: "No hay clinica activa. Seleccione una clinica." }, 403);
    }

    const membershipUrl = new URL(`${supabaseUrl}/rest/v1/miembros_clinica`);
    membershipUrl.searchParams.set("user_id", `eq.${userId}`);
    membershipUrl.searchParams.set("clinica_id", `eq.${clinicaId}`);
    membershipUrl.searchParams.set("activo", "eq.true");
    membershipUrl.searchParams.set("select", "rol");
    const membershipResponse = await fetch(membershipUrl, {
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
    });
    const membershipResult = membershipResponse.ok ? await membershipResponse.json() : null;
    if (!Array.isArray(membershipResult) || membershipResult.length !== 1) {
      return jsonResponse({ error: "Sin membresia activa en la clinica seleccionada" }, 403);
    }

    // 5. Validar el rol antes de consultar datos del paciente o la orden.
    const userRol = membershipResult[0]?.rol;
    const allowedRoles = ["admin", "dentista"];
    if (!allowedRoles.includes(userRol)) {
      return jsonResponse(
        { error: `Insufficient permissions. Required: ${allowedRoles.join(" or ")}. Current: ${userRol}` },
        403
      );
    }

    // 6. Validar que paciente pertenece a la clínica
    const pacienteResult = await fetch(
      `${supabaseUrl}/rest/v1/pacientes?id=eq.${paciente_id}&clinica_id=eq.${clinicaId}&select=id`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    ).then((res) => res.json());

    if (!pacienteResult || pacienteResult.length === 0) {
      return jsonResponse({ error: "Paciente not found or does not belong to your clínica" }, 403);
    }

    if (categoria === "laboratorio") {
      const orderUrl = new URL(`${supabaseUrl}/rest/v1/ordenes_laboratorio`);
      orderUrl.searchParams.set("id", `eq.${orden_laboratorio_id}`);
      orderUrl.searchParams.set("clinica_id", `eq.${clinicaId}`);
      orderUrl.searchParams.set("paciente_id", `eq.${paciente_id}`);
      orderUrl.searchParams.set("select", "id");
      const orderResponse = await fetch(orderUrl, {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      });
      const orderResult = orderResponse.ok ? await orderResponse.json() : [];
      if (!Array.isArray(orderResult) || orderResult.length !== 1) {
        return jsonResponse({ error: "Order not found for this patient and clinic" }, 403);
      }
    }

    // 7. Generar r2_object_key único
    const archivoId = crypto.randomUUID();
    const timestamp = Date.now();
    const safeName = nombre_archivo.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
    const r2ObjectKey = `${clinicaId}/${paciente_id}/${categoria}/${archivoId}-${safeName}`;

    // 8. Guardar metadata en archivos_clinicos (estado: activo)
    const metadataResult = await fetch(`${supabaseUrl}/rest/v1/archivos_clinicos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: archivoId,
        clinica_id: clinicaId,
        paciente_id,
        // F7-34 FIX: r2_object_key DEBE guardarse en BD (NOT NULL), la Edge Function
        // lo necesita para operar con R2. La sanitizacion PHI se aplica en la respuesta
        // HTTP (ya no se expone al cliente) y en audit_log, no en la BD.
        r2_object_key: r2ObjectKey,
        nombre_archivo,
        mime_type,
        tamano_bytes,
        categoria,
        orden_laboratorio_id: categoria === "laboratorio" ? orden_laboratorio_id : null,
        uploaded_by: userId,
        estado: "activo",
        metadata: categoria === "laboratorio" ? { tipo_documento } : {},
      }),
    });

    if (!metadataResult.ok) {
      const errorText = await metadataResult.text();
      // F7-35 fix: usar safeError para HTTP 500 real + log seguro (errorText va a logs, no al cliente)
      return safeError(req, "METADATA_INSERT_FAILED", errorText, 500, "[r2-upload-url]");
    }

    // 9. Registrar en audit_log via RPC
    await fetch(`${supabaseUrl}/rest/v1/rpc/registrar_evento_archivo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_archivo_id: archivoId,
        p_evento: "FILE_UPLOAD",
        p_detalle: {
          paciente_id,
          categoria,
          tamano_bytes,
          // F7-34: r2_object_key removido (contiene clinica_id/paciente_id)
        },
        p_user_id: userId,
      }),
    });

    // 10. Generar URL firmada S3 para upload (PUT, 15 min)
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
    const bucketName = Deno.env.get("R2_BUCKET_NAME")!;
    const accountId = Deno.env.get("R2_ACCOUNT_ID")!;

    const host = `${accountId}.r2.cloudflarestorage.com`;
    const method = "PUT";
    const region = "auto";
    const service = "s3";
    const path = `/${bucketName}/${r2ObjectKey}`;
    const queryString = "";
    const payload = "UNSIGNED-PAYLOAD"; // Para upload, no firmamos el payload
    const payloadHash = payload;
    const { amzDate, dateStamp } = getAmzDate();

    const canonicalHeaders = `content-type:${mime_type}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      method,
      path,
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = await sha256Hex(canonicalRequest);
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join("\n");

    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signatureBuffer = await hmacSha256(signingKey as ArrayBuffer, stringToSign);
    const signature = toHex(signatureBuffer);

    const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const uploadUrl = `https://${host}${path}`;
    const expiresIn = 900; // 15 minutos

    // 11. Retornar respuesta
    return jsonResponse({
      archivo_id: archivoId,
      // F7-34: r2_object_key removido (contiene clinica_id/paciente_id)
      upload_url: uploadUrl,
      upload_headers: {
        "Content-Type": mime_type,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Authorization: authorization,
      },
      expires_in: expiresIn,
    });
  } catch (error) {
    return safeInternalError(req, error, "[r2-upload-url]");
  }
}

// F7-35 post-audit: arranque condicional (solo ejecuta si es el módulo principal)
// Esto permite importar handler desde tests sin iniciar el servidor
if (import.meta.main) {
  Deno.serve(handler);
}
