import React, { memo, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { esterilizacionCloudService, type EsterilizacionCloudSnapshot, type ProgramaEsterilizacionCloud, type InsumoEsterilizacionConfigCloud } from '../services/esterilizacionCloudService'

const TIPOS_INSUMO: Array<{ tipo: InsumoEsterilizacionConfigCloud['tipo_consumo']; nombre: string; frecuencia: string; porInstrumento: boolean; cantidadInicial: number; unidadInicial: string }> = [
  { tipo: 'prelavado', nombre: 'Detergente enzimático', frecuencia: 'por prelavado', porInstrumento: false, cantidadInicial: 10, unidadInicial: 'ml' },
  { tipo: 'enjuague', nombre: 'Agua destilada', frecuencia: 'por enjuague', porInstrumento: false, cantidadInicial: 500, unidadInicial: 'ml' },
  { tipo: 'bolsa', nombre: 'Bolsa / empaque', frecuencia: 'por instrumento', porInstrumento: true, cantidadInicial: 1, unidadInicial: 'unidad' },
  { tipo: 'indicador_tipo1', nombre: 'Indicador químico tipo 1', frecuencia: 'por instrumento', porInstrumento: true, cantidadInicial: 1, unidadInicial: 'unidad' },
  { tipo: 'indicador_tipo4', nombre: 'Indicador químico tipo 4', frecuencia: 'por ciclo', porInstrumento: false, cantidadInicial: 1, unidadInicial: 'unidad' },
  { tipo: 'indicador_biologico', nombre: 'Indicador biológico', frecuencia: 'por prueba semanal', porInstrumento: false, cantidadInicial: 1, unidadInicial: 'unidad' },
  { tipo: 'indicador_bowie_dick', nombre: 'Test Bowie-Dick', frecuencia: 'por prueba diaria', porInstrumento: false, cantidadInicial: 1, unidadInicial: 'unidad' },
]

interface PanelProps {
  snapshot: EsterilizacionCloudSnapshot
  onRefresh: () => Promise<void>
}

const ProgramaCard: React.FC<{ programa: ProgramaEsterilizacionCloud; onRefresh: () => Promise<void> }> = ({ programa, onRefresh }) => {
  const [nombre, setNombre] = useState(programa.nombre)
  const [temperatura, setTemperatura] = useState('')
  const [duracion, setDuracion] = useState('')
  const [presion, setPresion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [activo, setActivo] = useState(programa.activo)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const requiereTemperatura = programa.codigo !== 'secado'

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (activo && ((!temperatura && requiereTemperatura) || !duracion || referencia.trim().length < 8)) {
      setError(`Para activar, confirma ${requiereTemperatura ? 'temperatura, ' : ''}duración y referencia específica del fabricante.`)
      return
    }
    setGuardando(true)
    setError('')
    try {
      await esterilizacionCloudService.configurarPrograma({
        codigo: programa.codigo,
        nombre: nombre.trim(),
        activo,
        ...(temperatura ? { temperaturaObjetivo: Number(temperatura) } : {}),
        ...(duracion ? { duracionMinutos: Number(duracion) } : {}),
        ...(presion ? { presionObjetivo: Number(presion) } : {}),
        ...(activo ? { referenciaFabricante: referencia.trim() } : {}),
      })
      await onRefresh()
      setTemperatura('')
      setDuracion('')
      setPresion('')
      setReferencia('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el protocolo.')
    } finally {
      setGuardando(false)
    }
  }

  return <form onSubmit={(event) => void guardar(event)} className="space-y-3 rounded-2xl border border-surface bg-surface p-4">
    <div className="flex items-start justify-between gap-3">
      <div><h4 className="font-bold">{programa.nombre}</h4><p className="text-[11px] text-graphite-500">{programa.codigo} · {programa.activo ? 'Activo' : 'Inactivo, pendiente de validación local'}</p></div>
      <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} />Activo</label>
    </div>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">Los valores iniciales proceden del blueprint y no son una validación clínica. Confirma los parámetros en la documentación del fabricante antes de activar este programa.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-semibold">Nombre local<input maxLength={120} required value={nombre} onChange={(event) => setNombre(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2" /></label>
      <label className="text-xs font-semibold">Temperatura indicada por fabricante (°C)<input type="number" min="0" max="9999" step="0.01" value={temperatura} onChange={(event) => setTemperatura(event.target.value)} disabled={!requiereTemperatura} placeholder={requiereTemperatura ? `Actual sin validar: ${programa.temperatura_objetivo ?? '—'}` : 'No aplica'} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2 disabled:bg-surface-muted" /></label>
      <label className="text-xs font-semibold">Duración indicada (min)<input type="number" min="0.01" max="600" step="0.01" value={duracion} onChange={(event) => setDuracion(event.target.value)} placeholder={`Actual sin validar: ${programa.duracion_minutos}`} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2" /></label>
      <label className="text-xs font-semibold">Presión objetivo (si está especificada)<input type="number" min="0" max="99999" step="0.001" value={presion} onChange={(event) => setPresion(event.target.value)} placeholder={`Actual: ${programa.presion_objetivo ?? 'sin dato'}`} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2" /></label>
    </div>
    <label className="block text-xs font-semibold">Referencia verificable del fabricante (modelo, documento o sección)
      <input maxLength={500} value={referencia} onChange={(event) => setReferencia(event.target.value)} placeholder="Identifica el manual y la sección revisada" className="mt-1 w-full rounded-xl border border-surface bg-surface p-2" />
    </label>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <Button type="submit" disabled={guardando}>{guardando ? 'Sincronizando…' : activo ? 'Guardar y activar protocolo' : 'Guardar / desactivar'}</Button>
  </form>
}

const InsumoCard: React.FC<{ tipo: typeof TIPOS_INSUMO[number]; snapshot: EsterilizacionCloudSnapshot; onRefresh: () => Promise<void> }> = ({ tipo, snapshot, onRefresh }) => {
  const configuracion = snapshot.insumosConfig.find((item) => item.tipo_consumo === tipo.tipo)
  const [inventarioId, setInventarioId] = useState(configuracion?.inventario_id || '')
  const [ubicacionId, setUbicacionId] = useState(configuracion?.ubicacion_id || '')
  const [cantidad, setCantidad] = useState(configuracion ? String(configuracion.cantidad) : String(tipo.cantidadInicial))
  const [unidad, setUnidad] = useState(configuracion?.unidad || tipo.unidadInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const insumos = snapshot.inventario.filter((item) => item.tipo_item === 'insumo_clinico')

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!inventarioId || !ubicacionId || !cantidad || Number(cantidad) <= 0 || !unidad.trim()) {
      setError('Selecciona un insumo, una ubicación y una cantidad positiva con unidad.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await esterilizacionCloudService.configurarInsumo({
        tipoConsumo: tipo.tipo,
        inventarioId,
        ubicacionId,
        cantidad: Number(cantidad),
        unidad: unidad.trim(),
        porInstrumento: tipo.porInstrumento,
      })
      await onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar el insumo de esterilización.')
    } finally {
      setGuardando(false)
    }
  }

  return <form onSubmit={(event) => void guardar(event)} className="space-y-3 rounded-2xl border border-surface bg-surface p-4">
    <div><h4 className="font-bold">{tipo.nombre}</h4><p className="text-[11px] text-graphite-500">{tipo.frecuencia} · {configuracion ? 'Configurado' : 'Pendiente de vincular al inventario'}</p></div>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-semibold">Insumo
        <select required value={inventarioId} onChange={(event) => setInventarioId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2">
          <option value="">Selecciona del inventario</option>{insumos.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.codigo}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold">Ubicación de stock
        <select required value={ubicacionId} onChange={(event) => setUbicacionId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2">
          <option value="">Selecciona una ubicación</option>{snapshot.ubicaciones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold">Cantidad<input required type="number" min="0.001" step="0.001" value={cantidad} onChange={(event) => setCantidad(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2" /></label>
      <label className="text-xs font-semibold">Unidad<input required maxLength={40} value={unidad} onChange={(event) => setUnidad(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2" /></label>
    </div>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <Button type="submit" disabled={guardando || insumos.length === 0 || snapshot.ubicaciones.length === 0}>{guardando ? 'Sincronizando…' : 'Guardar configuración'}</Button>
  </form>
}

export const ConfiguracionEsterilizacionPanel = memo<PanelProps>(({ snapshot, onRefresh }) => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-bold"><Settings2 size={16} />Configuración clínica</p>
      <p className="mt-1 text-xs">Los ciclos permanecen bloqueados mientras no haya un protocolo revisado y consumibles configurados con stock en una ubicación de esta clínica.</p>
    </div>
    <section className="space-y-3"><h3 className="text-sm font-bold">Protocolos de esterilización</h3>
      {snapshot.programas.filter((item) => item.categoria === 'esterilizacion').map((programa) => <ProgramaCard key={programa.id} programa={programa} onRefresh={onRefresh} />)}
    </section>
    <section className="space-y-3"><h3 className="text-sm font-bold">Procesos auxiliares del protocolo</h3>
      <p className="text-xs text-graphite-500">El secado se registra dentro del ciclo y Bowie-Dick se registra como prueba diaria. Ninguno se puede seleccionar como un ciclo que libere instrumental.</p>
      {snapshot.programas.filter((item) => item.categoria !== 'esterilizacion').map((programa) => <ProgramaCard key={programa.id} programa={programa} onRefresh={onRefresh} />)}
    </section>
    <section className="space-y-3"><h3 className="text-sm font-bold">Insumos consumidos por el flujo</h3>
      {TIPOS_INSUMO.map((tipo) => <InsumoCard key={tipo.tipo} tipo={tipo} snapshot={snapshot} onRefresh={onRefresh} />)}
    </section>
  </div>
))

ConfiguracionEsterilizacionPanel.displayName = 'ConfiguracionEsterilizacionPanel'
