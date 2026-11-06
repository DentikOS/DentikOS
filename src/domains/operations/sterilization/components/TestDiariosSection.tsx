import React, { memo, useRef, useState } from 'react'
import { CheckCircle2, PenSquare, Wrench, XCircle } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { esterilizacionCloudService, type EsterilizacionCloudSnapshot } from '../services/esterilizacionCloudService'

const uuidSeguro = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  throw new Error('No se pudo generar una llave segura para registrar Bowie-Dick.')
}

export interface TestDiariosSectionProps {
  snapshot: EsterilizacionCloudSnapshot
  onRefresh: () => Promise<void>
}

export const TestDiariosSection = memo<TestDiariosSectionProps>(({ snapshot, onRefresh }) => {
  const [equipoId, setEquipoId] = useState('')
  const [resultado, setResultado] = useState<'aprobado' | 'rechazado'>('aprobado')
  const [marca, setMarca] = useState('')
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const registroKey = useRef<string | null>(null)
  const equipos = snapshot.equipos.filter((equipo) => equipo.tipo_item === 'equipamiento')
  const programaBowie = snapshot.programas.find((programa) => programa.codigo === 'bowie_dick')
  const pruebas = snapshot.pruebas.filter((prueba) => prueba.tipo === 'bowie_dick')
  const equipoPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]))

  const registrar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!equipoId || !marca.trim()) {
      setError('Selecciona un equipo activo e indica la marca del indicador utilizado.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      registroKey.current ||= uuidSeguro()
      await esterilizacionCloudService.registrarBowieDick({
        equipoId,
        resultado,
        marcaIndicador: marca.trim(),
        observacion: observacion.trim(),
        idempotencyKey: registroKey.current,
      })
      await onRefresh()
      registroKey.current = null
      setObservacion('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar el resultado Bowie-Dick.')
      await onRefresh().catch(() => {})
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-5 text-xs">
      <form onSubmit={(event) => void registrar(event)} className="space-y-4 rounded-2xl border border-surface bg-surface p-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><Wrench size={16} />Registrar resultado Bowie-Dick</h3>
          <p className="mt-1 text-graphite-500">Cada resultado queda asociado al equipo y a la hora de registro en DentikOS. Un resultado no aprobado bloquea iniciar el autoclave, salvo excepción administrativa auditada.</p>
          <p className="mt-1 text-graphite-500">Protocolo Bowie-Dick: {programaBowie?.temperatura_objetivo ?? '—'} °C · {programaBowie?.duracion_minutos ?? '—'} min · {programaBowie?.activo ? 'validado para esta clínica' : 'pendiente de validación administrativa'}.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="font-semibold">Equipo
            <select required value={equipoId} onChange={(event) => setEquipoId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5">
              <option value="">Selecciona un autoclave</option>
              {equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre} · {equipo.codigo}</option>)}
            </select>
          </label>
          <label className="font-semibold">Marca / modelo del indicador
            <input required maxLength={120} value={marca} onChange={(event) => setMarca(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" />
          </label>
          <label className="font-semibold">Resultado
            <select value={resultado} onChange={(event) => setResultado(event.target.value as 'aprobado' | 'rechazado')} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5">
              <option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option>
            </select>
          </label>
          <label className="font-semibold">Observación técnica
            <input maxLength={1000} value={observacion} onChange={(event) => setObservacion(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2.5" />
          </label>
        </div>
        {equipos.length === 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">No hay autoclaves activos en el inventario de esta clínica.</p>}
        {!programaBowie?.activo && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">Admin debe configurar el programa Bowie-Dick con la referencia del fabricante antes de registrar resultados.</p>}
        <Button type="submit" disabled={guardando || equipos.length === 0 || !equipoId || !marca.trim() || !programaBowie?.activo}><PenSquare size={14} />{guardando ? 'Sincronizando…' : 'Guardar resultado'}</Button>
      </form>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-surface bg-surface">
        <table className="w-full min-w-[760px] text-left">
          <thead><tr className="border-b border-surface bg-surface-muted text-[10px] uppercase"><th className="p-3">Fecha</th><th className="p-3">Equipo</th><th className="p-3">Indicador</th><th className="p-3">Resultado</th><th className="p-3">Observación</th></tr></thead>
          <tbody className="divide-y divide-surface">
            {pruebas.map((prueba) => <tr key={prueba.id}>
              <td className="p-3">{new Date(prueba.observado_at).toLocaleString('es-CL')}</td>
              <td className="p-3 font-semibold">{equipoPorId.get(prueba.equipo_id)?.nombre || prueba.equipo_id}</td>
              <td className="p-3">{prueba.marca_indicador || '—'}</td>
              <td className={`p-3 font-bold ${prueba.estado === 'aprobado' ? 'text-emerald-700' : 'text-red-700'}`}>
                <span className="inline-flex items-center gap-1">{prueba.estado === 'aprobado' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{prueba.estado}</span>
              </td>
              <td className="p-3">{prueba.observacion || '—'}</td>
            </tr>)}
            {pruebas.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-graphite-500">Todavía no hay resultados Bowie-Dick sincronizados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
})

TestDiariosSection.displayName = 'TestDiariosSection'
