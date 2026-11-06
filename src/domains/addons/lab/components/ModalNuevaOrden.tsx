import React, { memo, useMemo, useState } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { esUuidValido } from '../../../../infrastructure/supabase/migrations/uuidUtils'
import { laboratorioCloudService, type NuevaOrdenLaboratorioInput } from '../services/laboratorioCloudService'
import type { LaboratorioBase } from '../constants/laboratorioConstants'
import type { TipoTrabajoLaboratorio } from '../hooks/useLaboratorio'

const sumarDiasISO = (fecha: string, dias: number | null | undefined): string => {
  if (!fecha || !Number.isInteger(dias) || !dias || dias < 1 || dias > 365) return ''
  const [year, month, day] = fecha.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day))
  result.setUTCDate(result.getUTCDate() + dias)
  return result.toISOString().slice(0, 10)
}

export interface PacienteParaLab {
  id: string | number
  nombre: string
  rut?: string
  [key: string]: unknown
}

export interface ModalNuevaOrdenProps {
  pacientes?: PacienteParaLab[]
  laboratorios?: LaboratorioBase[]
  tiposTrabajo?: TipoTrabajoLaboratorio[]
  plantillas?: Record<string, unknown>[]
  rol: string
  alGuardar: (input: NuevaOrdenLaboratorioInput) => Promise<void>
  alCerrar: () => void
}

export const ModalNuevaOrden: React.FC<ModalNuevaOrdenProps> = memo(({
  pacientes = [],
  laboratorios = [],
  tiposTrabajo = [],
  plantillas = [],
  rol,
  alGuardar,
  alCerrar
}) => {
  const { alert: dialogAlert } = useAppDialog()
  const pacientesValidos = useMemo(() => pacientes.filter(paciente => esUuidValido(String(paciente.id))), [pacientes])
  const [pacienteId, setPacienteId] = useState('')
  const [laboratorioId, setLaboratorioId] = useState('')
  const [tipoTrabajoId, setTipoTrabajoId] = useState('')
  const [plantillaId, setPlantillaId] = useState('')
  const [piezaDentaria, setPiezaDentaria] = useState('')
  const [colorGuia, setColorGuia] = useState('')
  const [fechaSolicitud, setFechaSolicitud] = useState(obtenerFechaLocalISO())
  const [fechaEstimadaEntrega, setFechaEstimadaEntrega] = useState('')
  const [indicacionesTecnicas, setIndicacionesTecnicas] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const solicitudLimitada = rol === 'recepcion'
  const tiposTrabajoActivos = useMemo(() => tiposTrabajo.filter(tipo => tipo.estado === 'activo'), [tiposTrabajo])
  const plantillasActivas = useMemo(() => plantillas.filter(plantilla => plantilla.estado === 'activo'), [plantillas])

  const seleccionarTipo = (id: string): void => {
    setTipoTrabajoId(id)
    const tipo = tiposTrabajoActivos.find(item => item.id === id)
    const plantilla = plantillasActivas.find(item => item.id === plantillaId)
    if (plantilla && plantilla.categoria !== tipo?.categoria) setPlantillaId('')
    setFechaEstimadaEntrega(sumarDiasISO(fechaSolicitud, tipo?.diasEstimados))
  }

  const seleccionarPlantilla = (id: string): void => {
    setPlantillaId(id)
    const plantilla = plantillasActivas.find(item => item.id === id)
    const tipo = plantilla
      ? tiposTrabajo.find(item => item.categoria === plantilla.categoria
        && item.nombre.trim().toLocaleLowerCase('es-CL') === String(plantilla.nombre).trim().toLocaleLowerCase('es-CL'))
        || tiposTrabajoActivos.find(item => item.categoria === plantilla.categoria)
      : tiposTrabajoActivos.find(item => item.id === tipoTrabajoId)
    if (tipo) setTipoTrabajoId(tipo.id)
    const dias = typeof plantilla?.dias_estimados === 'number' ? plantilla.dias_estimados : tipo?.diasEstimados
    setFechaEstimadaEntrega(sumarDiasISO(fechaSolicitud, dias))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!pacientesValidos.some(paciente => String(paciente.id) === pacienteId)) {
      await dialogAlert({ title: 'Paciente requerido', description: 'Selecciona un paciente sincronizado con la clínica.', variant: 'warning', confirmText: 'Entendido' })
      return
    }
    if (!tiposTrabajoActivos.some(tipo => tipo.id === tipoTrabajoId)) {
      await dialogAlert({ title: 'Tipo de trabajo requerido', description: 'Selecciona un tipo de trabajo activo del catálogo.', variant: 'warning', confirmText: 'Entendido' })
      return
    }
    if (laboratorioId && !laboratorios.some(lab => String(lab.id) === laboratorioId)) {
      await dialogAlert({ title: 'Laboratorio no válido', description: 'Selecciona un laboratorio activo del directorio.', variant: 'warning', confirmText: 'Entendido' })
      return
    }
    if (fechaEstimadaEntrega && fechaEstimadaEntrega < fechaSolicitud) {
      await dialogAlert({ title: 'Fecha no válida', description: 'La fecha estimada debe ser posterior a la fecha de solicitud.', variant: 'warning', confirmText: 'Entendido' })
      return
    }

    setGuardando(true)
    try {
      await alGuardar({
        pacienteId,
        laboratorioId: solicitudLimitada ? null : laboratorioId || null,
        tipoTrabajoId,
        plantillaId: plantillaId || null,
        plantillaSnapshot: plantillasActivas.find(plantilla => plantilla.id === plantillaId)
          ? (() => {
            const selected = plantillasActivas.find(plantilla => plantilla.id === plantillaId)!
            return {
              id: selected.id, nombre: selected.nombre, categoria: selected.categoria,
              version: selected.version, descripcion: selected.descripcion,
              dias_estimados: selected.dias_estimados, etapas: selected.etapas,
              fotos_requeridas: selected.fotos_requeridas,
              campos_personalizados: selected.campos_personalizados
            }
          })()
          : {},
        piezaDentaria: solicitudLimitada ? null : piezaDentaria.trim() || null,
        colorGuia: solicitudLimitada ? null : colorGuia.trim() || null,
        fechaSolicitud,
        fechaEstimadaEntrega: solicitudLimitada ? null : fechaEstimadaEntrega || null,
        indicacionesTecnicas: solicitudLimitada ? null : indicacionesTecnicas.trim() || null,
        observaciones: observaciones.trim() || null,
        solicitudLimitada,
        idempotencyKey: laboratorioCloudService.generarIdempotencyKey()
      })
      alCerrar()
    } catch (error) {
      await dialogAlert({
        title: 'No se pudo guardar la solicitud',
        description: error instanceof Error ? error.message : 'Intenta nuevamente cuando se restablezca la conexión.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal isOpen onClose={alCerrar} title={solicitudLimitada ? 'Nueva solicitud de laboratorio' : 'Nueva orden de laboratorio'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="laboratorio-paciente" className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">Paciente *</label>
          <select id="laboratorio-paciente" required value={pacienteId} onChange={event => setPacienteId(event.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-semibold text-sm">
            <option value="">Seleccionar paciente</option>
            {pacientesValidos.map(patient => <option key={patient.id} value={patient.id}>{patient.nombre}</option>)}
          </select>
          {pacientesValidos.length === 0 && <p className="mt-1 text-[11px] text-amber-700">No hay pacientes sincronizados disponibles.</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="laboratorio-tipo-trabajo" className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">Tipo de trabajo *</label>
            <select id="laboratorio-tipo-trabajo" required value={tipoTrabajoId} onChange={event => seleccionarTipo(event.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-semibold text-sm">
              <option value="">Seleccionar del catálogo</option>
              {tiposTrabajoActivos.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.categoria} · {tipo.nombre}</option>)}
            </select>
            {tiposTrabajo.length === 0 && <p className="mt-1 text-[11px] text-amber-700">El catálogo no tiene tipos activos todavía.</p>}
          </div>
          {!solicitudLimitada && (
            <div>
              <label htmlFor="laboratorio-destino" className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">Laboratorio destino</label>
              <select id="laboratorio-destino" value={laboratorioId} onChange={event => setLaboratorioId(event.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-semibold text-sm">
                <option value="">Por asignar</option>
                {laboratorios.filter(lab => lab.estado !== 'inactivo').map(lab => <option key={lab.id} value={lab.id}>{lab.nombre}</option>)}
              </select>
            </div>
          )}
        </div>

        {!solicitudLimitada && plantillasActivas.length > 0 && <div>
          <label htmlFor="laboratorio-plantilla" className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">Plantilla de trabajo</label>
          <select id="laboratorio-plantilla" value={plantillaId} onChange={event => seleccionarPlantilla(event.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-semibold text-sm">
            <option value="">Sin plantilla</option>
            {plantillasActivas.map(plantilla => <option key={String(plantilla.id)} value={String(plantilla.id)}>{String(plantilla.nombre)} · v{String(plantilla.version || 1)}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">La orden guarda una copia de la versión elegida.</p>
        </div>}

        {!solicitudLimitada && <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Pieza dental / sector" type="text" placeholder="Ej. 1.1 o sector 2.1–2.3" value={piezaDentaria} onChange={event => setPiezaDentaria(event.target.value)} />
            <Input label="Color / guía" type="text" placeholder="Ej. A2" value={colorGuia} onChange={event => setColorGuia(event.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Fecha de solicitud" type="date" value={fechaSolicitud} onChange={event => {
              const nuevaFecha = event.target.value
              setFechaSolicitud(nuevaFecha)
              const plantilla = plantillasActivas.find(item => item.id === plantillaId)
              const tipo = tiposTrabajo.find(item => item.id === tipoTrabajoId)
              const dias = typeof plantilla?.dias_estimados === 'number' ? plantilla.dias_estimados : tipo?.diasEstimados
              setFechaEstimadaEntrega(sumarDiasISO(nuevaFecha, dias))
            }} required />
            <Input label="Fecha estimada de entrega" type="date" value={fechaEstimadaEntrega} onChange={event => setFechaEstimadaEntrega(event.target.value)} />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">Indicaciones técnicas</label>
            <textarea rows={3} maxLength={2000} value={indicacionesTecnicas} onChange={event => setIndicacionesTecnicas(event.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800" />
          </div>
        </>}

        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">Notas</label>
          <textarea rows={2} maxLength={2000} value={observaciones} onChange={event => setObservaciones(event.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={alCerrar} variant="ghost" fullWidth disabled={guardando}>Cancelar</Button>
          <Button type="submit" variant="primary" fullWidth disabled={guardando || pacientesValidos.length === 0 || tiposTrabajoActivos.length === 0}>
            {guardando ? 'Guardando…' : solicitudLimitada ? 'Enviar solicitud' : 'Crear orden'}
          </Button>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevaOrden.displayName = 'ModalNuevaOrden'
