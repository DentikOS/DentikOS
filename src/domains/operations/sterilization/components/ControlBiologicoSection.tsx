import React, { memo, useRef, useState } from 'react'
import { Check, Dna, Plus, X } from 'lucide-react'
import { esterilizacionCloudService, type EsterilizacionCloudSnapshot } from '../services/esterilizacionCloudService'
import { Button } from '../../../../shared/ui/ui/Button'
import { inicioSemanaClinica } from '../utils/esterilizacionDate'

const uuidSeguro = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  throw new Error('No se pudo generar una llave segura para la prueba.')
}

export interface ControlBiologicoSectionProps {
  snapshot: EsterilizacionCloudSnapshot
  onRefresh: () => Promise<void>
}

export const ControlBiologicoSection = memo<ControlBiologicoSectionProps>(({ snapshot, onRefresh }) => {
  const [cicloId, setCicloId] = useState('')
  const [marca, setMarca] = useState('')
  const [horas, setHoras] = useState('')
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [lecturas, setLecturas] = useState<Record<string, 'aprobado' | 'rechazado'>>({})
  const iniciarKey = useRef<string | null>(null)
  const ciclosLiberados = snapshot.ciclos.filter((ciclo) => ciclo.estado === 'liberado')
  const cicloPorId = new Map(snapshot.ciclos.map((ciclo) => [ciclo.id, ciclo]))
  const equipoPorId = new Map(snapshot.equipos.map((equipo) => [equipo.id, equipo]))
  const pruebas = snapshot.pruebas.filter((prueba) => prueba.tipo === 'biologico')
  const semanaActual = inicioSemanaClinica(new Date(), snapshot.zonaHoraria)
  const equiposConPruebaSemanal = new Set(pruebas
    .filter((prueba) => inicioSemanaClinica(prueba.observado_at, snapshot.zonaHoraria) === semanaActual)
    .map((prueba) => prueba.equipo_id))
  const ciclosElegibles = ciclosLiberados.filter((ciclo) => !equiposConPruebaSemanal.has(ciclo.equipo_id))

  const ejecutar = async (accion: () => Promise<void>, alConfirmar?: () => void) => {
    setGuardando(true)
    setError('')
    try {
      await accion()
      await onRefresh()
      alConfirmar?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar la prueba biológica.')
      await onRefresh().catch(() => {})
    } finally {
      setGuardando(false)
    }
  }

  const iniciarPrueba = (event: React.FormEvent) => {
    event.preventDefault()
    if (!cicloId || !marca.trim() || (horas && Number(horas) <= 0)) {
      setError('Selecciona un ciclo liberado, registra la marca del indicador y revisa las horas de incubación.')
      return
    }
    void ejecutar(async () => {
      iniciarKey.current ||= uuidSeguro()
      await esterilizacionCloudService.registrarPruebaBiologica({
        accion: 'iniciar',
        cicloId,
        marcaIndicador: marca.trim(),
        horasIncubacion: horas ? Number(horas) : null,
        observacion: observacion.trim(),
        idempotencyKey: iniciarKey.current,
      })
    }, () => {
      iniciarKey.current = null
      setCicloId('')
      setMarca('')
      setHoras('')
      setObservacion('')
    })
  }

  const registrarLectura = (pruebaId: string, resultado: 'aprobado' | 'rechazado') => {
    void ejecutar(async () => {
      await esterilizacionCloudService.registrarPruebaBiologica({
        accion: 'leer',
        pruebaId,
        resultado,
      })
      setLecturas((actuales) => {
        const { [pruebaId]: _lectura, ...resto } = actuales
        return resto
      })
    })
  }

  return (
    <div className="space-y-5 text-xs">
      <form onSubmit={iniciarPrueba} className="space-y-4 rounded-2xl border border-surface bg-surface p-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Dna size={16} />Registrar prueba biológica</h3>
          <p className="mt-1 text-graphite-500">La prueba se asocia a un ciclo liberado. Su resultado queda en DentikOS y un rechazo retiene el instrumental vinculado al ciclo.</p>
        </div>
        {ciclosElegibles.length === 0 ? (
          <p className="rounded-xl border border-surface bg-surface-muted p-3">{ciclosLiberados.length === 0 ? 'No hay ciclos liberados disponibles para asociar una prueba.' : 'Cada autoclave ya tiene una prueba biológica registrada esta semana.'}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="font-semibold">Ciclo liberado
              <select required value={cicloId} onChange={(event) => setCicloId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5">
                <option value="">Selecciona lote y equipo</option>
                {ciclosElegibles.map((ciclo) => <option key={ciclo.id} value={ciclo.id}>{ciclo.lote} · {equipoPorId.get(ciclo.equipo_id)?.nombre || ciclo.equipo_id}</option>)}
              </select>
            </label>
            <label className="font-semibold">Marca / modelo del indicador
              <input required maxLength={120} value={marca} onChange={(event) => setMarca(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" />
            </label>
            <label className="font-semibold">Horas indicadas para incubación
              <input type="number" min="0.1" step="0.1" value={horas} onChange={(event) => setHoras(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" />
            </label>
            <label className="font-semibold">Observación
              <input maxLength={1000} value={observacion} onChange={(event) => setObservacion(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" />
            </label>
          </div>
        )}
        {ciclosElegibles.length > 0 && <Button type="submit" disabled={guardando || !cicloId || !marca.trim()}><Plus size={14} />{guardando ? 'Sincronizando…' : 'Iniciar prueba'}</Button>}
      </form>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-surface bg-surface">
        <table className="w-full min-w-[760px] text-left">
          <thead><tr className="border-b border-surface bg-surface-muted text-[10px] uppercase"><th className="p-3">Lote</th><th className="p-3">Indicador</th><th className="p-3">Inicio</th><th className="p-3">Incubación</th><th className="p-3">Resultado</th><th className="p-3">Lectura</th></tr></thead>
          <tbody className="divide-y divide-surface">
            {pruebas.map((prueba) => {
              const ciclo = prueba.ciclo_id ? cicloPorId.get(prueba.ciclo_id) : undefined
              const seleccion = lecturas[prueba.id]
              return <tr key={prueba.id}>
                <td className="p-3 font-mono font-semibold">{ciclo?.lote || prueba.ciclo_id || '—'}</td>
                <td className="p-3">{prueba.marca_indicador || '—'}</td>
                <td className="p-3">{new Date(prueba.observado_at).toLocaleString('es-CL')}</td>
                <td className="p-3">{prueba.horas_incubacion ? `${prueba.horas_incubacion} h` : 'No indicada'}</td>
                <td className="p-3 font-semibold">{prueba.estado === 'pendiente' ? 'Pendiente de lectura' : prueba.estado}</td>
                <td className="p-3">
                  {prueba.estado === 'pendiente' ? <div className="flex flex-wrap gap-1">
                    <select aria-label={`Resultado para ${prueba.marca_indicador}`} value={seleccion || ''} onChange={(event) => setLecturas((actuales) => ({ ...actuales, [prueba.id]: event.target.value as 'aprobado' | 'rechazado' }))} className="rounded-lg border border-surface bg-surface p-1.5">
                      <option value="">Seleccionar resultado</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option>
                    </select>
                    {seleccion && <Button size="sm" disabled={guardando} onClick={() => registrarLectura(prueba.id, seleccion)}>{seleccion === 'aprobado' ? <Check size={12} /> : <X size={12} />}Registrar</Button>}
                  </div> : <span className="text-graphite-500">Registrada</span>}
                </td>
              </tr>
            })}
            {pruebas.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-graphite-500">Todavía no hay pruebas biológicas sincronizadas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
})

ControlBiologicoSection.displayName = 'ControlBiologicoSection'
