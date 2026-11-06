import { handler } from "./index.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}
function assertExists(value: unknown): void {
  if (value === null || value === undefined) {
    throw new Error("Expected a value to exist.");
  }
}
function assertStringIncludes(value: string, expected: string): void {
  if (!value.includes(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(value)} to include ${
        JSON.stringify(expected)
      }.`,
    );
  }
}

const clinicA = "11111111-1111-4111-8111-111111111111";
const userA = "22222222-2222-4222-8222-222222222222";
const expenseA = "33333333-3333-4333-8333-333333333333";
const documentA = "44444444-4444-4444-8444-444444444444";
const envValues: Record<string, string> = {
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "local-service-key",
  R2_ACCOUNT_ID: "account-test",
  R2_ACCESS_KEY_ID: "access-test",
  R2_SECRET_ACCESS_KEY: "secret-test",
  R2_BUCKET_NAME: "private-bucket",
};

function makeRequest(
  body: Record<string, unknown>,
  authorization = "Bearer local-user-jwt",
): Request {
  return new Request("https://edge.test/r2-finanzas-documento-url", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function dependencies(options: {
  role?: string;
  activeClinic?: string | null;
  expenses?: Array<{ id: string; estado: string }>;
  documents?: Array<
    {
      id: string;
      gasto_id: string;
      r2_key: string;
      mime_type: string;
      bytes: number;
      sha256: string;
      eliminado_at?: string | null;
    }
  >;
  objectBytes?: Uint8Array;
  objectMime?: string;
} = {}) {
  const calls: Array<{ url: string; method: string; headers: Headers }> = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    const headers = new Headers(init.headers);
    calls.push({ url, method, headers });
    if (url === `${envValues.SUPABASE_URL}/auth/v1/user`) {
      return Response.json({
        id: userA,
      });
    }
    if (url === `${envValues.SUPABASE_URL}/rest/v1/rpc/clinica_actual`) {
      assertEquals(method, "POST");
      assertEquals(headers.get("Authorization"), "Bearer local-user-jwt");
      return Response.json(
        options.activeClinic === undefined ? clinicA : options.activeClinic,
      );
    }
    if (url.startsWith(`${envValues.SUPABASE_URL}/rest/v1/miembros_clinica`)) {
      return Response.json([{ rol: options.role || "admin" }]);
    }
    if (url.startsWith(`${envValues.SUPABASE_URL}/rest/v1/bp15_gastos`)) {
      return Response.json(
        options.expenses ?? [{ id: expenseA, estado: "pendiente" }],
      );
    }
    if (
      url.startsWith(
        `${envValues.SUPABASE_URL}/rest/v1/bp15_gasto_documentos`,
      ) && method === "POST"
    ) {
      assertEquals(headers.get("Authorization"), "Bearer local-user-jwt");
      assertEquals(headers.get("apikey"), envValues.SUPABASE_SERVICE_ROLE_KEY);
      return Response.json([{ id: documentA }], { status: 201 });
    }
    if (
      url.startsWith(`${envValues.SUPABASE_URL}/rest/v1/bp15_gasto_documentos`)
    ) {
      return Response.json(options.documents || []);
    }
    if (url.startsWith("https://account-test.r2.cloudflarestorage.com/")) {
      const objectBytes = options.objectBytes ||
        new TextEncoder().encode("%PDF-1.4 test");
      const objectMime = options.objectMime || "application/pdf";
      if (method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: {
            "content-length": String(objectBytes.byteLength),
            "content-type": objectMime,
          },
        });
      }
      if (method === "GET") {
        const body = objectBytes.buffer.slice(
          objectBytes.byteOffset,
          objectBytes.byteOffset + objectBytes.byteLength,
        ) as ArrayBuffer;
        return new Response(body, {
          status: 200,
          headers: { "content-type": objectMime },
        });
      }
    }
    throw new Error(`Unexpected local test request: ${method} ${url}`);
  };
  return { fetcher, calls, env: (name: string) => envValues[name] };
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const bytes = value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

Deno.test("requires authentication before processing an expense attachment", async () => {
  const deps = dependencies();
  const response = await handler(
    makeRequest({ action: "upload", gasto_id: expenseA }, ""),
    deps,
  );
  assertEquals(response.status, 401);
  assertEquals(deps.calls.length, 0);
});

Deno.test("denies roles other than the active clinic admin", async () => {
  const deps = dependencies({ role: "recepcion" });
  const response = await handler(
    makeRequest({ action: "upload", gasto_id: expenseA }),
    deps,
  );
  assertEquals(response.status, 403);
  assertEquals(
    deps.calls.some((call) => call.url.includes("/bp15_gastos")),
    false,
  );
});

Deno.test("resolves the tenant through the authenticated clinic RPC, not user metadata", async () => {
  const deps = dependencies();
  const response = await handler(
    makeRequest({
      action: "upload",
      gasto_id: expenseA,
      mime_type: "application/pdf",
      bytes: 100,
      sha256: "a".repeat(64),
    }),
    deps,
  );
  assertEquals(response.status, 200);
  const rpc = deps.calls.find((call) =>
    call.url.endsWith("/rpc/clinica_actual")
  );
  assertExists(rpc);
  assertEquals(rpc?.headers.get("Authorization"), "Bearer local-user-jwt");
});

Deno.test("fails closed when the authenticated context has no active clinic", async () => {
  const deps = dependencies({ activeClinic: null });
  const response = await handler(
    makeRequest({
      action: "upload",
      gasto_id: expenseA,
      mime_type: "application/pdf",
      bytes: 100,
      sha256: "a".repeat(64),
    }),
    deps,
  );
  assertEquals(response.status, 403);
  assertEquals(
    deps.calls.some((call) =>
      call.url.includes("/miembros_clinica") ||
      call.url.includes("/bp15_gastos")
    ),
    false,
  );
});

Deno.test("signs a bounded upload only for an expense in the active clinic", async () => {
  const deps = dependencies();
  const response = await handler(
    makeRequest({
      action: "upload",
      gasto_id: expenseA,
      mime_type: "application/pdf",
      bytes: 2048,
      sha256: "a".repeat(64),
    }),
    deps,
  );
  const result = await response.json();
  assertEquals(response.status, 200);
  assertStringIncludes(result.r2_key, `${clinicA}/${expenseA}/`);
  assertStringIncludes(result.upload_url, "private-bucket");
  assertExists(result.upload_headers.Authorization);
  assertStringIncludes(
    result.upload_headers.Authorization,
    "SignedHeaders=content-length;content-type;host;x-amz-content-sha256;x-amz-date",
  );
  const gastoUrl =
    deps.calls.find((call) => call.url.includes("/bp15_gastos"))?.url || "";
  assertStringIncludes(gastoUrl, `clinica_id=eq.${clinicA}`);
});

Deno.test("rejects upload requests outside type and size limits before signing", async () => {
  const deps = dependencies();
  const response = await handler(
    makeRequest({
      action: "upload",
      gasto_id: expenseA,
      mime_type: "text/html",
      bytes: 20 * 1024 * 1024,
      sha256: "a".repeat(64),
    }),
    deps,
  );
  assertEquals(response.status, 400);
  assertEquals(
    deps.calls.some((call) => call.url.startsWith("https://account-test.")),
    false,
  );
});

Deno.test("rejects an expense from another clinic", async () => {
  const deps = dependencies({ expenses: [] });
  const response = await handler(
    makeRequest({
      action: "upload",
      gasto_id: expenseA,
      mime_type: "application/pdf",
      bytes: 100,
      sha256: "a".repeat(64),
    }),
    deps,
  );
  assertEquals(response.status, 404);
});

Deno.test("verifies actual uploaded size, mime and hash before creating metadata", async () => {
  const object = new TextEncoder().encode("%PDF-1.4 test");
  const hash = await sha256Hex(object);
  const key = `${clinicA}/${expenseA}/55555555-5555-4555-8555-555555555555.pdf`;
  const deps = dependencies({ objectBytes: object });
  const response = await handler(
    makeRequest({
      action: "confirm",
      gasto_id: expenseA,
      r2_key: key,
      mime_type: "application/pdf",
      bytes: object.byteLength,
      sha256: hash,
    }),
    deps,
  );
  const result = await response.json();
  assertEquals(response.status, 201);
  assertEquals(result.documento_id, documentA);
  assertEquals(
    deps.calls.filter((call) => call.url.startsWith("https://account-test."))
      .map((call) => call.method),
    ["HEAD", "GET"],
  );
  assertEquals(
    deps.calls.filter((call) =>
      call.url.includes("/bp15_gasto_documentos") && call.method === "POST"
    ).length,
    1,
  );
});

Deno.test("does not persist a document when the uploaded body hash differs", async () => {
  const object = new TextEncoder().encode("%PDF-1.4 actual");
  const key = `${clinicA}/${expenseA}/55555555-5555-4555-8555-555555555555.pdf`;
  const deps = dependencies({ objectBytes: object });
  const response = await handler(
    makeRequest({
      action: "confirm",
      gasto_id: expenseA,
      r2_key: key,
      mime_type: "application/pdf",
      bytes: object.byteLength,
      sha256: "a".repeat(64),
    }),
    deps,
  );
  assertEquals(response.status, 422);
  assertEquals(
    deps.calls.filter((call) =>
      call.url.includes("/bp15_gasto_documentos") && call.method === "POST"
    ).length,
    0,
  );
});

Deno.test("does not persist bytes whose signature does not match the declared MIME type", async () => {
  const object = new TextEncoder().encode("<html>not a PDF</html>");
  const hash = await sha256Hex(object);
  const key = `${clinicA}/${expenseA}/55555555-5555-4555-8555-555555555555.pdf`;
  const deps = dependencies({ objectBytes: object });
  const response = await handler(
    makeRequest({
      action: "confirm",
      gasto_id: expenseA,
      r2_key: key,
      mime_type: "application/pdf",
      bytes: object.byteLength,
      sha256: hash,
    }),
    deps,
  );
  assertEquals(response.status, 422);
  assertEquals(
    deps.calls.filter((call) =>
      call.url.includes("/bp15_gasto_documentos") && call.method === "POST"
    ).length,
    0,
  );
});

Deno.test("makes a repeated confirmation idempotent without signing another R2 request", async () => {
  const object = new TextEncoder().encode("%PDF-1.4 test");
  const hash = await sha256Hex(object);
  const key = `${clinicA}/${expenseA}/55555555-5555-4555-8555-555555555555.pdf`;
  const deps = dependencies({
    documents: [{
      id: documentA,
      gasto_id: expenseA,
      r2_key: key,
      mime_type: "application/pdf",
      bytes: object.byteLength,
      sha256: hash,
      eliminado_at: null,
    }],
  });
  const response = await handler(
    makeRequest({
      action: "confirm",
      gasto_id: expenseA,
      r2_key: key,
      mime_type: "application/pdf",
      bytes: object.byteLength,
      sha256: hash,
    }),
    deps,
  );
  const result = await response.json();
  assertEquals(response.status, 200);
  assertEquals(result.documento_id, documentA);
  assertEquals(
    deps.calls.some((call) => call.url.startsWith("https://account-test.")),
    false,
  );
});

Deno.test("signs download from clinic-filtered metadata and does not expose the object key", async () => {
  const key = `${clinicA}/${expenseA}/55555555-5555-4555-8555-555555555555.pdf`;
  const deps = dependencies({
    documents: [{
      id: documentA,
      gasto_id: expenseA,
      r2_key: key,
      mime_type: "application/pdf",
      bytes: 100,
      sha256: "a".repeat(64),
    }],
  });
  const response = await handler(
    makeRequest({ action: "download", documento_id: documentA }),
    deps,
  );
  const result = await response.json();
  assertEquals(response.status, 200);
  assertExists(result.download_url);
  assertEquals(result.r2_key, undefined);
  const documentUrl =
    deps.calls.find((call) => call.url.includes("/bp15_gasto_documentos"))
      ?.url || "";
  assertStringIncludes(documentUrl, `clinica_id=eq.${clinicA}`);
});
