/**
 * Utilidades puras para evaluación de inventario, alertas y descuento de stock
 */

export interface EstadoStockInfo {
  id: 'agotado' | 'critico' | 'bajo' | 'normal'
  texto: string
  colorBg: string
  colorText: string
}

export interface EstadoVencimientoInfo {
  diasRestantes: number
  estado: 'vencido' | 'por_vencer' | 'por_vencer_90' | 'ok'
  texto: string
}

export interface ItemInventarioCalculo {
  id?: string | number
  nombre?: string
  cantidad?: number | string | null
  stockActual?: number | string | null
  minimoCritico?: number | string | null
  stockMinimo?: number | string | null
  fechaVencimiento?: string | null
  precioUnitario?: number | string | null
  precio?: number | string | null
  [key: string]: unknown
}

export interface InsumoPrestacionDefault {
  nombreInsumo?: string
  cantidad: number
  unidad?: string
  itemId?: string | number | null
  [key: string]: unknown
}

export interface MaterialSeleccionado {
  itemId?: string | number
  cantidad?: number | string
  [key: string]: unknown
}

export const evaluarEstadoStock = (item: ItemInventarioCalculo): EstadoStockInfo => {
  const cantidad = parseFloat(String(item.cantidad ?? item.stockActual)) || 0
  const minimo = parseFloat(String(item.minimoCritico ?? item.stockMinimo)) || 0

  if (cantidad === 0) {
    return { id: 'agotado', texto: 'Agotado', colorBg: 'bg-red-100', colorText: 'text-red-900' }
  }
  if (minimo > 0 && cantidad <= minimo * 0.25) {
    return { id: 'critico', texto: 'Stock Crítico', colorBg: 'bg-red-100', colorText: 'text-red-900' }
  }
  if (minimo > 0 && cantidad <= minimo) {
    return { id: 'bajo', texto: 'Bajo mínimo', colorBg: 'bg-amber-100', colorText: 'text-amber-900' }
  }
  return { id: 'normal', texto: 'Normal', colorBg: 'bg-emerald-100', colorText: 'text-emerald-900' }
}

export const evaluarVencimiento = (fechaVencimiento?: string | null): EstadoVencimientoInfo => {
  if (!fechaVencimiento) return { diasRestantes: 999, estado: 'ok', texto: 'Vigente' }

  const hoy = new Date()
  const fechaVenc = new Date(fechaVencimiento)
  const diferenciaTiempo = fechaVenc.getTime() - hoy.getTime()
  const diasRestantes = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24))

  if (diasRestantes < 0) {
    return { diasRestantes, estado: 'vencido', texto: 'Vencido' }
  }
  if (diasRestantes <= 30) {
    return { diasRestantes, estado: 'por_vencer', texto: `Vence en ${diasRestantes} días` }
  }
  if (diasRestantes <= 90) {
    return { diasRestantes, estado: 'por_vencer_90', texto: `Vence en ${diasRestantes} días` }
  }
  return { diasRestantes, estado: 'ok', texto: 'Vigente' }
}

export const calcularResumenInventario = (items: ItemInventarioCalculo[] = []) => {
  const totalInsumos = items.length
  let stockCriticoCount = 0
  let stockBajoCount = 0
  let agotadosCount = 0
  let porVencerCount = 0
  let valorTotalInventario = 0

  items.forEach((item) => {
    const estadoStock = evaluarEstadoStock(item)
    if (estadoStock.id === 'critico') stockCriticoCount++
    if (estadoStock.id === 'bajo') stockBajoCount++
    if (estadoStock.id === 'agotado') agotadosCount++

    const estadoVenc = evaluarVencimiento(item.fechaVencimiento)
    if (estadoVenc.estado === 'por_vencer' || estadoVenc.estado === 'por_vencer_90' || estadoVenc.estado === 'vencido') {
      porVencerCount++
    }

    const cant = parseFloat(String(item.cantidad ?? item.stockActual)) || 0
    const precio = parseFloat(String(item.precioUnitario ?? item.precio)) || 0
    valorTotalInventario += cant * precio
  })

  return {
    totalInsumos,
    stockCriticoCount,
    stockBajoCount,
    agotadosCount,
    porVencerCount,
    valorTotalInventario
  }
}

/**
 * Diccionario semilla de asociaciones tratamiento→material.
 */
export const INSUMOS_POR_PRESTACION_DEFAULT: Record<string, InsumoPrestacionDefault[]> = {
  Operatoria: [
    { nombreInsumo: 'Resina Compuesta A2/A3', cantidad: 0.04, unidad: 'Jeringa/Dosis' },
    { nombreInsumo: 'Adhesivo Dental Universal', cantidad: 0.02, unidad: 'Gota/Dosis' },
    { nombreInsumo: 'Kit de Examen & Babero Disposables', cantidad: 1, unidad: 'Set' }
  ],
  Endodoncia: [
    { nombreInsumo: 'Limas de Endodoncia Rotatorias', cantidad: 0.1, unidad: 'Pieza' },
    { nombreInsumo: 'Hipoclorito de Sodio 5.25%', cantidad: 0.1, unidad: 'Jeringa/Irrigación' },
    { nombreInsumo: 'Conos de Gutapercha', cantidad: 1, unidad: 'Set' }
  ],
  Cirugia: [
    { nombreInsumo: 'Cartucho Anestesia Lidocaína/Epinefrina', cantidad: 2, unidad: 'Tubo' },
    { nombreInsumo: 'Hoja de Bisturí #15', cantidad: 1, unidad: 'Unidad' },
    { nombreInsumo: 'Hilo de Sutura Seda/Nylon 3-0', cantidad: 1, unidad: 'Unidad' }
  ],
  Limpieza: [
    { nombreInsumo: 'Pasta Profiláctica + Cepillo', cantidad: 1, unidad: 'Dosis' },
    { nombreInsumo: 'Eyector de Saliva Disposables', cantidad: 2, unidad: 'Unidad' }
  ]
}

/**
 * Palabras clave por categoría para detectar automáticamente la categoría
 */
export const PALABRAS_CLAVE_POR_CATEGORIA_DEFAULT: Record<string, string[]> = {
  Operatoria: [],
  Endodoncia: ['endo', 'conducto'],
  Cirugia: ['exodoncia', 'cirugía', 'cirugia', 'implante'],
  Limpieza: ['limpieza', 'destartraje', 'profilaxis']
}

/**
 * Detecta la categoría de tratamiento según el nombre de la prestación.
 */
export const detectarCategoriaTratamiento = (
  nombrePrestacion = '',
  asociaciones: Record<string, InsumoPrestacionDefault[]> | Record<string, unknown[]> = {},
  palabrasClave: Record<string, string[]> = {}
): string => {
  const nombreLower = nombrePrestacion.toLowerCase()

  for (const [categoria, palabras] of Object.entries(palabrasClave)) {
    if (Array.isArray(palabras) && palabras.length > 0 && (asociaciones as Record<string, unknown>)[categoria]) {
      const coincide = palabras.some((p) => nombreLower.includes(p.toLowerCase()))
      if (coincide) return categoria
    }
  }

  const categoriasDisponibles = Object.keys(asociaciones)
  if (categoriasDisponibles.includes('Operatoria')) return 'Operatoria'
  return categoriasDisponibles[0] || 'Operatoria'
}

/**
 * Descuenta stock del inventario según la prestación realizada.
 */
export const descontarStockPorTratamiento = <T extends ItemInventarioCalculo>(
  inventarioActual: T[] = [],
  nombrePrestacion = '',
  asociaciones: Record<string, InsumoPrestacionDefault[]> | null = null
): T[] => {
  const asociacionesEfectivas = asociaciones || INSUMOS_POR_PRESTACION_DEFAULT

  const nombreLower = nombrePrestacion.toLowerCase()
  let categoriaCoincidente = 'Operatoria'

  if (nombreLower.includes('endo') || nombreLower.includes('conducto')) {
    categoriaCoincidente = 'Endodoncia'
  } else if (
    nombreLower.includes('exodoncia') ||
    nombreLower.includes('cirugía') ||
    nombreLower.includes('implante')
  ) {
    categoriaCoincidente = 'Cirugia'
  } else if (
    nombreLower.includes('limpieza') ||
    nombreLower.includes('destartraje') ||
    nombreLower.includes('profilaxis')
  ) {
    categoriaCoincidente = 'Limpieza'
  }

  const insumosARebajar =
    asociacionesEfectivas[categoriaCoincidente] || asociacionesEfectivas.Operatoria || []

  const inventarioActualizado = inventarioActual.map((item) => {
    let coincidencia = insumosARebajar.find(
      (ins) => ins.itemId && String(ins.itemId) === String(item.id)
    )

    if (!coincidencia) {
      coincidencia = insumosARebajar.find(
        (ins) =>
          !ins.itemId &&
          ((item.nombre || '').toLowerCase().includes((ins.nombreInsumo || '').toLowerCase()) ||
            (ins.nombreInsumo || '').toLowerCase().includes((item.nombre || '').toLowerCase()))
      )
    }

    if (coincidencia) {
      const stockPrev = parseFloat(String(item.cantidad ?? item.stockActual)) || 0
      const nuevoStock = Math.max(0, stockPrev - coincidencia.cantidad)
      return { ...item, cantidad: nuevoStock, stockActual: nuevoStock }
    }
    return item
  })

  return inventarioActualizado
}

/**
 * Descuenta stock del inventario según los materiales seleccionados manualmente.
 */
export const descontarMaterialesSeleccionados = <T extends ItemInventarioCalculo>(
  inventarioActual: T[] = [],
  materialesSeleccionados: MaterialSeleccionado[] | unknown[] = []
): T[] => {
  if (!Array.isArray(materialesSeleccionados) || materialesSeleccionados.length === 0) {
    return inventarioActual
  }

  const matList = materialesSeleccionados as MaterialSeleccionado[]

  return inventarioActual.map((item) => {
    const materialSel = matList.find(
      (m) => String(m.itemId) === String(item.id)
    )

    if (materialSel) {
      const stockPrev = parseFloat(String(item.cantidad ?? item.stockActual)) || 0
      const cantidadADescontar = parseFloat(String(materialSel.cantidad)) || 0
      const nuevoStock = Math.max(0, stockPrev - cantidadADescontar)
      return { ...item, cantidad: nuevoStock, stockActual: nuevoStock }
    }
    return item
  })
}
