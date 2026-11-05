import { createTenantRepository } from '../../../../infrastructure/storage/localStorageRepository'
import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { clinicStorageService } from './clinicStorageService'
import { type EstadoSede, type HorarioSede, type Sede, sedeSchema } from '../schemas/sedeSchema'

const log = createLogger('sedesService')
const KEY_SEDES = 'clinica_sedes'
const KEY_SEDE_ACTIVA = 'clinica_sede_activa'
const EVENT_SEDES_ACTUALIZADAS = 'sucursales_actualizadas'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const sedesRepo = createTenantRepository<Sede[]>(KEY_SEDES, [], { notify: true })
const sedeActivaRepo = createTenantRepository<string | null>(KEY_SEDE_ACTIVA, null, { notify: true })
const obtenerZonaHorariaClinica = (): string => clinicStorageService.obtenerClinica()?.zonaHoraria || 'America/Santiago'

type SedeRow = {
  id: string
  clinica_id: string
  nombre: string
  direccion: string
  comuna: string
  region: string
  telefono: string | null
  email: string | null
  zona_horaria: string | null
  horarios_atencion: unknown
  estado: EstadoSede
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

const normalizarSede = (entrada: Partial<Sede> & Record<string, unknown>, clinicaId?: string): Sede | null => {
  const estado = entrada.estado === 'activa' || entrada.estado === 'inactiva' || entrada.estado === 'remodelacion'
    ? entrada.estado
    : entrada.activa === false ? 'inactiva' : 'activa'
  const id = typeof entrada.id === 'string' && UUID_RE.test(entrada.id) ? entrada.id : undefined
  const candidata = {
    ...entrada,
    ...(id ? { id } : {}),
    clinicaId: clinicaId || (typeof entrada.clinicaId === 'string' ? entrada.clinicaId : undefined),
    telefono: typeof entrada.telefono === 'string' ? entrada.telefono : '',
    email: typeof entrada.email === 'string' ? entrada.email : '',
    zonaHoraria: typeof entrada.zonaHoraria === 'string' && entrada.zonaHoraria ? entrada.zonaHoraria : obtenerZonaHorariaClinica(),
    horariosAtencion: Array.isArray(entrada.horariosAtencion) ? entrada.horariosAtencion : [],
    estado,
    activa: estado === 'activa',
  }
  if (!id) delete (candidata as { id?: string }).id
  const parsed = sedeSchema.safeParse(candidata)
  return parsed.success ? parsed.data : null
}

const desdeFila = (row: SedeRow): Sede | null => normalizarSede({
  id: row.id,
  clinicaId: row.clinica_id,
  nombre: row.nombre,
  direccion: row.direccion,
  comuna: row.comuna,
  region: row.region,
  telefono: row.telefono || '',
  email: row.email || '',
  zonaHoraria: row.zona_horaria || obtenerZonaHorariaClinica(),
  horariosAtencion: Array.isArray(row.horarios_atencion) ? row.horarios_atencion as HorarioSede[] : [],
  estado: row.estado,
  activa: row.estado === 'activa',
})

const aFila = (sede: Sede, clinicaId: string): Omit<SedeRow, 'created_at' | 'updated_at'> & { updated_at: string } => ({
  id: sede.id || crearUuid(),
  clinica_id: clinicaId,
  nombre: sede.nombre.trim(),
  direccion: sede.direccion.trim(),
  comuna: sede.comuna.trim(),
  region: sede.region.trim(),
  telefono: sede.telefono?.trim() || '',
  email: sede.email?.trim() || null,
  zona_horaria: sede.zonaHoraria || obtenerZonaHorariaClinica(),
  horarios_atencion: sede.horariosAtencion || [],
  estado: sede.estado || (sede.activa ? 'activa' : 'inactiva'),
  updated_at: new Date().toISOString(),
})

const emitirCambio = (clinicaId?: string): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_SEDES_ACTUALIZADAS, { detail: { clinicaId } }))
  }
}

const guardarCache = (sedes: Sede[], clinicaId?: string): boolean => {
  const ok = sedesRepo.guardar(sedes)
  if (ok) emitirCambio(clinicaId)
  return ok
}

const verificarTenantActivo = (clinicaId: string): void => {
  if (getClinicaActivaSync() !== clinicaId) {
    throw new Error('La clínica activa cambió durante la sincronización. Vuelve a cargar las sucursales.')
  }
}

const filasDeNube = async (clinicaId: string): Promise<SedeRow[]> => {
  if (!supabase) throw new Error('No se pudo conectar con la nube para cargar las sucursales.')
  const { data, error } = await supabase
    .from('sucursales')
    .select('*')
    .eq('clinica_id', clinicaId)
    .order('nombre')
  if (error) {
    log.warn('No se pudieron cargar las sucursales de la clínica.')
    throw new Error('No se pudieron sincronizar las sucursales. Verifica la conexión y los permisos.')
  }
  return (data || []) as unknown as SedeRow[]
}

const guardarFilasNubeEnCache = (rows: SedeRow[], clinicaId: string): Sede[] => {
  verificarTenantActivo(clinicaId)
  const sedesParseadas = rows.map(desdeFila)
  if (sedesParseadas.some((sede) => sede === null)) {
    log.warn('La nube devolvió una sucursal con datos no válidos.')
    throw new Error('La nube devolvió una sucursal con datos incompletos. No se reemplazó la copia local.')
  }
  const sedes = sedesParseadas as Sede[]
  guardarCache(sedes, clinicaId)
  const activaActual = sedeActivaRepo.obtener(null)
  const activaValida = sedes.some((sede) => sede.id === activaActual && sede.estado === 'activa')
  if (!activaValida) {
    const primeraActiva = sedes.find((sede) => sede.estado === 'activa')
    sedeActivaRepo.guardar(primeraActiva?.id || null)
  }
  return sedes
}

const prepararMigracionLocal = (sedes: Sede[], clinicaId: string): Sede[] => {
  const usados = new Set<string>()
  return sedes.map((sede, index) => {
    let id = sede.id && UUID_RE.test(sede.id) ? sede.id : undefined
    // La agenda y los horarios previos usan clinica_id como sede principal.
    if (!id && index === 0 && UUID_RE.test(clinicaId)) id = clinicaId
    if (!id || usados.has(id)) id = crearUuid()
    usados.add(id)
    return { ...sede, id, clinicaId, estado: sede.estado || (sede.activa ? 'activa' : 'inactiva') }
  })
}

const sincronizarDesdeSupabase = async (clinicaId: string): Promise<Sede[]> => {
  let rows = await filasDeNube(clinicaId)
  verificarTenantActivo(clinicaId)
  if (rows.length === 0) {
    const locales = sedesService.obtenerSedes()
    if (locales.length > 0) {
      const preparados = prepararMigracionLocal(locales, clinicaId)
      verificarTenantActivo(clinicaId)
      guardarCache(preparados, clinicaId)
      // La inserción inicial preserva los IDs de agenda existentes. RLS limita
      // esta migración al admin activo; nunca se usa upsert sobre datos remotos.
      const resultadoInicial = await supabase!
        .from('sucursales')
        .insert(preparados.map((sede) => aFila(sede, clinicaId)))
        .select('*')

      if (resultadoInicial.error) {
        // Otra sesión pudo completar la migración al mismo tiempo. Se insertan
        // solo IDs que aún no existen y nunca se sobrescribe una fila remota.
        if (resultadoInicial.error.code === '23505') {
          rows = await filasDeNube(clinicaId)
          verificarTenantActivo(clinicaId)
          if (rows.length === 0) {
            throw new Error('No se pudo confirmar la sucursal remota. La copia local se conservó sin cambios.')
          }
          const idsRemotos = new Set(rows.map((row) => row.id))
          const faltantes = preparados.filter((sede) => !sede.id || !idsRemotos.has(sede.id))
          if (faltantes.length > 0) {
            const resultadoFaltantes = await supabase!
              .from('sucursales')
              .insert(faltantes.map((sede) => aFila(sede, clinicaId)))
              .select('*')
            if (resultadoFaltantes.error?.code === '23505') {
              rows = await filasDeNube(clinicaId)
              verificarTenantActivo(clinicaId)
            } else if (resultadoFaltantes.error) {
              log.warn('No se pudieron migrar algunas sucursales locales a la nube.')
              throw new Error('Algunas sucursales locales no se pudieron sincronizar. La copia local se conservó.')
            } else {
              rows = [...rows, ...((resultadoFaltantes.data || []) as unknown as SedeRow[])]
            }
          }
        } else {
          log.warn('No se pudieron migrar las sucursales locales a la nube.')
          throw new Error('Las sucursales siguen disponibles en este dispositivo, pero no se pudieron sincronizar.')
        }
      } else {
        rows = (resultadoInicial.data || []) as unknown as SedeRow[]
      }
    }
  }
  return guardarFilasNubeEnCache(rows, clinicaId)
}

const validarSede = (entrada: Partial<Sede> & Record<string, unknown>): Sede => {
  const sede = normalizarSede(entrada)
  if (!sede) {
    const parsed = sedeSchema.safeParse(entrada)
    throw new Error(parsed.success ? 'Los datos de la sucursal no son válidos.' : parsed.error.issues[0]?.message || 'Los datos de la sucursal no son válidos.')
  }
  return sede
}

const validarHorarioCompleto = (sede: Sede): void => {
  const horarios = sede.horariosAtencion || []
  const dias = new Set(horarios.map((horario) => horario.diaSemana))
  if (horarios.length !== 7 || dias.size !== 7 || Array.from({ length: 7 }, (_, dia) => dia).some((dia) => !dias.has(dia))) {
    throw new Error('Configura el horario de los siete días antes de guardar la sucursal.')
  }
}

const validarTelefonoNuevo = (sede: Sede): void => {
  if ((sede.telefono || '').trim().length < 3) throw new Error('El teléfono de la sucursal es obligatorio.')
}

const obtenerClinicaNube = (): string => {
  const clinicaId = getClinicaActivaSync()
  if (!clinicaId || !UUID_RE.test(clinicaId)) throw new Error('No se pudo identificar la clínica activa.')
  if (!supabase) throw new Error('No hay conexión configurada con la nube.')
  return clinicaId
}

const insertarSedeNube = async (sede: Sede): Promise<Sede> => {
  const clinicaId = obtenerClinicaNube()
  const fila = aFila({ ...sede, id: sede.id || crearUuid() }, clinicaId)
  const { data, error } = await supabase!.from('sucursales').insert(fila).select('*').single()
  if (error || !data) {
    log.warn('No se pudo guardar una sucursal en la nube.')
    throw new Error('No se pudo guardar la sucursal. Verifica tus permisos y vuelve a intentarlo.')
  }
  const creada = desdeFila(data as unknown as SedeRow)
  if (!creada) throw new Error('La sucursal guardada no devolvió datos válidos.')
  verificarTenantActivo(clinicaId)
  guardarCache([...sedesService.obtenerSedes().filter((item) => item.id !== creada.id), creada], clinicaId)
  return creada
}

const actualizarSedeNube = async (id: string, sede: Sede): Promise<Sede> => {
  const clinicaId = obtenerClinicaNube()
  const { data, error } = await supabase!
    .from('sucursales')
    .update(aFila({ ...sede, id, clinicaId }, clinicaId))
    .eq('id', id)
    .eq('clinica_id', clinicaId)
    .select('*')
    .maybeSingle()
  if (error || !data) {
    log.warn('No se pudo actualizar una sucursal en la nube.')
    throw new Error('No se pudo actualizar la sucursal. Verifica tus permisos y vuelve a intentarlo.')
  }
  const actualizada = desdeFila(data as unknown as SedeRow)
  if (!actualizada) throw new Error('La sucursal actualizada no devolvió datos válidos.')
  verificarTenantActivo(clinicaId)
  guardarCache(sedesService.obtenerSedes().map((item) => item.id === id ? actualizada : item), clinicaId)
  return actualizada
}

const realtimePorClinica = new Map<string, { channel: ReturnType<NonNullable<typeof supabase>['channel']>; listeners: Set<() => void> }>()

export const sedesService = {
  obtenerSedes: (): Sede[] => {
    try {
      if (!getClinicaActivaSync()) return []
      const data = sedesRepo.obtener([])
      return Array.isArray(data)
        ? data.map((sede) => normalizarSede(sede as Sede & Record<string, unknown>)).filter((sede): sede is Sede => sede !== null)
        : []
    } catch {
      return []
    }
  },

  guardarSedes: (sedes: Sede[]): boolean => {
    try {
      const normalizadas = sedes.map((sede) => normalizarSede(sede as Sede & Record<string, unknown>)).filter((sede): sede is Sede => sede !== null)
      return guardarCache(normalizadas, getClinicaActivaSync() || undefined)
    } catch (e) {
      log.error('Error al guardar sedes:', e)
      return false
    }
  },

  crearSede: (datosSede: Omit<Sede, 'id'>): Sede => {
    const validacion = sedeSchema.safeParse(datosSede)
    if (!validacion.success) throw new Error(validacion.error.issues[0]?.message || 'Datos de sede inválidos')
    validarTelefonoNuevo(validacion.data)
    validarHorarioCompleto(validacion.data)
    const clinicaId = getClinicaActivaSync() || undefined
    const nuevaSede = validarSede({ ...validacion.data, id: crearUuid(), clinicaId })
    const nuevaLista = [...sedesService.obtenerSedes(), nuevaSede]
    if (!sedesService.guardarSedes(nuevaLista)) throw new Error('No se pudo guardar la sucursal en este dispositivo.')
    if (nuevaLista.filter((sede) => sede.estado === 'activa').length === 1) sedesService.establecerSedeActiva(nuevaSede.id || '')
    return nuevaSede
  },

  crearSedeSincronizada: async (datosSede: Omit<Sede, 'id'>): Promise<Sede> => {
    const validacion = sedeSchema.safeParse(datosSede)
    if (!validacion.success) throw new Error(validacion.error.issues[0]?.message || 'Datos de sede inválidos')
    validarTelefonoNuevo(validacion.data)
    validarHorarioCompleto(validacion.data)
    if (!USE_SUPABASE || !supabase) return sedesService.crearSede(datosSede)
    const nuevaSede = validarSede({ ...validacion.data, id: crearUuid(), clinicaId: getClinicaActivaSync() || undefined })
    return insertarSedeNube(nuevaSede)
  },

  actualizarSede: (id: string, updates: Partial<Sede>): Sede => {
    const sedes = sedesService.obtenerSedes()
    const existente = sedes.find((sede) => sede.id === id)
    if (!existente) throw new Error(`Sucursal con id ${id} no encontrada`)
    const actualizada = validarSede({ ...existente, ...updates, id })
    const guardado = sedesService.guardarSedes(sedes.map((sede) => sede.id === id ? actualizada : sede))
    if (!guardado) throw new Error('No se pudo guardar la sucursal en este dispositivo.')
    return actualizada
  },

  actualizarSedeSincronizada: async (id: string, updates: Partial<Sede>): Promise<Sede> => {
    const existente = sedesService.obtenerSedes().find((sede) => sede.id === id)
    if (!existente) throw new Error(`Sucursal con id ${id} no encontrada`)
    const actualizada = validarSede({ ...existente, ...updates, id })
    if (updates.telefono !== undefined) validarTelefonoNuevo(actualizada)
    if (updates.horariosAtencion !== undefined && updates.horariosAtencion.length > 0) validarHorarioCompleto(actualizada)
    if (!USE_SUPABASE || !supabase) return sedesService.actualizarSede(id, actualizada)
    return actualizarSedeNube(id, actualizada)
  },

  eliminarSede: (id: string): boolean => {
    const existente = sedesService.obtenerSedes().find((sede) => sede.id === id)
    if (!existente) return false
    try {
      sedesService.actualizarSede(id, { estado: 'inactiva', activa: false })
      return true
    } catch {
      return false
    }
  },

  desactivarSedeSincronizada: async (id: string): Promise<Sede> => {
    return sedesService.actualizarSedeSincronizada(id, { estado: 'inactiva', activa: false })
  },

  obtenerSedeActiva: (): string | null => {
    try {
      if (!getClinicaActivaSync()) return null
      const id = sedeActivaRepo.obtener(null)
      const sedes = sedesService.obtenerSedes()
      if (id && sedes.some((sede) => sede.id === id && sede.estado === 'activa')) return id
      return sedes.find((sede) => sede.estado === 'activa')?.id || null
    } catch {
      return null
    }
  },

  establecerSedeActiva: (sedeId: string): void => {
    try {
      const permitida = sedesService.obtenerSedes().some((sede) => sede.id === sedeId && sede.estado === 'activa')
      sedeActivaRepo.guardar(permitida ? sedeId : null)
    } catch (e) {
      log.error('Error al establecer sede activa:', e)
    }
  },

  sincronizarSedesDesdeSupabase: async (clinicaId?: string | null): Promise<Sede[]> => {
    const clinicaActivaId = getClinicaActivaSync()
    const id = clinicaId || clinicaActivaId
    if (!USE_SUPABASE) {
      if (!id || !UUID_RE.test(id) || id !== clinicaActivaId) return sedesService.obtenerSedes()
      const locales = sedesService.obtenerSedes()
      if (locales.some((sede) => !sede.id)) {
        const normalizadas = prepararMigracionLocal(locales, id)
        guardarCache(normalizadas, id)
        const activaActual = sedeActivaRepo.obtener(null)
        if (!normalizadas.some((sede) => sede.id === activaActual && sede.estado === 'activa')) {
          sedesService.establecerSedeActiva(normalizadas.find((sede) => sede.estado === 'activa')?.id || '')
        }
        return normalizadas
      }
      return locales
    }
    if (!supabase) throw new Error('Supabase no está configurado para sincronizar sucursales.')
    if (!id || !UUID_RE.test(id)) return sedesService.obtenerSedes()
    if (id !== clinicaActivaId) throw new Error('No se permite sincronizar sucursales fuera de la clínica activa.')
    return sincronizarDesdeSupabase(id)
  },

  suscribirCambios: (clinicaId: string, alCambiar: () => void): (() => void) => {
    if (!USE_SUPABASE || !supabase || !clinicaId) return () => {}
    let registro = realtimePorClinica.get(clinicaId)
    if (!registro) {
      const listeners = new Set<() => void>()
      const channel = supabase.channel(`sucursales_${clinicaId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'sucursales',
          filter: `clinica_id=eq.${clinicaId}`,
        }, () => listeners.forEach((listener) => listener()))
        .subscribe()
      registro = { channel, listeners }
      realtimePorClinica.set(clinicaId, registro)
    }
    registro.listeners.add(alCambiar)
    return () => {
      const actual = realtimePorClinica.get(clinicaId)
      if (!actual) return
      actual.listeners.delete(alCambiar)
      if (actual.listeners.size === 0) {
        void supabase?.removeChannel(actual.channel)
        realtimePorClinica.delete(clinicaId)
      }
    }
  },
}
