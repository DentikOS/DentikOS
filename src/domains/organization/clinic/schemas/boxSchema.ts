import { z } from 'zod'
import { EQUIPAMIENTO_CLINICO, EQUIPAMIENTO_CLINICO_IDS } from '../../../../shared/constants/equipamientoClinico'

export const TIPOS_BOX = ['general', 'cirugia', 'ortodoncia'] as const
export const ESTADOS_BOX = ['activo', 'inactivo', 'mantenimiento'] as const
export const EQUIPAMIENTO_BOX = EQUIPAMIENTO_CLINICO

export const equipoBoxSchema = z.object({
  tipo: z.enum(EQUIPAMIENTO_CLINICO_IDS),
  marca: z.string().trim().max(120, 'La marca no puede superar 120 caracteres').optional().default(''),
  serial: z.string().trim().max(100, 'El número de serie no puede superar 100 caracteres').optional().default(''),
})

export const boxClinicoSchema = z.object({
  id: z.string().uuid().optional(),
  clinicaId: z.string().uuid(),
  sucursalId: z.string().uuid(),
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  tipo: z.enum(TIPOS_BOX),
  unidadDental: z.string().trim().min(2, 'Indica la unidad dental').max(120),
  anioInstalacion: z.number().int().min(1900).max(2100).optional().nullable(),
  equipamiento: z.array(equipoBoxSchema).max(EQUIPAMIENTO_BOX.length).default([])
    .refine((items) => new Set(items.map((item) => item.tipo)).size === items.length, 'No repitas un tipo de equipamiento.'),
  notas: z.string().trim().max(1000, 'Las notas no pueden superar 1000 caracteres').optional().default(''),
  estado: z.enum(ESTADOS_BOX).default('activo'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type TipoBox = typeof TIPOS_BOX[number]
export type EstadoBox = typeof ESTADOS_BOX[number]
export type EquipoBox = z.infer<typeof equipoBoxSchema>
export type BoxClinico = z.infer<typeof boxClinicoSchema>
