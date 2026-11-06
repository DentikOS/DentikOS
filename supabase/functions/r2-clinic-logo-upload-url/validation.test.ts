import {
  esAdminActivoDeClinica,
  extensionLogo,
  validarSolicitudLogoClinica,
} from "./validation.ts";

const CLINICA_ID = "6dc4e203-fc21-4da8-9f64-5f7d1a50a4cd";
const USER_ID = "12a30e47-4d34-4c78-aab4-13d1e2df213a";

Deno.test("valida una solicitud de logo permitida y no acepta campos inferidos", () => {
  const solicitud = validarSolicitudLogoClinica({
    clinica_id: CLINICA_ID,
    nombre_archivo: "logo.png",
    mime_type: "image/png",
    tamano_bytes: 1024,
    user_id: "no-se-acepta-desde-el-cliente",
  });

  if (
    !solicitud || solicitud.clinica_id !== CLINICA_ID ||
    solicitud.mime_type !== "image/png"
  ) {
    throw new Error("La solicitud válida no fue aceptada correctamente.");
  }
  if ("user_id" in solicitud) {
    throw new Error("La identidad del usuario no debe provenir del cuerpo.");
  }
});

Deno.test("rechaza clínica inválida, MIME no permitido y tamaños fuera del límite", () => {
  const base = {
    clinica_id: CLINICA_ID,
    nombre_archivo: "logo.svg",
    mime_type: "image/png",
    tamano_bytes: 1024,
  };

  const casosInvalidos = [
    { ...base, clinica_id: "clinic-a" },
    { ...base, mime_type: "image/svg+xml" },
    { ...base, tamano_bytes: 0 },
    { ...base, tamano_bytes: 5 * 1024 * 1024 + 1 },
    { ...base, tamano_bytes: 1.5 },
    { ...base, nombre_archivo: "" },
  ];

  if (
    casosInvalidos.some((caso) => validarSolicitudLogoClinica(caso) !== null)
  ) {
    throw new Error("Se aceptó una solicitud inválida.");
  }
});

Deno.test("solo permite emitir URL a un admin activo de la misma clínica", () => {
  const membresia = {
    clinica_id: CLINICA_ID,
    user_id: USER_ID,
    rol: "admin",
    activo: true,
  };

  const casos = [
    { membresia, userId: USER_ID, clinicId: CLINICA_ID, permitido: true },
    {
      membresia: {
        ...membresia,
        clinica_id: "6dc4e203-fc21-4da8-9f64-5f7d1a50a4ce",
      },
      userId: USER_ID,
      clinicId: CLINICA_ID,
      permitido: false,
    },
    {
      membresia: { ...membresia, user_id: "otro-usuario" },
      userId: USER_ID,
      clinicId: CLINICA_ID,
      permitido: false,
    },
    {
      membresia: { ...membresia, rol: "dentista" },
      userId: USER_ID,
      clinicId: CLINICA_ID,
      permitido: false,
    },
    {
      membresia: { ...membresia, activo: false },
      userId: USER_ID,
      clinicId: CLINICA_ID,
      permitido: false,
    },
    {
      membresia: null,
      userId: USER_ID,
      clinicId: CLINICA_ID,
      permitido: false,
    },
  ];

  for (const caso of casos) {
    const permitido = esAdminActivoDeClinica(
      caso.membresia,
      caso.userId,
      caso.clinicId,
    );
    if (permitido !== caso.permitido) {
      throw new Error(
        "La autorización de membresía no coincide con el resultado esperado.",
      );
    }
  }
});

Deno.test("asigna extensión según el MIME validado", () => {
  if (extensionLogo("image/jpeg") !== "jpg") {
    throw new Error("Extensión JPEG incorrecta.");
  }
  if (extensionLogo("image/png") !== "png") {
    throw new Error("Extensión PNG incorrecta.");
  }
  if (extensionLogo("image/webp") !== "webp") {
    throw new Error("Extensión WebP incorrecta.");
  }
});
