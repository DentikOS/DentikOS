import { z } from 'zod'
import { esZonaHorariaIanaValida } from '../utils/timeZoneUtils'

export const ESTADOS_SEDE = ['activa', 'inactiva', 'remodelacion'] as const

export const horarioSedeSchema = z.object({
  diaSemana: z.number().int().min(0).max(6),
  cerrado: z.boolean(),
  horaApertura: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  horaCierre: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
}).refine((horario) => {
  if (horario.cerrado) return true
  return Boolean(horario.horaApertura && horario.horaCierre && horario.horaCierre > horario.horaApertura)
}, 'La hora de cierre debe ser posterior a la apertura')

export const sedeSchema = z.object({
  id: z.string().uuid().optional(),
  clinicaId: z.string().optional(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  direccion: z.string().min(5, 'La dirección debe tener al menos 5 caracteres'),
  comuna: z.string().min(2, 'La comuna es obligatoria'),
  region: z.string().min(2, 'La región es obligatoria'),
  telefono: z.string().optional(),
  email: z.union([z.string().email('El email no es válido'), z.literal('')]).optional(),
  zonaHoraria: z.string().min(1, 'La zona horaria es obligatoria').refine(esZonaHorariaIanaValida, 'Usa una zona horaria IANA válida').optional(),
  horariosAtencion: z.array(horarioSedeSchema).optional(),
  estado: z.enum(ESTADOS_SEDE).optional(),
  // Se conserva por compatibilidad con el modelo local existente.
  horario: z.string().optional(),
  activa: z.boolean().default(true),
})

export type Sede = z.infer<typeof sedeSchema>
export type EstadoSede = typeof ESTADOS_SEDE[number]
export type HorarioSede = z.infer<typeof horarioSedeSchema>
