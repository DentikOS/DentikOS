import { z } from 'zod'

/**
 * Esquema de validación de cita (F2-04b — MASTER_ROADMAP).
 * Sigue el patrón establecido en `pacienteSchema.js` (F2-04).
 *
 * Campos obligatorios:
 * - `id`: identificador único (number o string, ej: Date.now() o "express_timestamp")
 * - `fecha`: fecha de la cita en formato ISO local "YYYY-MM-DD"
 * - `horaInicio`: hora de inicio en formato "HH:MM"
 * - `estado`: estado del ciclo de vida de la cita
 *
 * Campos opcionales:
 * - `pacienteId`: ID del paciente (puede faltar en bloqueos o citas sin paciente)
 * - `pacienteNombre`, `pacienteTelefono`, `pacienteRut`: datos del paciente
 *   (críticos en "paciente exprés" creado desde Agenda, F2-02b)
 * - `trataMiento`: motivo del tratamiento
 * - `boxAsignado`: box o sillón donde se atiende
 * - `horaInicioAtencion`: timestamp ISO cuando la cita pasa a "En Sillón"
 *
 * `.passthrough()` deliberado: igual que `pacienteSchema`, permite que el
 * objeto cita crezca con campos adicionales (ej: notas del profesional,
 * recordatorios enviados) sin romper guardados legítimos. El objetivo es
 * atrapar corrupción real (campos obligatorios ausentes) — no restringir
 * la forma exacta del objeto.
 */
export const citaSchema = z.object({
  // Campos obligatorios
  id: z.union([z.number(), z.string()]),
  fecha: z.string().trim().min(1, 'La fecha de la cita es obligatoria'),
  horaInicio: z.string().trim().min(1, 'La hora de inicio es obligatoria'),
  estado: z.string().trim().min(1, 'El estado de la cita es obligatorio'),

  // Datos del paciente (opcionales, pero comunes)
  pacienteId: z.union([z.number(), z.string()]).optional(),
  pacienteNombre: z.string().optional(),
  pacienteTelefono: z.union([z.string(), z.number()]).optional(),
  pacienteRut: z.string().optional(),

  // Detalles de la cita
  trataMiento: z.string().optional(),
  motivo: z.string().optional(),
  boxAsignado: z.string().optional(),
  horaInicioAtencion: z.string().optional(),
  horaFin: z.string().optional(),
  duracionMinutos: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90),
    z.literal(120),
    z.string().transform((val) => parseInt(val, 10))
  ]).optional(),
  doctor: z.string().optional(),
  observaciones: z.string().optional(),

  // Campos BP05 §02
  presupuestoAsociado: z.union([z.number(), z.string()]).nullable().optional(), // ID del presupuesto vinculado
  notasInternas: z.string().optional(), // Notas no visibles al paciente (Ley 20.584)

  esBloqueo: z.boolean().optional(),
  motivoBloqueo: z.string().optional(),

  // Recurrencia para bloqueos (BP05 §06)
  bloqueoRecurrencia: z.enum(['ninguna', 'diario', 'semanal', 'mensual']).optional(),
  bloqueoFechaFin: z.string().optional(), // YYYY-MM-DD
  bloqueoDiasSemana: z.array(z.number()).optional(), // [1, 2, 3, 4, 5] para Lun-Vie
  tipoBloqueoId: z.string().optional(),
  colorBloqueo: z.string().optional(),
  esInstanciaRecurrencia: z.boolean().optional(),
  bloqueoPadreId: z.union([z.number(), z.string()]).optional(),

  // Campos de recurrencia (BP05 & F7-27)
  recurrencia: z.enum(['ninguna', 'diario', 'semanal', 'quincenal', 'mensual', 'anual', 'personalizado']).optional(),
  frecuencia: z.number().int().positive().optional(), // cada X semanas/meses/años
  diaSemana: z.number().int().min(0).max(6).optional(), // 0-6 para recurrencia semanal
  diaMes: z.number().int().min(1).max(31).optional(), // 1-31 para recurrencia mensual
  fechaFin: z.string().optional(), // hasta cuándo repetir (YYYY-MM-DD)
  citaPadreId: z.union([z.number(), z.string()]).nullable().optional(), // ID de la cita original (para citas recurrentes)
  recurrence_group_id: z.string().optional(),
  confirmation_status: z.enum(['pendiente', 'enviado', 'confirmado', 'no_confirmado']).optional(),
}).passthrough()

export type Cita = z.infer<typeof citaSchema>

export const listaCitasSchema = z.array(citaSchema)

export type ValidacionListaCitas = {
  valido: boolean
  datos: Cita[] | null
  error: z.ZodError | null
}

/**
 * Valida un arreglo de citas. No lanza excepción — retorna un resultado
 * explícito para que el llamador decida qué hacer, evitando que un dato
 * corrupto tumbe la app entera con una excepción no capturada a mitad de
 * un guardado (Cap. V.2 Constitución: nunca fallar en silencio, pero
 * tampoco de forma descontrolada).
 *
 * @param {unknown} citas - Array de objetos cita a validar.
 * @returns {ValidacionListaCitas}
 */
export const validarListaCitas = (citas: unknown): ValidacionListaCitas => {
  const resultado = listaCitasSchema.safeParse(citas)
  if (resultado.success) {
    return { valido: true, datos: resultado.data, error: null }
  }
  return { valido: false, datos: null, error: resultado.error }
}
