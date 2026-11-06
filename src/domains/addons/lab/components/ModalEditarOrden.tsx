import React, { memo, useMemo, useState } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import type { OrdenLaboratorio, LaboratorioBase } from '../constants/laboratorioConstants'
import type { TipoTrabajoLaboratorio } from '../hooks/useLaboratorio'

type Changes = Partial<{
  laboratorioId: string | null
  tipoTrabajoId: string
  plantillaId: string | null
  plantillaSnapshot: Record<string, unknown>
  piezaDentaria: string | null
  colorGuia: string | null
  indicacionesTecnicas: string | null
  observaciones: string | null
  fechaEstimadaEntrega: string | null
}>

interface Props {
  orden: OrdenLaboratorio
  laboratorios: LaboratorioBase[]
  tiposTrabajo: TipoTrabajoLaboratorio[]
  plantillas: Record<string, unknown>[]
  onGuardar: (changes: Changes) => Promise<void>
  onCerrar: () => void
}

const activeTemplates = (items: Record<string, unknown>[]): Record<string, unknown>[] => items.filter(item => item.estado === 'activo')
const snapshot = (item: Record<string, unknown>): Record<string, unknown> => ({
  id: item.id, nombre: item.nombre, categoria: item.categoria, version: item.version,
  descripcion: item.descripcion, dias_estimados: item.dias_estimados, etapas: item.etapas,
  fotos_requeridas: item.fotos_requeridas, campos_personalizados: item.campos_personalizados
})

export const ModalEditarOrden: React.FC<Props> = memo(({ orden, laboratorios, tiposTrabajo, plantillas, onGuardar, onCerrar }) => {
  const [laboratorioId, setLaboratorioId] = useState(orden.laboratorioId ? String(orden.laboratorioId) : '')
  const [tipoTrabajoId, setTipoTrabajoId] = useState(orden.tipoTrabajoId || '')
  const [plantillaId, setPlantillaId] = useState(orden.plantillaId || '')
  const [piezaDentaria, setPiezaDentaria] = useState(orden.piezaDientaria || '')
  const [colorGuia, setColorGuia] = useState(orden.colorGuia || '')
  const [fechaEstimadaEntrega, setFechaEstimadaEntrega] = useState(orden.fechaEntregaPrometida || '')
  const [indicacionesTecnicas, setIndicacionesTecnicas] = useState(orden.indicacionesTecnicas || '')
  const [observaciones, setObservaciones] = useState(orden.observaciones || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plantillasDisponibles = useMemo(() => activeTemplates(plantillas), [plantillas])

  const guardar = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const tipo = tiposTrabajo.find(item => item.id === tipoTrabajoId && item.estado === 'activo')
    const tipoValido = Boolean(tipo)
    const laboratorioValido = !laboratorioId || laboratorios.some(lab => String(lab.id) === laboratorioId && lab.estado !== 'inactivo')
    const plantilla = plantillasDisponibles.find(item => String(item.id) === plantillaId)
    const categoriaPlantilla = plantilla?.categoria || (plantillaId === orden.plantillaId ? orden.plantillaSnapshot?.categoria : undefined)
    if (!tipoValido || !laboratorioValido || (plantillaId && !plantilla && plantillaId !== orden.plantillaId)
      || (plantillaId && categoriaPlantilla && tipo?.categoria !== categoriaPlantilla)) {
      setError('Confirma que el tipo, laboratorio y plantilla sigan disponibles en la clínica.')
      return
    }
    if (fechaEstimadaEntrega && fechaEstimadaEntrega < orden.fechaEnvio) {
      setError('La fecha estimada debe ser posterior a la fecha de solicitud.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onGuardar({
        laboratorioId: laboratorioId || null,
        tipoTrabajoId,
        plantillaId: plantillaId || null,
        plantillaSnapshot: plantilla ? snapshot(plantilla) : (plantillaId ? orden.plantillaSnapshot || {} : {}),
        piezaDentaria: piezaDentaria.trim() || null,
        colorGuia: colorGuia.trim() || null,
        fechaEstimadaEntrega: fechaEstimadaEntrega || null,
        indicacionesTecnicas: indicacionesTecnicas.trim() || null,
        observaciones: observaciones.trim() || null
      })
      onCerrar()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo editar la orden.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen onClose={onCerrar} title={`Editar orden ${orden.codigoOrden}`} size="lg">
      <form onSubmit={event => void guardar(event)} className="space-y-3">
        <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">Paciente: <strong className="text-foreground">{orden.pacienteNombre}</strong>. El vínculo con el paciente no se cambia al editar una orden.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-medium"><span>Tipo de trabajo *</span>
            <select required value={tipoTrabajoId} onChange={event => setTipoTrabajoId(event.target.value)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              {tiposTrabajo.filter(tipo => tipo.estado === 'activo').map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.categoria} · {tipo.nombre}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-xs font-medium"><span>Laboratorio</span>
            <select value={laboratorioId} onChange={event => setLaboratorioId(event.target.value)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              <option value="">Por asignar</option>
              {laboratorios.filter(lab => lab.estado !== 'inactivo').map(lab => <option key={String(lab.id)} value={String(lab.id)}>{lab.nombre}</option>)}
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-xs font-medium"><span>Plantilla</span>
          <select value={plantillaId} onChange={event => setPlantillaId(event.target.value)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
            <option value="">Sin plantilla</option>
            {plantillaId && !plantillasDisponibles.some(item => String(item.id) === plantillaId) && <option value={plantillaId}>Versión histórica aplicada a esta orden</option>}
            {plantillasDisponibles.map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.nombre)} · v{String(item.version || 1)}</option>)}
          </select>
          <span className="block text-[11px] text-muted-foreground">La orden conserva la versión aplicada en una copia inmutable.</span>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Pieza dental / sector" maxLength={120} value={piezaDentaria} onChange={event => setPiezaDentaria(event.target.value)} />
          <Input label="Color / guía" maxLength={80} value={colorGuia} onChange={event => setColorGuia(event.target.value)} />
          <Input label="Fecha estimada de entrega" type="date" min={orden.fechaEnvio} value={fechaEstimadaEntrega} onChange={event => setFechaEstimadaEntrega(event.target.value)} />
        </div>
        <label className="block space-y-1 text-xs font-medium"><span>Indicaciones técnicas</span>
          <textarea rows={3} maxLength={2000} value={indicacionesTecnicas} onChange={event => setIndicacionesTecnicas(event.target.value)} className="w-full rounded-lg border border-surface bg-background p-2.5" />
        </label>
        <label className="block space-y-1 text-xs font-medium"><span>Observaciones</span>
          <textarea rows={2} maxLength={2000} value={observaciones} onChange={event => setObservaciones(event.target.value)} className="w-full rounded-lg border border-surface bg-background p-2.5" />
        </label>
        {error && <p role="alert" className="text-xs text-clinical-error">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" disabled={guardando} onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" loading={guardando}>Guardar cambios</Button>
        </div>
      </form>
    </Modal>
  )
})

ModalEditarOrden.displayName = 'ModalEditarOrden'
