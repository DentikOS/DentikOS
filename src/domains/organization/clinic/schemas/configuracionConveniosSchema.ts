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

const precioEspecificoSchema = z.object({
  prestacionId: z.string().trim().min(1).max(80),
  alcance: z.enum(['convenio', 'sucursal']),
  contextoId: z.string().trim().min(1).max(80),
  precio: z.number().int().min(0).max(2_147_483_647),
}).strict()

export const configuracionConveniosSchema = z.object({
  version: z.literal(1),
  categorias: z.array(categoriaConvenioSchema).max(50),
  convenios: z.array(convenioSchema).max(100),
  preciosEspecificos: z.array(precioEspecificoSchema).max(5000).optional(),
}).strict().superRefine((configuracion, ctx) => {
  const idsCategorias = new Set<string>()
  const nombresCategorias = new Set<string>()
  const especialidades = new Set<string>()
  const idsConvenios = new Set<string>()
  const clavesPrecios = new Set<string>()

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

  configuracion.preciosEspecificos?.forEach((precio, index) => {
    const clave = `${precio.prestacionId}:${precio.alcance}:${precio.contextoId}`
    if (clavesPrecios.has(clave)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['preciosEspecificos', index], message: 'No repitas precios para la misma prestación y contexto.' })
    }
    clavesPrecios.add(clave)
    if (precio.alcance === 'convenio' && !idsConvenios.has(precio.contextoId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['preciosEspecificos', index, 'contextoId'], message: 'El precio referencia un convenio inexistente.' })
    }
  })
})

export type CategoriaConvenio = z.infer<typeof categoriaConvenioSchema>
export type ConvenioClinica = z.infer<typeof convenioSchema>
export type PrecioEspecificoPrestacion = z.infer<typeof precioEspecificoSchema>
export type ConfiguracionConvenios = z.infer<typeof configuracionConveniosSchema>

export interface PrecioPrestacionCalculado {
  precioBase: number
  precio: number
  descuentoPct: number
  origen: 'convenio-precio-fijo' | 'convenio-categoria' | 'sucursal' | 'catalogo'
}

export const crearConfiguracionConveniosVacia = (): ConfiguracionConvenios => ({
  version: 1,
  categorias: CATEGORIAS_CONVENIO_DEFAULT.map((categoria) => ({
    ...categoria,
    especialidades: [...categoria.especialidades],
  })),
  convenios: [],
  preciosEspecificos: [],
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

export const resolverPrecioPrestacion = (
  configuracion: unknown,
  input: {
    prestacionId: string | number
    especialidad?: string | null
    convenioIdentificador?: string | null
    tipoConvenio?: ConvenioClinica['tipo']
    sucursalId?: string | null
    precioParticular: number
    precioFonasa?: number
  },
): PrecioPrestacionCalculado => {
  const config = leerConfiguracionConvenios(configuracion)
  const particular = Number.isSafeInteger(input.precioParticular) && input.precioParticular >= 0
    ? input.precioParticular
    : 0
  const conveniosCoincidentes = input.convenioIdentificador
    ? config?.convenios.filter((convenio) => convenio.activo && (
        normalizarClave(convenio.id) === normalizarClave(input.convenioIdentificador || '') ||
        normalizarClave(convenio.nombre) === normalizarClave(input.convenioIdentificador || '')
      )) ?? []
    : []
  const convenioId = conveniosCoincidentes.length === 1 ? conveniosCoincidentes[0].id : undefined
  const precios = config?.preciosEspecificos ?? []
  const idPrestacion = String(input.prestacionId)

  if (convenioId) {
    const precioConvenio = precios.find((precio) =>
      precio.prestacionId === idPrestacion && precio.alcance === 'convenio' && precio.contextoId === convenioId
    )
    if (precioConvenio) {
      return { precioBase: precioConvenio.precio, precio: precioConvenio.precio, descuentoPct: 0, origen: 'convenio-precio-fijo' }
    }

    const convenio = config?.convenios.find((item) => item.id === convenioId)
    const especialidad = normalizarClave(input.especialidad || '')
    const categoria = config?.categorias.find((item) =>
      item.especialidades.some((itemEspecialidad) => normalizarClave(itemEspecialidad) === especialidad)
    )
    const porcentaje = categoria ? convenio?.descuentosPorCategoria[categoria.id] : undefined
    if (porcentaje !== undefined && Number.isFinite(porcentaje) && porcentaje > 0 && porcentaje <= 100) {
      return {
        precioBase: particular,
        precio: Math.round(particular * (1 - porcentaje / 100)),
        descuentoPct: porcentaje,
        origen: 'convenio-categoria',
      }
    }
  }

  if (input.sucursalId) {
    const precioSucursal = precios.find((precio) =>
      precio.prestacionId === idPrestacion && precio.alcance === 'sucursal' && precio.contextoId === input.sucursalId
    )
    if (precioSucursal) {
      return { precioBase: precioSucursal.precio, precio: precioSucursal.precio, descuentoPct: 0, origen: 'sucursal' }
    }
  }

  const convenio = convenioId ? config?.convenios.find((item) => item.id === convenioId) : undefined
  const fonasa = convenio?.tipo === 'fonasa' || input.tipoConvenio === 'fonasa'
  const precioFonasa = input.precioFonasa
  const precioFonasaValido = typeof precioFonasa === 'number' && Number.isSafeInteger(precioFonasa) && precioFonasa >= 0
  const precioBase = fonasa && precioFonasaValido ? precioFonasa : particular
  return { precioBase, precio: precioBase, descuentoPct: 0, origen: 'catalogo' }
}
