// F7-22b: Tests unitarios de validación de formato de archivo
import {
  validarFormatoArchivo,
  validarMimeTypePorCategoria,
  validarExtensionVsMimeType,
  extraerExtension,
  MIME_TYPES_PERMITIDOS,
  EXTENSIONES_POR_MIME,
} from "./validarFormatoArchivo.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("extraerExtension - casos válidos", () => {
  assertEquals(extraerExtension("foto.jpg"), "jpg");
  assertEquals(extraerExtension("FOTO.JPG"), "jpg");
  assertEquals(extraerExtension("archivo.tar.gz"), "gz");
  assertEquals(extraerExtension("radiografia_panoramica.dcm"), "dcm");
});

Deno.test("extraerExtension - casos inválidos", () => {
  assertEquals(extraerExtension("sin_extension"), null);
  assertEquals(extraerExtension(""), null);
  assertEquals(extraerExtension(".extension_muy_larga_que_no_es_valida"), null);
});

Deno.test("validarMimeTypePorCategoria - casos válidos", () => {
  assertEquals(validarMimeTypePorCategoria("radiografia", "image/jpeg").valido, true);
  assertEquals(validarMimeTypePorCategoria("radiografia", "application/dicom").valido, true);
  assertEquals(validarMimeTypePorCategoria("foto_clinica", "image/png").valido, true);
  assertEquals(validarMimeTypePorCategoria("pdf", "application/pdf").valido, true);
  assertEquals(validarMimeTypePorCategoria("documento", "application/msword").valido, true);
  assertEquals(validarMimeTypePorCategoria("laboratorio", "application/pdf").valido, true);
  assertEquals(validarMimeTypePorCategoria("laboratorio", "model/stl").valido, true);
});

Deno.test("validarMimeTypePorCategoria - casos inválidos", () => {
  const resultado1 = validarMimeTypePorCategoria("radiografia", "application/pdf");
  assertEquals(resultado1.valido, false);
  assertNotEquals(resultado1.error, undefined);

  const resultado2 = validarMimeTypePorCategoria("foto_clinica", "application/exe");
  assertEquals(resultado2.valido, false);

  const resultado3 = validarMimeTypePorCategoria("pdf", "image/jpeg");
  assertEquals(resultado3.valido, false);

  assertEquals(validarMimeTypePorCategoria("laboratorio", "application/x-msdownload").valido, false);
});

Deno.test("validarMimeTypePorCategoria - case insensitive", () => {
  assertEquals(validarMimeTypePorCategoria("radiografia", "IMAGE/JPEG").valido, true);
  assertEquals(validarMimeTypePorCategoria("pdf", "APPLICATION/PDF").valido, true);
});

Deno.test("validarExtensionVsMimeType - casos válidos", () => {
  assertEquals(validarExtensionVsMimeType("foto.jpg", "image/jpeg").valido, true);
  assertEquals(validarExtensionVsMimeType("foto.JPG", "image/jpeg").valido, true);
  assertEquals(validarExtensionVsMimeType("imagen.png", "image/png").valido, true);
  assertEquals(validarExtensionVsMimeType("documento.pdf", "application/pdf").valido, true);
  assertEquals(validarExtensionVsMimeType("radiografia.dcm", "application/dicom").valido, true);
  assertEquals(validarExtensionVsMimeType("archivo.dicom", "application/dicom").valido, true);
});

Deno.test("validarExtensionVsMimeType - extensión incorrecta", () => {
  const resultado1 = validarExtensionVsMimeType("archivo.pdf", "image/jpeg");
  assertEquals(resultado1.valido, false);
  assertEquals(resultado1.error?.includes(".pdf"), true);
  assertEquals(resultado1.error?.includes("image/jpeg"), true);

  const resultado2 = validarExtensionVsMimeType("foto.jpg", "application/pdf");
  assertEquals(resultado2.valido, false);

  const resultado3 = validarExtensionVsMimeType("virus.exe", "image/jpeg");
  assertEquals(resultado3.valido, false);
});

Deno.test("validarExtensionVsMimeType - sin extensión", () => {
  const resultado = validarExtensionVsMimeType("sin_extension", "image/jpeg");
  assertEquals(resultado.valido, false);
});

Deno.test("validarFormatoArchivo - casos completos válidos", () => {
  assertEquals(
    validarFormatoArchivo("radiografia", "image/jpeg", "panoramica.jpg").valido,
    true
  );
  assertEquals(
    validarFormatoArchivo("foto_clinica", "image/png", "intraoral.png").valido,
    true
  );
  assertEquals(
    validarFormatoArchivo("pdf", "application/pdf", "consentimiento.pdf").valido,
    true
  );
  assertEquals(validarFormatoArchivo("laboratorio", "application/pdf", "receta.pdf").valido, true);
  assertEquals(validarFormatoArchivo("laboratorio", "model/stl", "diseno.stl").valido, true);
  assertEquals(validarFormatoArchivo("laboratorio", "application/octet-stream", "diseno.stl").valido, true);
  assertEquals(
    validarFormatoArchivo("documento", "application/msword", "historia.doc").valido,
    true
  );
});

Deno.test("validarFormatoArchivo - mime_type inválido para categoría", () => {
  const resultado = validarFormatoArchivo(
    "radiografia",
    "application/pdf",
    "radiografia.pdf"
  );
  assertEquals(resultado.valido, false);
  assertEquals(resultado.error?.includes("no permitido"), true);
});

Deno.test("validarFormatoArchivo - extensión no coincide con mime_type", () => {
  const resultado = validarFormatoArchivo(
    "radiografia",
    "image/jpeg",
    "radiografia.pdf"
  );
  assertEquals(resultado.valido, false);
  assertEquals(resultado.error?.includes("no coincide"), true);
});

Deno.test("validarFormatoArchivo - ataque: exe con mime_type falso", () => {
  const resultado = validarFormatoArchivo(
    "foto_clinica",
    "image/jpeg",
    "virus.exe"
  );
  assertEquals(resultado.valido, false);
});

Deno.test("validarFormatoArchivo - todas las categorías tienen mime_types", () => {
  const categorias = ["radiografia", "foto_intraoral", "foto_clinica", "pdf", "documento", "otro"];
  for (const categoria of categorias) {
    const permitidos = MIME_TYPES_PERMITIDOS[categoria as keyof typeof MIME_TYPES_PERMITIDOS];
    assertNotEquals(permitidos, undefined);
    assertEquals(Array.isArray(permitidos), true);
    assertEquals(permitidos.length > 0, true);
  }
});

Deno.test("validarFormatoArchivo - todos los mime_types tienen extensiones", () => {
  const mimeTypes = Object.keys(EXTENSIONES_POR_MIME);
  for (const mimeType of mimeTypes) {
    const extensiones = EXTENSIONES_POR_MIME[mimeType];
    assertNotEquals(extensiones, undefined);
    assertEquals(Array.isArray(extensiones), true);
    assertEquals(extensiones.length > 0, true);
  }
});
