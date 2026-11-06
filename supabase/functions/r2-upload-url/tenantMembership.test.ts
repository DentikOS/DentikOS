import { createMockFetch, createAuthRequest, setupDenoEnv } from "../_shared/testUtils.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SELECTED_CLINIC = "22222222-2222-4222-8222-222222222222";
const OTHER_CLINIC = "33333333-3333-4333-8333-333333333333";

setupDenoEnv();

async function assertRejectedBeforeClinicData(
  memberships: Array<{ user_id: string; clinica_id: string; rol: string; activo: boolean }>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  let clinicDataLookups = 0;
  const mockFetch = createMockFetch({
    authUser: { id: USER_ID, user_metadata: { clinica_id: SELECTED_CLINIC } },
    memberships,
    pacientes: [{ id: "44444444-4444-4444-8444-444444444444", clinica_id: SELECTED_CLINIC }],
  });

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (/\/rest\/v1\/(pacientes|ordenes_laboratorio|archivos_clinicos)/.test(urlStr)) clinicDataLookups++;
    return mockFetch(url, init);
  }) as typeof fetch;

  try {
    const req = createAuthRequest({
      paciente_id: "44444444-4444-4444-8444-444444444444",
      categoria: "pdf",
      nombre_archivo: "laboratorio.pdf",
      mime_type: "application/pdf",
      tamano_bytes: 1024,
    });
    const response = await (await import("./index.ts")).handler(req);

    if (response.status !== 403) throw new Error(`Se esperaba 403, se recibió ${response.status}`);
    if (clinicDataLookups !== 0) throw new Error(`Se consultaron datos clínicos antes de validar membresía: ${clinicDataLookups}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

Deno.test("rechaza membresía inactiva antes de consultar paciente, orden o crear archivo", () =>
  assertRejectedBeforeClinicData([
    { user_id: USER_ID, clinica_id: SELECTED_CLINIC, rol: "dentista", activo: false },
    { user_id: USER_ID, clinica_id: OTHER_CLINIC, rol: "admin", activo: true },
  ]));

Deno.test("rechaza roles sin permiso de carga antes de consultar datos clínicos", () =>
  assertRejectedBeforeClinicData([
    { user_id: USER_ID, clinica_id: SELECTED_CLINIC, rol: "asistente", activo: true },
  ]));
