import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PutObjectCommand,
  S3Client,
} from "https://esm.sh/@aws-sdk/client-s3@3";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3";
import {
  esAdminActivoDeClinica,
  extensionLogo,
  validarSolicitudLogoClinica,
} from "./validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respuesta = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return respuesta({ error: "Método no permitido." }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return respuesta({ error: "Se requiere una sesión válida." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("R2_PROFILE_AVATARS_BUCKET") ||
    Deno.env.get("R2_BUCKET_NAME") || "profile-avatars";

  if (
    !supabaseUrl || !serviceRoleKey || !accountId || !accessKeyId ||
    !secretAccessKey
  ) {
    return respuesta(
      { error: "El servicio de logos no está configurado." },
      503,
    );
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return respuesta(
      { error: "La solicitud no tiene un formato válido." },
      400,
    );
  }

  const solicitud = validarSolicitudLogoClinica(input);
  if (!solicitud) {
    return respuesta({ error: "Los datos del logo no son válidos." }, 400);
  }

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await adminClient.auth.getUser(
      accessToken,
    );
    if (authError || !user) {
      return respuesta({ error: "La sesión no es válida." }, 401);
    }

    const { data: membresia, error: membershipError } = await adminClient
      .from("miembros_clinica")
      .select("clinica_id, user_id, rol, activo")
      .eq("clinica_id", solicitud.clinica_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      return respuesta(
        { error: "No se pudo validar el acceso a la clínica." },
        503,
      );
    }
    if (!esAdminActivoDeClinica(membresia, user.id, solicitud.clinica_id)) {
      return respuesta({
        error: "No tienes permiso para cambiar el logo de esta clínica.",
      }, 403);
    }

    const objectKey =
      `clinic-logos/${solicitud.clinica_id}/${crypto.randomUUID()}.${
        extensionLogo(solicitud.mime_type)
      }`;
    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: solicitud.mime_type,
      }),
      { expiresIn: 900 },
    );

    return respuesta({
      upload_url: uploadUrl,
      upload_headers: { "Content-Type": solicitud.mime_type },
      public_url: `https://pub-${accountId}.r2.dev/${objectKey}`,
      expires_in: 900,
    });
  } catch {
    // No propagar errores de Auth, SQL o AWS ni datos de configuración.
    return respuesta({ error: "No se pudo preparar la carga del logo." }, 500);
  }
});
