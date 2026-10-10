import { z } from 'zod'
import { validarRut, normalizarRut } from '../../../../shared/utils/validarRut'

/**
 * Esquema de validación del paciente (F2-04 — MASTER_ROADMAP).
 * Primer caso de aplicación de Zod en el proyecto, según el plan acordado.
 *
 * Solo `id`, `nombre` y `rut` son estrictamente obligatorios: son los únicos
 * campos de los que depende el resto del sistema (búsqueda, navegación a la
 * ficha, eliminación bidireccional). El resto son campos que se completan de
 * forma progresiva durante la atención clínica (anamnesis, datos de
 * contacto) y no deben bloquear un guardado si todavía no están.
 *
 * `.passthrough()` deliberado: `useFichaPaciente.js` mezcla campos de
 * anamnesis directamente en el objeto paciente (línea `{...paciente,
 * ...nuevaFicha}`), y el objeto crece con el tiempo. Rechazar campos no
 * catalogados rompería guardados legítimos. El objetivo de este esquema es
 * atrapar corrupción real de datos (campo obligatorio ausente, tipo
 * incorrecto) — no restringir la forma exacta del objeto.
 *
 * F3-06: agregado campo `notas` (opcional) como parte de la migración v1 → v2.
 */
export const pacienteSchema = z.object({
  id: z.union([z.number(), z.string()]),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  rut: z.string()
    .trim()
    .min(1, 'El RUT es obligatorio')
    .refine(
      (val: string): boolean => {
        const normalizado = normalizarRut(val)
        // RUT chileno mínimo: 7 dígitos + DV = 8 caracteres
        if (normalizado.length < 8) return false
        return validarRut(val)
      },
      { message: 'RUT inválido (verifique el dígito verificador)' }
    ),

  telefono: z.union([z.string(), z.number()]).nullable().optional(),
  edad: z.union([z.string(), z.number()]).nullable().optional(),
  prevision: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  ocupacion: z.string().nullable().optional(),
  contactoEmergencia: z.string().nullable().optional(),
  peso: z.union([z.string(), z.number()]).nullable().optional(),

  // Campos de anamnesis clínica (se completan progresivamente en la Ficha)
  alergias: z.string().nullable().optional(),
  enfermedades: z.string().nullable().optional(),
  medicamentos: z.string().nullable().optional(),
  habitos: z.string().nullable().optional(),
  examenExtraoral: z.string().nullable().optional(),
  examenIntraoral: z.string().nullable().optional(),
  presionArterial: z.string().nullable().optional(),
  riesgoCariogenico: z.string().nullable().optional(),
  riesgoPeriodontal: z.string().nullable().optional(),
  motivoConsulta: z.string().nullable().optional(),
  anamnesisProxima: z.string().nullable().optional(),

  // Campo de origen "paciente exprés" desde Agenda (F2-02b)
  fechaIngreso: z.string().nullable().optional(),

  // F3-06: campo agregado en migración v1 → v2
  notas: z.string().nullable().optional(),

  // BP06: Nuevos campos demográficos, clínicos y administrativos
  nombreCompleto: z.string().optional(),
  fechaNacimiento: z.string().optional(),
  sexo: z.enum(['masculino', 'femenino', 'otro']).optional(),
  telefonoSecundario: z.string().optional(),
  comuna: z.string().optional(),
  region: z.string().optional(),
  alergiasSeveras: z.array(z.string()).optional(),
  enfermedadesCronicas: z.array(z.string()).optional(),
  medicamentosActuales: z.array(z.string()).optional(),
  antecedentesQuirurgicos: z.string().optional(),
  embarazo: z.boolean().optional(),
  lactancia: z.boolean().optional(),
  anticoagulantes: z.boolean().optional(),
  estado: z.enum(['activo', 'inactivo', 'bloqueado', 'nuevo']).optional(),
  fechaCreacion: z.string().optional(),
  fechaUltimaVisita: z.string().optional(),
  diasSinVisita: z.number().optional(),
  tutorLegal: z.object({
    nombre: z.string(),
    rut: z.string(),
    relacion: z.string(),
    telefono: z.string()
  }).optional(),
  doctorTratanteId: z.string().optional(),
  etiquetas: z.array(z.string()).optional(),
  notasAdmin: z.string().optional(),
  clinicaId: z.string().optional(),
  version: z.number().optional()
}).passthrough()

export type Paciente = z.infer<typeof pacienteSchema>

export const listaPacientesSchema = z.array(pacienteSchema)

export type ValidacionListaPacientes = {
  valido: boolean
  datos: Paciente[] | null
  error: z.ZodError | null
}

export type ValidacionPaciente = {
  valido: boolean
  datos: Paciente | null
  error: z.ZodError | null
}

/**
 * Valida un arreglo de pacientes. No lanza excepción — retorna un resultado
 * explícito para que el llamador decida qué hacer, evitando que un dato
 * corrupto tumbe la app entera con una excepción no capturada a mitad de un
 * guardado (Cap. V.2 Constitución: nunca fallar en silencio, pero tampoco
 * de forma descontrolada).
 */
export const validarListaPacientes = (pacientes: unknown): ValidacionListaPacientes => {
  const resultado = listaPacientesSchema.safeParse(pacientes)
  if (resultado.success) {
    return { valido: true, datos: resultado.data, error: null }
  }
  return { valido: false, datos: null, error: resultado.error }
}

/**
 * Valida un único objeto paciente.
 */
export const validarPaciente = (paciente: unknown): ValidacionPaciente => {
  const resultado = pacienteSchema.safeParse(paciente)
  if (resultado.success) {
    return { valido: true, datos: resultado.data, error: null }
  }
  return { valido: false, datos: null, error: resultado.error }
}

/**
 * Valida que un RUT no exista ya en la clínica (unicidad por clínica).
 * F6-G: verificación de duplicados antes de guardar.
 *
 * @param rut - RUT a verificar
 * @param pacientes - Lista actual de pacientes
 * @param pacienteId - ID del paciente actual (para excluir de la comparación en edición)
 * @returns true si el RUT está duplicado
 */
export const rutDuplicado = (
  rut: string | null | undefined,
  pacientes: unknown,
  pacienteId: string | number | null = null
): boolean => {
  if (!rut || !Array.isArray(pacientes)) return false
  const normalizado = normalizarRut(rut)
  return pacientes.some((p: unknown) => {
    if (typeof p !== 'object' || p === null) return false
    const pac = p as { id?: string | number; rut?: string }
    if (pacienteId != null && pac.id === pacienteId) return false
    return Boolean(pac.rut && normalizarRut(pac.rut) === normalizado)
  })
}
