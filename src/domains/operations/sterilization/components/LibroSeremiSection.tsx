import React, { memo, useMemo, useState } from 'react'
import { BookOpen, Download, Printer } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import type { EsterilizacionCloudSnapshot } from '../services/esterilizacionCloudService'
import { fechaClinica } from '../utils/esterilizacionDate'

export interface LibroSeremiSectionProps {
  snapshot: EsterilizacionCloudSnapshot
  userProfile?: { nombreCompleto?: string; [key: string]: unknown } | null
}

const csv = (value: unknown): string => {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
  const protegida = /^[=+\-@\t]/.test(text) ? `'${text}` : text
  return `"${protegida.replaceAll('"', '""')}"`
}

export const LibroSeremiSection = memo<LibroSeremiSectionProps>(({ snapshot, userProfile }) => {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [equipoId, setEquipoId] = useState('')
  const [tipoRegistro, setTipoRegistro] = useState<'todos' | 'ciclo' | 'prueba'>('todos')
  const [resultado, setResultado] = useState('todos')
  const cicloPorId = new Map(snapshot.ciclos.map((ciclo) => [ciclo.id, ciclo]))
  const equipoPorId = new Map(snapshot.equipos.map((equipo) => [equipo.id, equipo]))
  const ciclosVisibles = useMemo(() => snapshot.ciclos.filter((ciclo) => {
    const fecha = fechaClinica(ciclo.iniciado_at, snapshot.zonaHoraria)
    return (!desde || fecha >= desde) && (!hasta || fecha <= hasta) && (!equipoId || ciclo.equipo_id === equipoId)
      && (tipoRegistro === 'todos' || tipoRegistro === 'ciclo')
      && (resultado === 'todos' || ciclo.estado === resultado)
  }), [snapshot.ciclos, snapshot.zonaHoraria, desde, hasta, equipoId, tipoRegistro, resultado])
  const pruebasVisibles = useMemo(() => snapshot.pruebas.filter((prueba) => {
    const fecha = fechaClinica(prueba.observado_at, snapshot.zonaHoraria)
    return (!desde || fecha >= desde) && (!hasta || fecha <= hasta) && (!equipoId || prueba.equipo_id === equipoId)
      && (tipoRegistro === 'todos' || tipoRegistro === 'prueba')
      && (resultado === 'todos' || prueba.estado === resultado)
  }), [snapshot.pruebas, snapshot.zonaHoraria, desde, hasta, equipoId, tipoRegistro, resultado])
  const filas = [
    ['Registro', 'Fecha/hora', 'Lote', 'Equipo', 'Detalle', 'Estado', 'Operador', 'Observación'],
    ...ciclosVisibles.map((ciclo) => [
      'Ciclo', ciclo.iniciado_at, ciclo.lote, equipoPorId.get(ciclo.equipo_id)?.nombre || ciclo.equipo_id,
      `${ciclo.programa_nombre}; tipo 1 ${snapshot.instrumentos.filter((item) => item.ciclo_id === ciclo.id).map((item) => item.indicador_tipo1_aprobado === null ? 'pendiente' : item.indicador_tipo1_aprobado ? 'aprobado' : 'rechazado').join('/')}; tipo 4 ${ciclo.indicador_tipo4 || 'pendiente'}`,
      ciclo.estado, ciclo.etiqueta_operador, ciclo.motivo_cancelacion || ciclo.motivo_override_bowie || '',
    ]),
    ...pruebasVisibles.map((prueba) => {
      const ciclo = prueba.ciclo_id ? cicloPorId.get(prueba.ciclo_id) : undefined
      return [
        prueba.tipo === 'bowie_dick' ? 'Bowie-Dick' : 'Prueba biológica',
        prueba.observado_at, ciclo?.lote || '', equipoPorId.get(prueba.equipo_id)?.nombre || prueba.equipo_id,
        prueba.marca_indicador, prueba.estado, prueba.leido_por || prueba.creado_por,
        prueba.observacion,
      ]
    }),
  ]

  const descargar = () => {
    const contenido = filas.map((fila) => fila.map(csv).join(',')).join('\r\n')
    const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `dentikos-esterilizacion-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface bg-surface-muted p-4 print:hidden">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><BookOpen size={16} />Libro de registros de esterilización</h3>
          <p className="mt-1 text-[11px] text-graphite-500">Exportación informativa desde registros sincronizados; no es un certificado ni una declaración de cumplimiento normativo.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={descargar}><Download size={14} />Descargar CSV</Button>
          <Button type="button" onClick={() => window.print()}><Printer size={14} />Imprimir</Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-surface bg-surface-muted p-4 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
        <label className="text-xs font-semibold">Desde<input type="date" value={desde} onChange={(event) => setDesde(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2" /></label>
        <label className="text-xs font-semibold">Hasta<input type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2" /></label>
        <label className="text-xs font-semibold">Autoclave<select value={equipoId} onChange={(event) => setEquipoId(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2"><option value="">Todos</option>{snapshot.equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>)}</select></label>
        <label className="text-xs font-semibold">Registro<select value={tipoRegistro} onChange={(event) => setTipoRegistro(event.target.value as typeof tipoRegistro)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2"><option value="todos">Todos</option><option value="ciclo">Ciclos</option><option value="prueba">Pruebas</option></select></label>
        <label className="text-xs font-semibold">Resultado<select value={resultado} onChange={(event) => setResultado(event.target.value)} className="mt-1 w-full rounded-xl border border-surface bg-surface p-2"><option value="todos">Todos</option><option value="liberado">Liberado</option><option value="aprobado">Aprobado</option><option value="pendiente">Pendiente</option><option value="rechazado">Rechazado</option><option value="retenido_biologico">Retenido biológico</option><option value="cancelado">Cancelado</option></select></label>
      </div>

      <div className="space-y-4 rounded-2xl border border-surface bg-surface p-5 text-graphite-900 dark:text-graphite-50">
        <div className="flex flex-wrap justify-between gap-2 border-b border-surface pb-3">
          <div><h2 className="text-base font-black">Registro de esterilización</h2><p className="text-[10px] text-graphite-500">Fuente: DentikOS · {ciclosVisibles.length} ciclos y {pruebasVisibles.length} pruebas en el filtro</p></div>
          <p className="text-right text-[10px]">Generado: {new Date().toLocaleString('es-CL')}<br />Usuario: {userProfile?.nombreCompleto || 'Sesión autenticada'}</p>
        </div>
        <div className="space-y-2">
          {ciclosVisibles.map((ciclo) => <article key={`ciclo-${ciclo.id}`} className="grid gap-1 border-b border-surface py-2 sm:grid-cols-[1fr_1fr_1fr_2fr]">
            <strong>{ciclo.lote}</strong><span>{new Date(ciclo.iniciado_at).toLocaleString('es-CL')}</span>
            <span>{equipoPorId.get(ciclo.equipo_id)?.nombre || ciclo.equipo_id}</span>
            <span>{ciclo.programa_nombre} · {ciclo.estado} · Tipo 4: {ciclo.indicador_tipo4 || 'sin medición'}</span>
          </article>)}
          {pruebasVisibles.map((prueba) => <article key={`prueba-${prueba.id}`} className="grid gap-1 border-b border-surface py-2 sm:grid-cols-[1fr_1fr_1fr_2fr]">
            <strong>{prueba.tipo === 'bowie_dick' ? 'Bowie-Dick' : 'Biológico'} · {prueba.marca_indicador || 'sin lote'}</strong><span>{new Date(prueba.observado_at).toLocaleString('es-CL')}</span>
            <span>{equipoPorId.get(prueba.equipo_id)?.nombre || prueba.equipo_id}</span><span>{prueba.estado} · {prueba.observacion || 'Sin observación'}</span>
          </article>)}
          {ciclosVisibles.length + pruebasVisibles.length === 0 && <p className="py-6 text-center text-graphite-500">Sin registros para los filtros seleccionados.</p>}
        </div>
        <p className="text-[10px] text-graphite-500">Los filtros se aplican sobre los últimos 300 ciclos y 500 resultados sincronizados. El libro y el CSV son informativos y no sustituyen un registro exigido por la autoridad.</p>
      </div>
    </div>
  )
})

LibroSeremiSection.displayName = 'LibroSeremiSection'
