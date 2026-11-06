// F7-22b: Validación server-side de formato de archivo (mime_type + extensión)
//
// Defensa en profundidad: además de la validación del cliente, el servidor
// verifica que el mime_type esté en la lista blanca de la categoría y que
// la extensión del nombre_archivo coincida con el mime_type declarado.
//
// Nota: esta validación NO puede verificar magic bytes (contenido real)
// porque la arquitectura actual sube directamente a R2 (la Edge Function
// nunca ve el contenido del archivo). Para validación de magic bytes
// se requeriría cambiar la arquitectura (upload pasa por Edge Function).

export type CategoriaArchivo = 
  | "radiografia" 
  | "foto_intraoral" 
  | "foto_clinica" 
  | "pdf" 
  | "documento" 
  | "otro"
  | "laboratorio";

export const MIME_TYPES_PERMITIDOS: Record<CategoriaArchivo, string[]> = {
  radiografia: ["image/jpeg", "image/png", "image/webp", "application/dicom"],
  foto_intraoral: ["image/jpeg", "image/png", "image/webp"],
  foto_clinica: ["image/jpeg", "image/png", "image/webp"],
  pdf: ["application/pdf"],
  documento: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  otro: ["application/pdf", "image/jpeg", "image/png", "text/plain"],
  laboratorio: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
    "model/stl",
    "application/sla",
    "application/octet-stream",
  ],
};

export const EXTENSIONES_POR_MIME: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/dicom": ["dcm", "dicom"],
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "text/plain": ["txt"],
  "model/stl": ["stl"],
  "application/sla": ["stl"],
  "application/octet-stream": ["stl"],
};

export interface ResultadoValidacion {
  valido: boolean;
  error?: string;
  esperado?: string[];
}

/**
 * Extrae la extensión de un nombre de archivo (sin punto, en minúsculas).
 * @example extraerExtension("foto.JPG") => "jpg"
 * @example extraerExtension("archivo.tar.gz") => "gz"
 */
export const extraerExtension = (nombreArchivo: string): string | null => {
  if (!nombreArchivo || typeof nombreArchivo !== "string") return null;
  const partes = nombreArchivo.split(".");
  if (partes.length < 2) return null;
  const extension = partes[partes.length - 1].toLowerCase();
  return extension.length > 0 && extension.length <= 10 ? extension : null;
};

/**
 * Valida que el mime_type esté en la lista blanca de la categoría.
 */
export const validarMimeTypePorCategoria = (
  categoria: CategoriaArchivo,
  mimeType: string
): ResultadoValidacion => {
  const permitidos = MIME_TYPES_PERMITIDOS[categoria];
  
  if (!permitidos) {
    return {
      valido: false,
      error: `Categoría desconocida: ${categoria}`,
    };
  }

  if (!mimeType || typeof mimeType !== "string") {
    return {
      valido: false,
      error: "mime_type requerido",
      esperado: permitidos,
    };
  }

  const mimeTypeLower = mimeType.toLowerCase().trim();
  
  if (!permitidos.includes(mimeTypeLower)) {
    return {
      valido: false,
      error: `mime_type "${mimeType}" no permitido para categoría "${categoria}"`,
      esperado: permitidos,
    };
  }

  return { valido: true };
};

/**
 * Valida que la extensión del nombre_archivo coincida con el mime_type declarado.
 */
export const validarExtensionVsMimeType = (
  nombreArchivo: string,
  mimeType: string
): ResultadoValidacion => {
  const extension = extraerExtension(nombreArchivo);
  
  if (!extension) {
    return {
      valido: false,
      error: `Archivo "${nombreArchivo}" no tiene extensión válida`,
    };
  }

  const extensionesValidas = EXTENSIONES_POR_MIME[mimeType.toLowerCase().trim()];
  
  if (!extensionesValidas) {
    return {
      valido: false,
      error: `mime_type "${mimeType}" no tiene extensiones conocidas`,
    };
  }

  if (!extensionesValidas.includes(extension)) {
    return {
      valido: false,
      error: `Extensión ".${extension}" no coincide con mime_type "${mimeType}"`,
      esperado: extensionesValidas.map(ext => `.${ext}`),
    };
  }

  return { valido: true };
};

/**
 * Validación completa: mime_type + extensión.
 * @returns ResultadoValidacion con valido=true si pasa todas las validaciones
 */
export const validarFormatoArchivo = (
  categoria: CategoriaArchivo,
  mimeType: string,
  nombreArchivo: string
): ResultadoValidacion => {
  // 1. Validar mime_type contra lista blanca de la categoría
  const validacionMime = validarMimeTypePorCategoria(categoria, mimeType);
  if (!validacionMime.valido) {
    return validacionMime;
  }

  // 2. Validar que la extensión coincida con el mime_type
  const validacionExtension = validarExtensionVsMimeType(nombreArchivo, mimeType);
  if (!validacionExtension.valido) {
    return validacionExtension;
  }

  return { valido: true };
};
