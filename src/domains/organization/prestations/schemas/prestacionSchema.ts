import { z } from 'zod'

/**
 * Esquema de validación de prestación del arancel (F2-04d — MASTER_ROADMAP).
 * Sigue el patrón establecido en `pacienteSchema.js` (F2-04),
 * `citaSchema.js` (F2-04b) y `movimientoFinancieroSchema.js` (F2-04c).
 *
 * Campos obligatorios:
 * - `id`: identificador único (number o string)
 * - `nombre`: nombre descriptivo de la prestación
 * - `especialidad`: especialidad odontológica a la que pertenece
 * - `precioParticular`: precio para paciente particular (number)
 * - `precioFonasa`: precio convenio Fonasa/Isapre (number)
 * - `codigoFonasa`: código Fonasa oficial (string, formato XX-XX-XXX)
 *
 * Campos opcionales:
 * - `precio`: precio normalizado (calculado por usePrestaciones a partir
 *   de precioParticular, usado internamente por el hook)
 *
 * `.passthrough()` deliberado: permite que el objeto prestación crezca con
 * campos adicionales (ej: descripción extendida, duración, requisitos)
 * sin romper guardados legítimos. El objetivo es atrapar corrupción real
 * (campos obligatorios ausentes) — no restringir la forma exacta del objeto.
 */
export const prestacionSchema = z.object({
  // Campos obligatorios
  id: z.union([z.number(), z.string()]),
  nombre: z.string().trim().min(1, 'El nombre de la prestación es obligatorio'),
  especialidad: z.string().trim().min(1, 'La especialidad es obligatoria'),
  precioParticular: z.number({ message: 'El precio particular es obligatorio' }),
  precioFonasa: z.number({ message: 'El precio Fonasa es obligatorio' }),
  codigoFonasa: z.string().trim(),

  // Campos opcionales
  precio: z.number().optional(),
}).passthrough()

export type Prestacion = z.infer<typeof prestacionSchema>

export const listaPrestacionesSchema = z.array(prestacionSchema)

export type ValidacionListaPrestaciones = {
  valido: boolean
  datos: Prestacion[] | null
  error: z.ZodError | null
}

/**
 * Valida un arreglo de prestaciones del arancel. No lanza excepción — retorna
 * un resultado explícito para que el llamador decida qué hacer, evitando que
 * un dato corrupto tumbe la app entera con una excepción no capturada a mitad
 * de un guardado (Cap. V.2 Constitución).
 *
 * @param {unknown} prestaciones - Array de objetos prestación a validar.
 * @returns {ValidacionListaPrestaciones}
 */
export const validarListaPrestaciones = (prestaciones: unknown): ValidacionListaPrestaciones => {
  const resultado = listaPrestacionesSchema.safeParse(prestaciones)
  if (resultado.success) {
    return { valido: true, datos: resultado.data, error: null }
  }
  return { valido: false, datos: null, error: resultado.error }
}
