import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import type { EsterilizacionCloudSnapshot } from '../services/esterilizacionCloudService'
import { esterilizacionCloudService } from '../services/esterilizacionCloudService'
import { fechaClinica } from '../utils/esterilizacionDate'

const PASOS = [
  'Recepción y clasificación del instrumental',
  'Prelavado',
  'Lavado manual o ultrasónico',
  'Enjuague',
  'Secado',
  'Empaque e indicador químico tipo 1',
  'Ciclo de autoclave e indicador tipo 4',
]

const uuidSeguro = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  throw new Error('Este navegador no permite generar una llave segura para registrar el ciclo.')
}

export interface ModalNuevaCargaProps {
  snapshot: EsterilizacionCloudSnapshot
  userProfile?: { nombreCompleto?: string; [key: string]: unknown } | null
  esAdmin: boolean
  cicloInicialId?: string
  onActualizado: () => Promise<void>
  alCerrar: () => void
}

export const ModalNuevaCarga = memo<ModalNuevaCargaProps>(({
  snapshot,
  userProfile,
  esAdmin,
  cicloInicialId,
  onActualizado,
  alCerrar,
}) => {
  const [cicloId, setCicloId] = useState<string | null>(cicloInicialId || null)
  const [equipoId, setEquipoId] = useState('')
  const [programaId, setProgramaId] = useState('')
  const [instrumentoIds, setInstrumentoIds] = useState<string[]>([])
  const [justificacionReproceso, setJustificacionReproceso] = useState('')
  const [lote, setLote] = useState(() => `EST-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${uuidSeguro().slice(0, 8).toUpperCase()}`)
  const [duracionReal, setDuracionReal] = useState('')
  const [metodoLavado, setMetodoLavado] = useState<'manual' | 'ultrasonico'>('manual')
  const [confirmoEnjuague, setConfirmoEnjuague] = useState(false)
  const [pistolaOperativa, setPistolaOperativa] = useState(false)
  const [tipo1Aprobado, setTipo1Aprobado] = useState(true)
  const [overrideBowie, setOverrideBowie] = useState('')
  const [temperaturaObservada, setTemperaturaObservada] = useState('')
  const [presionObservada, setPresionObservada] = useState('')
  const [duracionObservada, setDuracionObservada] = useState('')
  const [tipo4Aprobado, setTipo4Aprobado] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const altaKey = useRef<string | null>(null)
  const iniciarAutoclaveKey = useRef<string | null>(null)
  const finalizarKey = useRef<string | null>(null)
  const pasoKeys = useRef<Record<number, string>>({})
  if (!altaKey.current) altaKey.current = uuidSeguro()

  useEffect(() => {
    if (cicloInicialId) setCicloId(cicloInicialId)
  }, [cicloInicialId])

  const ciclo = snapshot.ciclos.find((item) => item.id === cicloId) || null
  const programa = snapshot.programas.find((item) => item.id === programaId) || null
  const instrumentosEnCiclo = useMemo(() => new Set(
    snapshot.instrumentos
      .filter((instrumento) => ['en_proceso', 'disponible'].includes(instrumento.estado))
      .map((instrumento) => instrumento.inventario_id)
  ), [snapshot.instrumentos])
  const instrumentosElegibles = snapshot.inventario.filter((item) =>
    item.tipo_item === 'instrumental' && item.requiere_esterilizacion && Number(item.cantidad_actual) === 1 &&
    !instrumentosEnCiclo.has(item.id) &&
    (item.estado_instrumental === 'usado' || (esAdmin && item.estado_instrumental === 'retenido'))
  )
  const programasActivos = snapshot.programas.filter((item) => item.categoria === 'esterilizacion' && item.activo)
  const programaSecado = snapshot.programas.find((item) => item.codigo === 'secado')
  const programaBowie = snapshot.programas.find((item) => item.codigo === 'bowie_dick')
  const pasosCiclo = snapshot.pasos.filter((paso) => paso.ciclo_id === cicloId).sort((a, b) => a.numero - b.numero)
  const pasoActivo = pasosCiclo.find((paso) => paso.estado === 'en_curso') || null
  const ultimoPasoCompletado = pasosCiclo.filter((paso) => paso.estado === 'completado').reduce((max, paso) => Math.max(max, paso.numero), 0)
  const siguientePaso = pasoActivo?.numero || ultimoPasoCompletado + 1
  const equipos = snapshot.equipos.filter((equipo) => equipo.tipo_item === 'equipamiento')
  const equipo = equipos.find((item) => item.id === (ciclo?.equipo_id || equipoId))
  const instrumentosSeleccionadosRetenidos = instrumentoIds.some((id) =>
    snapshot.inventario.find((item) => item.id === id)?.estado_instrumental === 'retenido'
  )
  const ultimoBowieHoy = snapshot.pruebas
    .filter((prueba) => prueba.tipo === 'bowie_dick' && prueba.equipo_id === (ciclo?.equipo_id || equipoId) && fechaClinica(prueba.observado_at, snapshot.zonaHoraria) === fechaClinica(new Date(), snapshot.zonaHoraria))
    .sort((a, b) => b.observado_at.localeCompare(a.observado_at))[0]
  const bowieHoyAprobado = programaBowie?.activo === true && ultimoBowieHoy?.estado === 'aprobado'

  const ejecutar = async (accion: () => Promise<void>) => {
    setGuardando(true)
    setError('')
    try {
      await accion()
      await onActualizado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar la operación en DentikOS.')
      await onActualizado().catch(() => {})
    } finally {
      setGuardando(false)
    }
  }

  const crearCiclo = async (event: React.FormEvent) => {
    event.preventDefault()
    if (instrumentoIds.length === 0) {
      setError('Selecciona al menos un instrumental para crear el ciclo.')
      return
    }
    if (instrumentosSeleccionadosRetenidos && (!esAdmin || justificacionReproceso.trim().length < 10)) {
      setError('El reproceso de instrumental retenido requiere administración y una justificación de al menos 10 caracteres.')
      return
    }
    await ejecutar(async () => {
      const resultado = await esterilizacionCloudService.iniciarCiclo({
        lote: lote.trim(),
        equipoId,
        programaId,
        instrumentoIds,
        operador: String(userProfile?.nombreCompleto || ''),
        idempotencyKey: altaKey.current,
        ...(instrumentosSeleccionadosRetenidos ? { justificacionReproceso: justificacionReproceso.trim() } : {}),
      }) as { id?: string }
      if (!resultado?.id) throw new Error('DentikOS no devolvió el identificador del ciclo.')
      setCicloId(resultado.id)
    })
  }

  const iniciarPaso = async (numero: number) => ejecutar(async () => {
    const key = pasoKeys.current[numero] || uuidSeguro()
    pasoKeys.current[numero] = key
    await esterilizacionCloudService.iniciarPaso({ cicloId, numero, idempotencyKey: key })
  })

  const completarPaso = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!cicloId || !pasoActivo) return
    const detalle: Record<string, unknown> = {}
    if (pasoActivo.numero === 2 || pasoActivo.numero === 3) {
      const minutos = Number(duracionReal)
      if (!Number.isFinite(minutos) || minutos <= 0 || minutos > 600) {
        setError('Registra una duración real mayor que cero y no superior a 600 minutos.')
        return
      }
      detalle.duracionMinutosReal = minutos
    }
    if (pasoActivo.numero === 3) detalle.metodo = metodoLavado
    if (pasoActivo.numero === 4 && !confirmoEnjuague) {
      setError('Confirma que el enjuague fue completado antes de avanzar.')
      return
    }
    if (pasoActivo.numero === 5) detalle.pistolaOperativa = pistolaOperativa
    if (pasoActivo.numero === 5) {
      const minutos = Number(duracionReal)
      if (!Number.isFinite(minutos) || minutos < Number(programaSecado?.duracion_minutos || 0) || minutos > 600) {
        setError(`Registra un secado igual o superior a ${programaSecado?.duracion_minutos || 'el tiempo validado'} minutos.`)
        return
      }
      detalle.duracionMinutosReal = minutos
    }
    if (pasoActivo.numero === 6) detalle.indicadoresTipo1Aprobados = tipo1Aprobado
    const key = pasoKeys.current[pasoActivo.numero] || uuidSeguro()
    pasoKeys.current[pasoActivo.numero] = key
    await ejecutar(async () => {
      await esterilizacionCloudService.completarPaso({ cicloId, numero: pasoActivo.numero, detalle, idempotencyKey: key })
      setDuracionReal('')
      setConfirmoEnjuague(false)
      setPistolaOperativa(false)
    })
  }

  const iniciarAutoclave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!cicloId) return
    if (!bowieHoyAprobado && (!esAdmin || overrideBowie.trim().length < 10)) {
      setError('Para iniciar el autoclave se requiere Bowie-Dick aprobado hoy. Solo administración puede continuar sin él y debe registrar una justificación.')
      return
    }
    if (bowieHoyAprobado && overrideBowie.trim()) {
      setError('No agregues una justificación de excepción cuando Bowie-Dick está aprobado.')
      return
    }
    iniciarAutoclaveKey.current ||= uuidSeguro()
    await ejecutar(async () => {
      await esterilizacionCloudService.iniciarAutoclave({
        cicloId,
        idempotencyKey: iniciarAutoclaveKey.current,
        ...(overrideBowie.trim() ? { justificacionBowie: overrideBowie.trim() } : {}),
      })
    })
  }

  const finalizarCiclo = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!cicloId) return
    const temperatura = Number(temperaturaObservada)
    const presion = Number(presionObservada)
    const duracion = Number(duracionObservada)
    if (![temperatura, presion, duracion].every(Number.isFinite) || temperatura < 0 || presion < 0 || duracion <= 0 || duracion > 600) {
      setError('Registra temperatura, presión y duración observadas con valores válidos.')
      return
    }
    finalizarKey.current ||= uuidSeguro()
    await ejecutar(async () => {
      await esterilizacionCloudService.finalizarCiclo({
        cicloId,
        idempotencyKey: finalizarKey.current,
        temperaturaObservada: temperatura,
        presionObservada: presion,
        duracionObservadaMinutos: duracion,
        indicadorTipo4: tipo4Aprobado ? 'aprobado' : 'rechazado',
      })
    })
  }

  const cajaPaso = (numero: number) => {
    const paso = pasosCiclo.find((item) => item.numero === numero)
    const estado = paso?.estado || 'pendiente'
    return (
      <li key={numero} className="flex items-start gap-3 rounded-xl border border-surface p-3">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${estado === 'completado' ? 'bg-emerald-100 text-emerald-800' : estado === 'en_curso' ? 'bg-amber-100 text-amber-900' : 'bg-surface-muted text-graphite-500'}`}>
          {estado === 'completado' ? <CheckCircle2 size={14} /> : numero}
        </span>
        <span className="flex-1 text-sm">{PASOS[numero - 1]}</span>
        <span className="text-[11px] font-semibold uppercase text-graphite-500">{estado === 'completado' ? 'Completado' : estado === 'en_curso' ? 'En curso' : 'Pendiente'}</span>
      </li>
    )
  }

  return (
    <Modal
      isOpen
      onClose={guardando ? () => {} : alCerrar}
      title={ciclo ? `Ciclo ${ciclo.lote}` : 'Registrar ciclo de esterilización'}
      size="xl"
      closeOnEscape={!guardando}
      closeOnOverlayClick={!guardando}
      showCloseButton={!guardando}
    >
      <div className="space-y-5">
        {!ciclo && (
          <form onSubmit={(event) => void crearCiclo(event)} className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Los parámetros del ciclo deben estar validados por la clínica según el fabricante. Solo se ofrecen programas activos y revisados.
            </div>
            {programasActivos.length === 0 && (
              <p role="alert" className="rounded-xl border border-surface p-3 text-sm">No hay programas de esterilización activos. Administración debe configurar y validar uno antes de crear ciclos.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Equipo activo
                <select required value={equipoId} onChange={(event) => setEquipoId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5 text-sm">
                  <option value="">Selecciona un autoclave</option>
                  {equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.codigo}{item.proxima_mantencion ? ` · mantención ${item.proxima_mantencion}` : ''}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">Protocolo validado
                <select required value={programaId} onChange={(event) => setProgramaId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5 text-sm">
                  <option value="">Selecciona un programa</option>
                  {programasActivos.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.temperatura_objetivo} °C · {item.duracion_minutos} min</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">Identificador del lote
                <input required minLength={6} maxLength={80} value={lote} onChange={(event) => setLote(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5 font-mono text-sm" />
              </label>
              <label className="text-xs font-semibold">Instrumental (cantidad unitaria)
                <span className="mt-1 block max-h-44 overflow-y-auto rounded-xl border border-surface p-2">
                  {instrumentosElegibles.length === 0 && <span className="block p-2 text-xs text-graphite-500">No hay instrumental elegible sincronizado.</span>}
                  {instrumentosElegibles.map((item) => (
                    <span key={item.id} className="flex items-start gap-2 border-b border-surface py-2 last:border-0">
                      <input type="checkbox" checked={instrumentoIds.includes(item.id)} onChange={() => setInstrumentoIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])} />
                      <span className="text-xs">{item.nombre} · {item.codigo}{item.estado_instrumental === 'retenido' && <strong className="ml-1 text-amber-700">Retenido</strong>}</span>
                    </span>
                  ))}
                </span>
              </label>
            </div>
            {instrumentosSeleccionadosRetenidos && esAdmin && (
              <label className="block text-xs font-semibold">Justificación de reproceso del instrumental retenido
                <textarea required minLength={10} maxLength={500} rows={2} value={justificacionReproceso} onChange={(event) => setJustificacionReproceso(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5 text-sm" />
              </label>
            )}
            {programa && <p className="text-xs text-graphite-500">Referencia de fabricante: {programa.referencia_fabricante || 'sin registrar'}. Objetivo local: {programa.temperatura_objetivo} °C · {programa.duracion_minutos} min.</p>}
            <div className="flex justify-end gap-2 border-t border-surface pt-4">
              <Button type="button" variant="secondary" onClick={alCerrar} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando || programasActivos.length === 0 || !equipoId || !programaId || instrumentoIds.length === 0}>
                {guardando ? 'Sincronizando…' : 'Crear ciclo y comenzar preparación'}
              </Button>
            </div>
          </form>
        )}

        {ciclo && (
          <>
            <div className="grid gap-2 rounded-xl border border-surface bg-surface-muted p-4 text-xs sm:grid-cols-3">
              <p><strong>Equipo:</strong> {equipo?.nombre || ciclo.equipo_id}</p>
              <p><strong>Programa:</strong> {ciclo.programa_nombre}</p>
              <p><strong>Estado:</strong> {ciclo.estado.replaceAll('_', ' ')}</p>
              <p><strong>Operador:</strong> {ciclo.etiqueta_operador || 'Usuario autenticado'}</p>
              <p><strong>Inicio:</strong> {new Date(ciclo.iniciado_at).toLocaleString('es-CL')}</p>
              <p><strong>Instrumentos:</strong> {snapshot.instrumentos.filter((item) => item.ciclo_id === ciclo.id).length}</p>
            </div>
            <ol className="space-y-2">{PASOS.map((_, index) => cajaPaso(index + 1))}</ol>

            {ciclo.estado === 'preparacion' && !pasoActivo && siguientePaso >= 2 && siguientePaso <= 6 && (
              <div className="rounded-xl border border-surface p-4">
                <p className="text-sm font-bold">{PASOS[siguientePaso - 1]}</p>
                <p className="mt-1 text-xs text-graphite-500">Inicia este paso cuando el equipo esté listo para registrarlo.</p>
                {siguientePaso === 5 && !programaSecado?.activo && <p role="alert" className="mt-2 text-xs text-amber-800">Admin debe configurar y validar el tiempo del proceso de secado antes de continuar.</p>}
                <Button type="button" className="mt-3" disabled={guardando || (siguientePaso === 5 && !programaSecado?.activo)} onClick={() => void iniciarPaso(siguientePaso)}>
                  {guardando ? 'Sincronizando…' : `Iniciar paso ${siguientePaso}`}
                </Button>
              </div>
            )}

            {ciclo.estado === 'preparacion' && pasoActivo && pasoActivo.numero >= 2 && pasoActivo.numero <= 6 && (
              <form onSubmit={(event) => void completarPaso(event)} className="space-y-3 rounded-xl border border-surface p-4">
                <p className="text-sm font-bold">Registrar resultado · {PASOS[pasoActivo.numero - 1]}</p>
                {(pasoActivo.numero === 2 || pasoActivo.numero === 3) && <label className="block text-xs font-semibold">Duración observada (minutos)<input required type="number" min="0.1" max="600" step="0.1" value={duracionReal} onChange={(event) => setDuracionReal(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" /></label>}
                {pasoActivo.numero === 3 && <label className="block text-xs font-semibold">Método de lavado<select value={metodoLavado} onChange={(event) => setMetodoLavado(event.target.value as 'manual' | 'ultrasonico')} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5"><option value="manual">Manual</option><option value="ultrasonico">Ultrasónico</option></select></label>}
                {pasoActivo.numero === 4 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmoEnjuague} onChange={(event) => setConfirmoEnjuague(event.target.checked)} />Enjuague completado</label>}
                {pasoActivo.numero === 5 && <>
                  <label className="block text-xs font-semibold">Duración real del secado (minutos; mínimo {programaSecado?.duracion_minutos || 'sin validar'})<input required type="number" min={programaSecado?.duracion_minutos || 0.1} max="600" step="0.1" value={duracionReal} onChange={(event) => setDuracionReal(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" /></label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pistolaOperativa} onChange={(event) => setPistolaOperativa(event.target.checked)} />Confirmo que el equipo de secado está operativo</label>
                </>}
                {pasoActivo.numero === 6 && <label className="block text-xs font-semibold">Resultado de indicadores tipo 1<select value={tipo1Aprobado ? 'aprobado' : 'rechazado'} onChange={(event) => setTipo1Aprobado(event.target.value === 'aprobado')} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5"><option value="aprobado">Todos aprobaron</option><option value="rechazado">Uno o más fallaron</option></select></label>}
                <Button type="submit" disabled={guardando || (pasoActivo.numero === 4 && !confirmoEnjuague) || (pasoActivo.numero === 5 && !pistolaOperativa)}>{guardando ? 'Sincronizando…' : 'Registrar y completar paso'}</Button>
              </form>
            )}

            {ciclo.estado === 'preparacion' && siguientePaso === 7 && !pasoActivo && (
              <form onSubmit={(event) => void iniciarAutoclave(event)} className="space-y-3 rounded-xl border border-surface p-4">
                <p className="text-sm font-bold">Preparación completada · revisar Bowie-Dick</p>
                <p className={`text-xs ${bowieHoyAprobado ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {!programaBowie?.activo ? 'El protocolo Bowie-Dick no está validado por la clínica.' : bowieHoyAprobado ? 'Bowie-Dick aprobado hoy para este equipo.' : 'No hay Bowie-Dick aprobado hoy para este equipo.'}
                </p>
                {!bowieHoyAprobado && esAdmin && programaBowie?.activo && <label className="block text-xs font-semibold">Justificación de excepción administrativa (mínimo 10 caracteres)<textarea minLength={10} maxLength={500} value={overrideBowie} onChange={(event) => setOverrideBowie(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" /></label>}
                <Button type="submit" disabled={guardando || !programaBowie?.activo}>{guardando ? 'Sincronizando…' : 'Iniciar autoclave'}</Button>
              </form>
            )}

            {ciclo.estado === 'en_curso' && (
              <form onSubmit={(event) => void finalizarCiclo(event)} className="space-y-3 rounded-xl border border-surface p-4">
                <p className="text-sm font-bold">Registrar mediciones observadas del ciclo</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold">Temperatura (°C)<input required type="number" min="0" step="0.1" value={temperaturaObservada} onChange={(event) => setTemperaturaObservada(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" /></label>
                  <label className="text-xs font-semibold">Presión observada<input required type="number" min="0" step="0.001" value={presionObservada} onChange={(event) => setPresionObservada(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" /></label>
                  <label className="text-xs font-semibold">Duración (minutos)<input required type="number" min="0.1" max="600" step="0.1" value={duracionObservada} onChange={(event) => setDuracionObservada(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" /></label>
                </div>
                <label className="block text-xs font-semibold">Indicador químico tipo 4<select value={tipo4Aprobado ? 'aprobado' : 'rechazado'} onChange={(event) => setTipo4Aprobado(event.target.value === 'aprobado')} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5"><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option></select></label>
                <Button type="submit" disabled={guardando}>{guardando ? 'Sincronizando…' : 'Finalizar ciclo y registrar resultado'}</Button>
              </form>
            )}

            {ciclo.estado === 'liberado' && <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 size={16} />Ciclo liberado en DentikOS. El instrumental quedó disponible para trazabilidad.</p>}
            {['rechazado', 'retenido_biologico', 'cancelado'].includes(ciclo.estado) && <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle size={16} />Estado {ciclo.estado.replaceAll('_', ' ')}. Este ciclo no libera instrumental.</p>}
          </>
        )}

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {guardando && <p role="status" className="flex items-center gap-2 text-xs text-graphite-500"><Loader2 size={14} className="animate-spin" />Confirmando cambios con DentikOS…</p>}
        {ciclo && <div className="flex justify-end border-t border-surface pt-4"><Button type="button" variant="secondary" onClick={alCerrar} disabled={guardando}>Cerrar</Button></div>}
      </div>
    </Modal>
  )
})

ModalNuevaCarga.displayName = 'ModalNuevaCarga'
