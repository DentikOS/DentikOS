type HandlerDependencies = {
  env: (name: string) => string | undefined;
  fetcher: typeof fetch;
};

type SessionUser = {
  id?: string;
};

type GastoRow = { id: string; estado: string };
type DocumentoRow = {
  id: string;
  gasto_id: string;
  r2_key: string;
  mime_type: string;
  bytes: number;
  sha256: string;
  eliminado_at?: string | null;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/xml": "xml",
  "text/xml": "xml",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const ALLOWED_CORS_HEADERS =
  "authorization, x-client-info, apikey, content-type";

export async function handler(
  req: Request,
  dependencies?: HandlerDependencies,
): Promise<Response> {
  const deps = dependencies ||
    { env: (name: string) => Deno.env.get(name), fetcher: fetch };
  if (req.method === "OPTIONS") return responder({ ok: true }, 200);
  if (req.method !== "POST") {
    return responder({ error: "Método no permitido." }, 405);
  }

  const authorization = req.headers.get("Authorization") || "";
  const jwt = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!jwt) return responder({ error: "Autenticación requerida." }, 401);

  const supabaseUrl = deps.env("SUPABASE_URL");
  const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return responder({ error: "Servicio financiero no disponible." }, 503);
  }

  try {
    const authResponse = await deps.fetcher(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: serviceKey },
    });
    if (!authResponse.ok) return responder({ error: "Sesión inválida." }, 401);
    const user = await authResponse.json() as SessionUser;
    const userId = user.id;
    const clinicResponse = await deps.fetcher(
      `${supabaseUrl}/rest/v1/rpc/clinica_actual`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    const clinicId = clinicResponse.ok
      ? await clinicResponse.json() as string | null
      : null;
    if (!userId || !UUID.test(userId) || !clinicId || !UUID.test(clinicId)) {
      return responder({ error: "Selecciona una clínica válida." }, 403);
    }

    const membershipUrl = new URL(`${supabaseUrl}/rest/v1/miembros_clinica`);
    membershipUrl.searchParams.set("user_id", `eq.${userId}`);
    membershipUrl.searchParams.set("clinica_id", `eq.${clinicId}`);
    membershipUrl.searchParams.set("activo", "eq.true");
    membershipUrl.searchParams.set("select", "rol");
    const membershipResponse = await deps.fetcher(membershipUrl, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    const memberships = membershipResponse.ok
      ? await membershipResponse.json()
      : null;
    if (
      !Array.isArray(memberships) || memberships.length !== 1 ||
      memberships[0]?.rol !== "admin"
    ) {
      return responder({
        error: "Solo administración puede gestionar respaldos financieros.",
      }, 403);
    }

    let input: Record<string, unknown>;
    try {
      input = await req.json() as Record<string, unknown>;
    } catch {
      return responder({ error: "Solicitud inválida." }, 400);
    }
    const action = input.action;
    const r2 = obtenerConfiguracionR2(deps.env);
    if (!r2) {
      return responder({ error: "Almacenamiento privado no disponible." }, 503);
    }

    if (action === "upload") {
      const gastoId = typeof input.gasto_id === "string" ? input.gasto_id : "";
      const mimeType = typeof input.mime_type === "string"
        ? input.mime_type
        : "";
      const bytes = input.bytes;
      const sha256 = typeof input.sha256 === "string"
        ? input.sha256.toLowerCase()
        : "";
      if (
        !UUID.test(gastoId) || !(mimeType in MIME_EXT) ||
        !Number.isSafeInteger(bytes) ||
        Number(bytes) < 1 || Number(bytes) > MAX_BYTES || !HASH.test(sha256)
      ) {
        return responder({
          error: "El respaldo debe ser PDF, XML, JPG o PNG y no superar 10 MB.",
        }, 400);
      }
      const gasto = await buscarGasto(
        deps,
        supabaseUrl,
        serviceKey,
        clinicId,
        gastoId,
      );
      if (!gasto) {
        return responder(
          { error: "Gasto no encontrado en esta clínica." },
          404,
        );
      }
      if (gasto.estado === "anulado") {
        return responder({
          error: "No se adjuntan respaldos a un gasto anulado.",
        }, 409);
      }

      const key = `${clinicId}/${gastoId}/${crypto.randomUUID()}.${
        MIME_EXT[mimeType]
      }`;
      const firmado = await firmarSolicitud(r2, "PUT", key, {
        mimeType,
        bytes: Number(bytes),
        sha256,
      });
      return responder({
        r2_key: key,
        upload_url: firmado.url,
        upload_headers: firmado.headers,
        expires_in: 300,
      }, 200);
    }

    if (action === "confirm") {
      const gastoId = typeof input.gasto_id === "string" ? input.gasto_id : "";
      const key = typeof input.r2_key === "string" ? input.r2_key : "";
      const mimeType = typeof input.mime_type === "string"
        ? input.mime_type
        : "";
      const bytes = input.bytes;
      const sha256 = typeof input.sha256 === "string"
        ? input.sha256.toLowerCase()
        : "";
      if (
        !UUID.test(gastoId) || !(mimeType in MIME_EXT) ||
        !Number.isSafeInteger(bytes) ||
        Number(bytes) < 1 || Number(bytes) > MAX_BYTES || !HASH.test(sha256) ||
        !validarClave(key, clinicId, gastoId, MIME_EXT[mimeType])
      ) {
        return responder(
          { error: "Los datos del respaldo no son válidos." },
          400,
        );
      }
      const gasto = await buscarGasto(
        deps,
        supabaseUrl,
        serviceKey,
        clinicId,
        gastoId,
      );
      if (!gasto || gasto.estado === "anulado") {
        return responder(
          { error: "Gasto no disponible en esta clínica." },
          404,
        );
      }

      const existente = await buscarDocumento(
        deps,
        supabaseUrl,
        serviceKey,
        clinicId,
        key,
      );
      if (existente) {
        if (
          existente.eliminado_at === null && existente.gasto_id === gastoId &&
          existente.mime_type === mimeType &&
          Number(existente.bytes) === Number(bytes) &&
          existente.sha256 === sha256
        ) {
          return responder({ documento_id: existente.id }, 200);
        }
        return responder({
          error: "El objeto ya está asociado a otro respaldo o fue eliminado.",
        }, 409);
      }

      const head = await solicitarObjeto(deps.fetcher, r2, "HEAD", key);
      if (!head.ok) {
        return responder({ error: "No se encontró el archivo subido." }, 422);
      }
      const objectBytes = Number(head.headers.get("content-length"));
      const objectMime = head.headers.get("content-type")?.split(";")[0].trim()
        .toLowerCase();
      if (
        objectBytes !== Number(bytes) || objectMime !== mimeType ||
        objectBytes > MAX_BYTES
      ) {
        return responder({
          error:
            "El archivo subido no coincide con su tamaño o formato declarado.",
        }, 422);
      }

      const objectResponse = await solicitarObjeto(
        deps.fetcher,
        r2,
        "GET",
        key,
      );
      if (!objectResponse.ok) {
        return responder(
          { error: "No se pudo verificar el archivo subido." },
          422,
        );
      }
      const objectData = await objectResponse.arrayBuffer();
      if (
        objectData.byteLength !== objectBytes ||
        await sha256Hex(objectData) !== sha256
      ) {
        return responder({
          error: "El contenido no coincide con el hash declarado.",
        }, 422);
      }
      if (!validarContenidoMime(objectData, mimeType)) {
        return responder({
          error: "El contenido no corresponde al formato declarado.",
        }, 422);
      }

      const insertResponse = await deps.fetcher(
        `${supabaseUrl}/rest/v1/bp15_gasto_documentos`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: serviceKey,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            clinica_id: clinicId,
            gasto_id: gastoId,
            r2_key: key,
            mime_type: mimeType,
            bytes: objectBytes,
            sha256,
            created_by: userId,
          }),
        },
      );
      if (!insertResponse.ok) {
        const concurrente = await buscarDocumento(
          deps,
          supabaseUrl,
          serviceKey,
          clinicId,
          key,
        );
        if (
          concurrente?.eliminado_at === null &&
          concurrente.gasto_id === gastoId &&
          concurrente.mime_type === mimeType &&
          Number(concurrente.bytes) === objectBytes &&
          concurrente.sha256 === sha256
        ) {
          return responder({ documento_id: concurrente.id }, 200);
        }
        return responder(
          { error: "No se pudo asociar el respaldo al gasto." },
          409,
        );
      }
      const inserted = await insertResponse.json() as Array<{ id?: string }>;
      return responder({
        documento_id: Array.isArray(inserted) ? inserted[0]?.id : undefined,
      }, 201);
    }

    if (action === "download") {
      const documentId = typeof input.documento_id === "string"
        ? input.documento_id
        : "";
      if (!UUID.test(documentId)) {
        return responder({ error: "Referencia de respaldo inválida." }, 400);
      }
      const documentUrl = new URL(
        `${supabaseUrl}/rest/v1/bp15_gasto_documentos`,
      );
      documentUrl.searchParams.set("id", `eq.${documentId}`);
      documentUrl.searchParams.set("clinica_id", `eq.${clinicId}`);
      documentUrl.searchParams.set("eliminado_at", "is.null");
      documentUrl.searchParams.set(
        "select",
        "id,gasto_id,r2_key,mime_type,bytes,sha256",
      );
      const documentResponse = await deps.fetcher(documentUrl, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      });
      const documents = documentResponse.ok
        ? await documentResponse.json() as DocumentoRow[]
        : [];
      const document = Array.isArray(documents) ? documents[0] : null;
      if (
        !document ||
        !validarClave(
          document.r2_key,
          clinicId,
          document.gasto_id,
          MIME_EXT[document.mime_type],
        )
      ) {
        return responder(
          { error: "Respaldo no encontrado en esta clínica." },
          404,
        );
      }
      const firmado = await firmarSolicitud(r2, "GET", document.r2_key);
      return responder({
        download_url: firmado.url,
        download_headers: firmado.headers,
        mime_type: document.mime_type,
        expires_in: 300,
      }, 200);
    }

    return responder({ error: "Operación no admitida." }, 400);
  } catch {
    return responder(
      { error: "No se pudo procesar el respaldo financiero." },
      500,
    );
  }
}

async function buscarGasto(
  deps: HandlerDependencies,
  supabaseUrl: string,
  serviceKey: string,
  clinicId: string,
  gastoId: string,
): Promise<GastoRow | null> {
  const url = new URL(`${supabaseUrl}/rest/v1/bp15_gastos`);
  url.searchParams.set("id", `eq.${gastoId}`);
  url.searchParams.set("clinica_id", `eq.${clinicId}`);
  url.searchParams.set("select", "id,estado");
  const response = await deps.fetcher(url, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  const rows = response.ok ? await response.json() as GastoRow[] : [];
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function buscarDocumento(
  deps: HandlerDependencies,
  supabaseUrl: string,
  serviceKey: string,
  clinicId: string,
  key: string,
): Promise<DocumentoRow | null> {
  const url = new URL(`${supabaseUrl}/rest/v1/bp15_gasto_documentos`);
  url.searchParams.set("clinica_id", `eq.${clinicId}`);
  url.searchParams.set("r2_key", `eq.${key}`);
  url.searchParams.set(
    "select",
    "id,gasto_id,r2_key,mime_type,bytes,sha256,eliminado_at",
  );
  const response = await deps.fetcher(url, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  const rows = response.ok ? await response.json() as DocumentoRow[] : [];
  return Array.isArray(rows) ? rows[0] || null : null;
}

function validarClave(
  key: string,
  clinicId: string,
  gastoId: string,
  extension: string | undefined,
): boolean {
  if (!extension) return false;
  return key.startsWith(`${clinicId}/${gastoId}/`) &&
    new RegExp(
      `^${clinicId}/${gastoId}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.${extension}$`,
      "i",
    ).test(key);
}

function validarContenidoMime(data: ArrayBuffer, mimeType: string): boolean {
  const bytes = new Uint8Array(data);
  if (mimeType === "application/pdf") {
    return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  }
  if (mimeType === "image/png") {
    return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) =>
      bytes[index] === byte
    );
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "application/xml" || mimeType === "text/xml") {
    const prefix = new TextDecoder().decode(bytes.slice(0, 512)).replace(
      /^\uFEFF/,
      "",
    ).trimStart();
    return /^<\?xml\b/i.test(prefix) ||
      /^<[A-Za-z_:][\w:.-]*(?:\s|\/?>)/.test(prefix);
  }
  return false;
}

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};
function obtenerConfiguracionR2(
  env: (name: string) => string | undefined,
): R2Config | null {
  const accountId = env("R2_ACCOUNT_ID");
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const bucket = env("R2_BUCKET_NAME");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

type SignedRequest = { url: string; headers: Record<string, string> };
async function firmarSolicitud(
  config: R2Config,
  method: "PUT" | "GET" | "HEAD",
  key: string,
  upload?: { mimeType: string; bytes: number; sha256: string },
): Promise<SignedRequest> {
  const encoder = new TextEncoder();
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucket}/${key}`;
  const { amzDate, dateStamp } = fechaAmz();
  const payloadHash = method === "PUT"
    ? "UNSIGNED-PAYLOAD"
    : await sha256Hex(new ArrayBuffer(0));
  const canonicalHeaderList = method === "PUT"
    ? [
      `content-length:${upload!.bytes}`,
      `content-type:${upload!.mimeType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ]
    : [
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ];
  const canonicalHeaders = `${canonicalHeaderList.join("\n")}\n`;
  const signedHeaders = method === "PUT"
    ? "content-length;content-type;host;x-amz-content-sha256;x-amz-date"
    : "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(encoder.encode(canonicalRequest)),
  ].join("\n");
  const signatureKey = await derivarClave(config.secretAccessKey, dateStamp);
  const signature = hex(await hmac(signatureKey, stringToSign));
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers: Record<string, string> = {
    Authorization: authorization,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (upload) {
    headers["Content-Type"] = upload.mimeType;
    // Content-Length is signed and the browser supplies it from the File body.
  }
  return { url: `https://${host}${path}`, headers };
}

async function solicitarObjeto(
  fetcher: typeof fetch,
  config: R2Config,
  method: "GET" | "HEAD",
  key: string,
): Promise<Response> {
  const signed = await firmarSolicitud(config, method, key);
  return fetcher(signed.url, { method, headers: signed.headers });
}

function fechaAmz(): { amzDate: string; dateStamp: string } {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

async function sha256Hex(value: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(value));
  return hex(digest);
}

function hex(value: ArrayBuffer): string {
  return Array.from(
    new Uint8Array(value),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function hmac(
  key: ArrayBuffer | Uint8Array,
  value: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    toArrayBuffer(new TextEncoder().encode(value)),
  );
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer as ArrayBuffer;
}

async function derivarClave(
  secret: string,
  dateStamp: string,
): Promise<ArrayBuffer> {
  const kDate = await hmac(
    new TextEncoder().encode(`AWS4${secret}`),
    dateStamp,
  );
  const kRegion = await hmac(kDate, "auto");
  const kService = await hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function responder(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": ALLOWED_CORS_HEADERS,
    },
  });
}

if (import.meta.main) Deno.serve((req) => handler(req));
