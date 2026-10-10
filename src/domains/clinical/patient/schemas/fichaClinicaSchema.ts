import { z } from 'zod'

export const fichaClinicaSchema = z.object({
  id: z.union([z.string(), z.number()]),
  pacienteId: z.union([z.string(), z.number()]),
  clinicaId: z.string().optional(),

  odontograma: z.array(z.object({
    piezaId: z.number(),
    cara: z.enum(['oclusal', 'mesial', 'distal', 'vestibular', 'lingual']),
    estado: z.string(),
    fechaRegistro: z.string().optional(),
    profesional: z.string().optional(),
    notas: z.string().optional()
  })).default([]),

  periodontograma: z.array(z.object({
    piezaId: z.number(),
    sondaje: z.object({
      mv: z.number(), v: z.number(), dv: z.number(),
      ml: z.number(), l: z.number(), dl: z.number()
    }).optional(),
    sangrado: z.object({
      mv: z.boolean(), v: z.boolean(), dv: z.boolean(),
      ml: z.boolean(), l: z.boolean(), dl: z.boolean()
    }).optional(),
    movilidad: z.enum(['ninguna', 'grado1', 'grado2', 'grado3']).optional(),
    recesion: z.number().optional()
  })).default([]),

  evoluciones: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    fecha: z.string(),
    profesional: z.string(),
    motivo: z.string(),
    procedimiento: z.string(),
    piezas: z.array(z.number()).optional(),
    materiales: z.array(z.string()).optional(),
    anestesia: z.string().optional(),
    indicaciones: z.string().optional(),
    firmaHash: z.string().optional()
  })).default([]),

  recetas: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    fecha: z.string(),
    profesional: z.string(),
    medicamentos: z.array(z.object({
      nombre: z.string(),
      dosis: z.string(),
      frecuencia: z.string(),
      duracion: z.string()
    })),
    indicaciones: z.string().optional(),
    firmaHash: z.string().optional(),
    qrCode: z.string().optional()
  })).default([]),

  consentimientos: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    tipo: z.string(),
    fecha: z.string(),
    paciente: z.string(),
    firmaHash: z.string().optional(),
    documentoUrl: z.string().optional()
  })).default([]),

  planTratamiento: z.object({
    fases: z.array(z.object({
      id: z.union([z.string(), z.number()]),
      nombre: z.string(),
      estado: z.enum(['pendiente', 'en-progreso', 'completada']),
      procedimientos: z.array(z.object({
        id: z.union([z.string(), z.number()]),
        descripcion: z.string(),
        pieza: z.number().optional(),
        costo: z.number().optional(),
        estado: z.enum(['pendiente', 'aprobado', 'realizado', 'cancelado'])
      }))
    })).default([])
  }).optional(),

  timeline: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    fecha: z.string(),
    tipo: z.string(),
    descripcion: z.string(),
    profesional: z.string(),
    hash: z.string().optional()
  })).default([]),

  version: z.number().optional().default(1)
}).passthrough()

export type FichaClinica = z.infer<typeof fichaClinicaSchema>
