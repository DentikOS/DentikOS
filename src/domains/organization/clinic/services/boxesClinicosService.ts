import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { sedesService } from './sedesService'
import { type BoxClinico, boxClinicoSchema } from '../schemas/boxSchema'

const log = createLogger('boxesClinicosService')
const KEY_BOXES = 'clinica_boxes_clinicos'
const EVENT_BOXES_ACTUALIZADOS = 'boxes_clinicos_actualizados'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const boxesRepo = createTenantRepository<BoxClinico[]>(KEY_BOXES, [], { notify: true })

type BoxRow = {
  id: string
  clinica_id: string
  sucursal_id: string
  nombre: string
  tipo: BoxClinico['tipo']
  unidad_dental: string
  anio_instalacion: number | null
  equipamiento: unknown
  notas: string | null
  estado: BoxClinico['estado']
  created_at?: string
  updated_at?: string
}

const crearUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0
    return (character === 'x' ? random : (random & 0x3 | 0x8)).toString(16)
  })
}

const desdeFila = (row: BoxRow): BoxClinico | null => {
  const parsed = boxClinicoSchema.safeParse({
    id: row.id,
    clinicaId: row.clinica_id,
    sucursalId: row.sucursal_id,
    nombre: row.nombre,
    tipo: row.tipo,
    unidadDental: row.unidad_dental,
    anioInstalacion: row.anio_instalacion,
    equipamiento: Array.isArray(row.equipamiento) ? row.equipamiento : [],
    notas: row.notas || '',
    estado: row.estado,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
  return parsed.success ? parsed.data : null
}

const aFila = (box: BoxClinico, clinicaId: string, sucursalId: string): Omit<BoxRow, 'created_at' | 'updated_at'> & { updated_at: string } => ({
  id: box.id || crearUuid(),
  clinica_id: clinicaId,
  sucursal_id: sucursalId,
  nombre: box.nombre.trim(),
  tipo: box.tipo,
  unidad_dental: box.unidadDental.trim(),
  anio_instalacion: box.anioInstalacion || null,
  equipamiento: box.equipamiento,
  notas: box.notas?.trim() || null,
  estado: box.estado,
  updated_at: new Date().toISOString(),
})

const emitirCambio = (clinicaId: string): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_BOXES_ACTUALIZADOS, { detail: { clinicaId } }))
  }
}

const guardarCache = (boxes: BoxClinico[], clinicaId: string): void => {
  if (!boxesRepo.guardar(boxes)) throw new Error('No se pudo guardar la copia local de boxes.')
  emitirCambio(clinicaId)
}

const obtenerContexto = (sucursalId?: string): { clinicaId: string; sucursalId?: string } => {
  const clinicaId = getClinicaActivaSync()
  if (!clinicaId || !UUID_RE.test(clinicaId)) throw new Error('No se pudo identificar la clínica activa.')
  if (sucursalId) {
    const pertenece = sedesService.obtenerSedes().some((sede) => sede.id === sucursalId && sede.clinicaId === clinicaId)
    if (!UUID_RE.test(sucursalId) || !pertenece) throw new Error('La sucursal no pertenece a la clínica activa.')
  }
  return { clinicaId, sucursalId }
}

const verificarTenantActivo = (clinicaId: string): void => {
  if (getClinicaActivaSync() !== clinicaId) {
    throw new Error('La clínica activa cambió durante la sincronización. Vuelve a cargar los boxes.')
  }
}

const sincronizarNube = async (clinicaId: string): Promise<BoxClinico[]> => {
  if (!supabase) throw new Error('No hay conexión con la nube para sincronizar boxes.')
  const { data, error } = await supabase
    .from('boxes_clinicos')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('nombre')
  if (error) {
    log.warn('No se pudieron sincronizar los boxes de la clínica.')
    throw new Error('No se pudieron sincronizar los boxes. Verifica la conexión y los permisos.')
  }
  verificarTenantActivo(clinicaId)
  const filas = (data || []) as unknown as BoxRow[]
  const parseados = filas.map(desdeFila)
  if (parseados.some((box) => box === null)) {
    log.warn('La nube devolvió un box con datos no válidos.')
    throw new Error('La nube devolvió un box con datos incompletos. No se reemplazó la copia local.')
  }
  const boxes = parseados as BoxClinico[]
  guardarCache(boxes, clinicaId)
  return boxes
}

const validarEntrada = (entrada: unknown): BoxClinico => {
  const resultado = boxClinicoSchema.safeParse(entrada)
  if (!resultado.success) throw new Error(resultado.error.issues[0]?.message || 'Los datos del box no son válidos.')
  return resultado.data
}

const boxService = {
  obtenerBoxes: (sucursalId?: string): BoxClinico[] => {
    try {
      const { clinicaId } = obtenerContexto(sucursalId)
      const cache = boxesRepo.obtener([])
      if (!Array.isArray(cache)) return []
      return cache
        .flatMap((box) => {
          const parsed = boxClinicoSchema.safeParse(box)
          return parsed.success && parsed.data.clinicaId === clinicaId ? [parsed.data] : []
        })
        .filter((box) => !sucursalId || box.sucursalId === sucursalId)
    } catch {
      return []
    }
  },

  sincronizarDesdeSupabase: async (): Promise<BoxClinico[]> => {
    const { clinicaId } = obtenerContexto()
    if (!USE_SUPABASE) return boxService.obtenerBoxes()
    return sincronizarNube(clinicaId)
  },

  crear: async (sucursalIdEntrada: string, datos: Omit<BoxClinico, 'id' | 'clinicaId' | 'sucursalId'>): Promise<BoxClinico> => {
    const { clinicaId, sucursalId } = obtenerContexto(sucursalIdEntrada)
    const box = validarEntrada({ ...datos, id: crearUuid(), clinicaId, sucursalId })
    if (!USE_SUPABASE) {
      guardarCache([...boxService.obtenerBoxes(), box], clinicaId)
      return box
    }
    if (!supabase) throw new Error('No hay conexión con la nube para guardar el box.')
    const { data, error } = await supabase.from('boxes_clinicos').insert(aFila(box, clinicaId, sucursalId!)).select('*').single()
    if (error || !data) {
      log.warn('No se pudo crear el box en la nube.')
      if (error?.code === '23505') throw new Error('Ya existe un box activo con ese nombre en esta sucursal.')
      throw new Error('No se pudo crear el box. Verifica tus permisos y vuelve a intentarlo.')
    }
    verificarTenantActivo(clinicaId)
    const creado = desdeFila(data as unknown as BoxRow)
    if (!creado) throw new Error('El box guardado no devolvió datos válidos.')
    guardarCache([...boxService.obtenerBoxes(), creado], clinicaId)
    return creado
  },

  actualizar: async (id: string, updates: Partial<BoxClinico>): Promise<BoxClinico> => {
    const { clinicaId } = obtenerContexto()
    if (!UUID_RE.test(id)) throw new Error('El identificador del box no es válido.')
    const existente = boxService.obtenerBoxes().find((box) => box.id === id && box.clinicaId === clinicaId)
    if (!existente) throw new Error('No se encontró el box dentro de la clínica activa.')
    if (updates.sucursalId && updates.sucursalId !== existente.sucursalId) {
      throw new Error('No se puede mover un box a otra sucursal. Crea un box en la sucursal de destino.')
    }
    const actualizado = validarEntrada({ ...existente, ...updates, id, clinicaId, sucursalId: existente.sucursalId })
    if (!USE_SUPABASE) {
      guardarCache(boxService.obtenerBoxes().map((box) => box.id === id ? actualizado : box), clinicaId)
      return actualizado
    }
    if (!supabase) throw new Error('No hay conexión con la nube para actualizar el box.')
    const { data, error } = await supabase
      .from('boxes_clinicos')
      .update(aFila(actualizado, clinicaId, existente.sucursalId))
      .eq('id', id)
      .eq('clinica_id', clinicaId)
      .select('*')
      .maybeSingle()
    if (error || !data) {
      log.warn('No se pudo actualizar el box en la nube.')
      if (error?.code === '23505') throw new Error('Ya existe un box activo con ese nombre en esta sucursal.')
      throw new Error('No se pudo actualizar el box. Verifica tus permisos y vuelve a intentarlo.')
    }
    verificarTenantActivo(clinicaId)
    const resultado = desdeFila(data as unknown as BoxRow)
    if (!resultado) throw new Error('El box actualizado no devolvió datos válidos.')
    guardarCache(boxService.obtenerBoxes().map((box) => box.id === id ? resultado : box), clinicaId)
    return resultado
  },

  suscribirCambios: (clinicaId: string, alCambiar: () => void): (() => void) => {
    if (!USE_SUPABASE || !supabase || !clinicaId) return () => {}
    const channel = supabase.channel(`boxes_clinicos_${clinicaId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'boxes_clinicos', filter: `clinica_id=eq.${clinicaId}`,
      }, alCambiar)
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  },
}

export { boxService as boxesClinicosService }
