import { z } from 'zod'

export const CATEGORIAS_CONVENIO_DEFAULT = [
  { id: 'preventivo', nombre: 'Preventivo', especialidades: [] },
  { id: 'restaurador', nombre: 'Restaurador', especialidades: [] },
  { id: 'cirugia', nombre: 'Cirugía', especialidades: [] },
  { id: 'ortodoncia', nombre: 'Ortodoncia', especialidades: [] },
  { id: 'periodoncia', nombre: 'Periodoncia', especialidades: [] },
  { id: 'endodoncia', nombre: 'Endodoncia', especialidades: [] },
  { id: 'protesis', nombre: 'Prótesis', especialidades: [] },
  { id: 'implantologia', nombre: 'Implantología', especialidades: [] },
  { id: 'estetica', nombre: 'Estética', especialidades: [] },
  { id: 'urgencias', nombre: 'Urgencias', especialidades: [] },
  { id: 'diagnostico', nombre: 'Diagnóstico', especialidades: [] },
] as const

const porcentajeSchema = z.number().finite().min(0).max(100)

const categoriaConvenioSchema = z.object({
  id: z.string().trim().min(1).max(80),
  nombre: z.string().trim().min(1).max(100),
  especialidades: z.array(z.string().trim().min(1).max(100)).max(100),
}).strict()

const convenioSchema = z.object({
  id: z.string().trim().min(1).max(80),
  nombre: z.string().trim().min(1).max(120),
  tipo: z.enum(['isapre', 'fonasa', 'otro']),
  tramoFonasa: z.enum(['A', 'B', 'C', 'D']).optional(),
  activo: z.boolean(),
  descuentosPorCategoria: z.record(z.string(), porcentajeSchema),
}).strict().superRefine((convenio, ctx) => {
  if (convenio.tipo === 'fonasa' && !convenio.tramoFonasa) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tramoFonasa'], message: 'El tramo FONASA es obligatorio.' })
  }
  if (convenio.tipo !== 'fonasa' && convenio.tramoFonasa) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tramoFonasa'], message: 'Solo FONASA puede tener tramo.' })
  }
})

export const configuracionConveniosSchema = z.object({
  version: z.literal(1),
  categorias: z.array(categoriaConvenioSchema).max(50),
  convenios: z.array(convenioSchema).max(100),
}).strict().superRefine((configuracion, ctx) => {
  const idsCategorias = new Set<string>()
  const nombresCategorias = new Set<string>()
  const especialidades = new Set<string>()
  const idsConvenios = new Set<string>()

  configuracion.categorias.forEach((categoria, index) => {
    const nombre = categoria.nombre.toLocaleLowerCase('es-CL')
    if (idsCategorias.has(categoria.id) || nombresCategorias.has(nombre)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categorias', index], message: 'Las categorías deben tener IDs y nombres únicos.' })
    }
    idsCategorias.add(categoria.id)
    nombresCategorias.add(nombre)
    categoria.especialidades.forEach((especialidad) => {
      const clave = especialidad.toLocaleLowerCase('es-CL')
      if (especialidades.has(clave)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categorias', index, 'especialidades'], message: 'Cada especialidad puede pertenecer a una sola categoría.' })
      }
      especialidades.add(clave)
    })
  })

  configuracion.convenios.forEach((convenio, index) => {
    if (idsConvenios.has(convenio.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['convenios', index, 'id'], message: 'Los IDs de convenio deben ser únicos.' })
    }
    idsConvenios.add(convenio.id)
    for (const categoriaId of Object.keys(convenio.descuentosPorCategoria)) {
      if (!idsCategorias.has(categoriaId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['convenios', index, 'descuentosPorCategoria', categoriaId], message: 'La categoría de descuento no existe.' })
      }
    }
  })
})

export type CategoriaConvenio = z.infer<typeof categoriaConvenioSchema>
export type ConvenioClinica = z.infer<typeof convenioSchema>
export type ConfiguracionConvenios = z.infer<typeof configuracionConveniosSchema>

export const crearConfiguracionConveniosVacia = (): ConfiguracionConvenios => ({
  version: 1,
  categorias: CATEGORIAS_CONVENIO_DEFAULT.map((categoria) => ({
    ...categoria,
    especialidades: [...categoria.especialidades],
  })),
  convenios: [],
})

export const leerConfiguracionConvenios = (entrada: unknown): ConfiguracionConvenios | null => {
  if (entrada == null) return crearConfiguracionConveniosVacia()
  const resultado = configuracionConveniosSchema.safeParse(entrada)
  if (!resultado.success) return null

  return {
    ...resultado.data,
    categorias: resultado.data.categorias.length > 0
      ? resultado.data.categorias
      : crearConfiguracionConveniosVacia().categorias,
  }
}

const normalizarClave = (valor: string): string => valor.trim().toLocaleLowerCase('es-CL')

export const resolverDescuentoConvenio = (
  configuracion: unknown,
  convenioIdentificador?: string | null,
  especialidad?: string | null,
): number => {
  if (!convenioIdentificador || !especialidad) return 0
  const datos = leerConfiguracionConvenios(configuracion)
  if (!datos) return 0

  const identificador = normalizarClave(convenioIdentificador)
  const coincidencias = datos.convenios.filter((convenio) =>
    convenio.activo && (
      normalizarClave(convenio.id) === identificador ||
      normalizarClave(convenio.nombre) === identificador
    )
  )
  if (coincidencias.length !== 1) return 0

  const especialidadNormalizada = normalizarClave(especialidad)
  const categorias = datos.categorias.filter((categoria) =>
    categoria.especialidades.some((item) => normalizarClave(item) === especialidadNormalizada)
  )
  if (categorias.length !== 1) return 0

  const porcentaje = coincidencias[0].descuentosPorCategoria[categorias[0].id]
  return Number.isFinite(porcentaje) && porcentaje >= 0 && porcentaje <= 100 ? porcentaje : 0
}
