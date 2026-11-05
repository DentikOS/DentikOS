export interface SolicitudLogoClinica {
  clinica_id: string;
  nombre_archivo: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp";
  tamano_bytes: number;
}

export interface MembresiaLogoClinica {
  clinica_id?: string | null;
  user_id?: string | null;
  rol?: string | null;
  activo?: boolean | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_TYPES = new Set<SolicitudLogoClinica["mime_type"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export const validarSolicitudLogoClinica = (
  input: unknown,
): SolicitudLogoClinica | null => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }

  const body = input as Record<string, unknown>;
  if (typeof body.clinica_id !== "string" || !UUID_RE.test(body.clinica_id)) {
    return null;
  }
  if (
    typeof body.nombre_archivo !== "string" ||
    body.nombre_archivo.trim().length === 0 || body.nombre_archivo.length > 255
  ) return null;
  if (
    typeof body.mime_type !== "string" ||
    !MIME_TYPES.has(body.mime_type as SolicitudLogoClinica["mime_type"])
  ) return null;
  if (
    !Number.isSafeInteger(body.tamano_bytes) ||
    (body.tamano_bytes as number) < 1 ||
    (body.tamano_bytes as number) > MAX_LOGO_BYTES
  ) return null;

  return {
    clinica_id: body.clinica_id,
    nombre_archivo: body.nombre_archivo,
    mime_type: body.mime_type as SolicitudLogoClinica["mime_type"],
    tamano_bytes: body.tamano_bytes as number,
  };
};

export const esAdminActivoDeClinica = (
  membresia: MembresiaLogoClinica | null | undefined,
  userId: string,
  clinicaId: string,
): boolean =>
  Boolean(
    membresia &&
      membresia.user_id === userId &&
      membresia.clinica_id === clinicaId &&
      membresia.rol === "admin" &&
      membresia.activo === true,
  );

export const extensionLogo = (
  mimeType: SolicitudLogoClinica["mime_type"],
): string => {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
};
