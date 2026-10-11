import React, { memo, useState, useEffect, useMemo } from 'react'
import { Plus, Users, UserX } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Badge } from '../../../../../shared/ui/ui/Badge'
import { PageHeader } from '../../../../../shared/ui/ui/PageHeader'
import { EmptyState } from '../../../../../shared/ui/ui/EmptyState'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { ModalNuevoPaciente, type NuevoPacienteFormData } from '../ModalNuevoPaciente'
import { ModalPapelera } from '../ModalPapelera'
import { ModalDesactivarBloquear } from './ModalDesactivarBloquear'
import { usePapelera } from '../../hooks/usePapelera'
import { useRBAC } from '../../../../../shared/hooks/useRBAC'
import { PERMISOS } from '../../../../../constants/rbacConstants'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { timelineService } from '../../services/timelineService'
import type { Paciente } from '../../schemas/pacienteSchema'

import { PacientesKPIs } from './PacientesKPIs'
import { PacientesBusqueda } from './PacientesBusqueda'
import { VistaLista } from './VistaLista'
import { VistaTabla } from './VistaTabla'
import { VistaTarjetas } from './VistaTarjetas'
import { PacientesAccionesMasivas } from './PacientesAccionesMasivas'

export interface PacientesListadoProps {
  alSeleccionarPaciente?: (paciente: Paciente) => void
  alEliminarPaciente?: (id: string | number) => Promise<boolean> | boolean
  alPacienteCreado?: (nuevoPaciente: NuevoPacienteFormData | Paciente) => void
}

export const PacientesListado: React.FC<PacientesListadoProps> = memo(({
  alSeleccionarPaciente,
  alEliminarPaciente,
  alPacienteCreado,
}) => {
  const pacientes = usePacientesStore((s) => s.pacientes)
  const setPacientes = usePacientesStore((s) => s.setPacientes)
  const setPacienteActivo = usePacientesStore((s) => s.setPacienteActivo)
  const vistaActual = usePacientesStore((s) => s.vistaActual)
  const filtros = usePacientesStore((s) => s.filtros)

  const [busqueda, setBusqueda] = useState<string>('')
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState<boolean>(false)
  const [mostrarPapelera, setMostrarPapelera] = useState<boolean>(false)
  const [pacienteAccion, setPacienteAccion] = useState<{ paciente: Paciente; modo: 'desactivar' | 'bloquear' } | null>(null)

  useEffect(() => {
    const handleAbrirModal = () => setMostrarModalNuevo(true)
    window.addEventListener('abrir_nuevo_paciente', handleAbrirModal)
    return () => window.removeEventListener('abrir_nuevo_paciente', handleAbrirModal)
  }, [])

  const { puede } = useRBAC()
  const {
    pacientesEliminados,
    cargando,
    contador,
    restaurar,
    vaciar,
    contadorElegibles,
    aniosRetencion,
    refrescar,
  } = usePapelera()

  const handleSeleccionar = (paciente: Paciente) => {
    if (alSeleccionarPaciente) alSeleccionarPaciente(paciente)
    else setPacienteActivo(paciente)
  }

  const handleEliminarConPapelera = async (id: string | number): Promise<void> => {
    if (alEliminarPaciente) {
      const exito = await alEliminarPaciente(id)
      if (exito) await refrescar()
    } else {
      setPacientes((prev) => prev.filter((p) => String(p.id) !== String(id)))
      await refrescar()
    }
  }

  const handleSolicitarDesactivar = (p: Paciente) => {
    if (p.proximaCita || (p.citasFuturas && (p.citasFuturas as any).length > 0)) {
      notificationService.mostrar('No se puede desactivar: tiene citas futuras programadas', { tipo: 'warning' })
      return
    }
    setPacienteAccion({ paciente: p, modo: 'desactivar' })
  }

  const handleConfirmarAccion = (motivo: string) => {
    if (!pacienteAccion) return
    const pid = pacienteAccion.paciente.id

    if (pacienteAccion.modo === 'desactivar') {
      setPacientes((prev) =>
        prev.map((p) =>
          String(p.id) === String(pid)
            ? { ...p, estado: 'desactivado', deleted_at: new Date().toISOString(), motivoDesactivacion: motivo }
            : p
        )
      )
      timelineService.agregarEvento(pid, {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        tipo: 'admin',
        titulo: `Admin desactivó paciente · Motivo: ${motivo}`,
      })
      handleEliminarConPapelera(pid)
      notificationService.mostrar('Paciente desactivado correctamente', { tipo: 'success' })
    } else {
      setPacientes((prev) =>
        prev.map((p) =>
          String(p.id) === String(pid)
            ? { ...p, estado: 'bloqueado', bloqueado: true, motivoBloqueo: motivo, bloqueadoPor: 'Admin', bloqueadoAt: new Date().toISOString() }
            : p
        )
      )
      timelineService.agregarEvento(pid, {
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        tipo: 'admin',
        titulo: `Admin bloqueó paciente · Motivo: ${motivo}`,
      })
      notificationService.mostrar('Paciente bloqueado para nuevas citas', { tipo: 'warning' })
    }
    setPacienteAccion(null)
  }

  const handleRestaurar = async (pacienteId: string | number) => {
    await restaurar(pacienteId)
    setPacientes((prev) =>
      prev.map((p) => {
        if (String(p.id) !== String(pacienteId)) return p
        const dias = p.fechaUltimaVisita
          ? Math.floor((Date.now() - new Date(p.fechaUltimaVisita).getTime()) / (1000 * 3600 * 24))
          : 999
        return { ...p, estado: dias > 180 ? 'inactivo' : 'activo', deleted_at: null, motivoDesactivacion: undefined }
      })
    )
    timelineService.agregarEvento(pacienteId, {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      tipo: 'admin',
      titulo: 'Admin reactivó paciente',
    })
    notificationService.mostrar('Paciente reactivado exitosamente', { tipo: 'success' })
  }

  const handleCrearPaciente = (nuevoPaciente: NuevoPacienteFormData): void => {
    const pacienteFormateado = nuevoPaciente as unknown as Paciente
    setPacientes([pacienteFormateado, ...pacientes])
    setMostrarModalNuevo(false)
    if (alPacienteCreado) alPacienteCreado(pacienteFormateado)
  }

  const pacientesFiltrados = useMemo(() => {
    return pacientes.filter((p) => {
      const nom = (p.nombre || p.nombreCompleto || '').toLowerCase()
      const rutStr = (p.rut || '').toLowerCase()
      const telStr = p.telefono ? String(p.telefono) : ''
      const q = busqueda.toLowerCase().trim()

      const coincideBusqueda = !q || nom.includes(q) || rutStr.includes(q) || telStr.includes(q)
      if (!coincideBusqueda) return false

      const esDesactivado = p.estado === 'desactivado' || Boolean(p.deleted_at)
      if (esDesactivado && !q && !filtros.estado.includes('desactivado')) {
        return false
      }

      if (filtros.estado.length > 0 && !filtros.estado.includes(p.estado || 'activo')) {
        return false
      }

      return true
    })
  }, [pacientes, busqueda, filtros.estado])

  return (
    <div className="relative pb-16" data-testid="pacientes-listado-modulo">
      <PageHeader
        icon={Users}
        title="Directorio de Pacientes"
        description="Gestión integral de expedientes clínicos, antecedentes y citas."
        actions={
          <div className="flex gap-2">
            {puede(PERMISOS.VER_PAPELERA) && (
              <Button
                data-testid="btn-papelera"
                onClick={() => setMostrarPapelera(true)}
                variant="secondary"
                size="sm"
                icon={UserX}
              >
                Pacientes Desactivados
                {contador > 0 && (
                  <Badge size="sm" variant="neutral" className="ml-2">
                    {contador}
                  </Badge>
                )}
              </Button>
            )}
            <Button
              data-testid="btn-nuevo-paciente"
              onClick={() => setMostrarModalNuevo(true)}
              variant="primary"
              icon={Plus}
            >
              Nuevo Paciente
            </Button>
          </div>
        }
      />

      <PacientesKPIs pacientes={pacientes} />
      <PacientesBusqueda busqueda={busqueda} onBusquedaChange={setBusqueda} totalResultados={pacientesFiltrados.length} />

      {pacientesFiltrados.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin pacientes"
          description={busqueda ? `No hay pacientes que coincidan con "${busqueda}".` : 'Aún no hay pacientes registrados.'}
          action={!busqueda && <Button variant="primary" icon={Plus} onClick={() => setMostrarModalNuevo(true)}>Crear primer paciente</Button>}
        />
      ) : vistaActual === 'tabla' ? (
        <VistaTabla
          pacientes={pacientesFiltrados}
          alSeleccionarPaciente={handleSeleccionar}
          alEliminarPaciente={handleEliminarConPapelera}
          onDesactivarPaciente={handleSolicitarDesactivar}
          onBloquearPaciente={(p) => setPacienteAccion({ paciente: p, modo: 'bloquear' })}
        />
      ) : vistaActual === 'tarjetas' ? (
        <VistaTarjetas
          pacientes={pacientesFiltrados}
          alSeleccionarPaciente={handleSeleccionar}
          alEliminarPaciente={handleEliminarConPapelera}
          onDesactivarPaciente={handleSolicitarDesactivar}
          onBloquearPaciente={(p) => setPacienteAccion({ paciente: p, modo: 'bloquear' })}
        />
      ) : (
        <VistaLista
          pacientes={pacientesFiltrados}
          alSeleccionarPaciente={handleSeleccionar}
          alEliminarPaciente={handleEliminarConPapelera}
          onDesactivarPaciente={handleSolicitarDesactivar}
          onBloquearPaciente={(p) => setPacienteAccion({ paciente: p, modo: 'bloquear' })}
        />
      )}

      <PacientesAccionesMasivas />

      {mostrarModalNuevo && (
        <ModalNuevoPaciente pacientes={pacientes} alGuardar={handleCrearPaciente} alCerrar={() => setMostrarModalNuevo(false)} />
      )}

      {mostrarPapelera && (
        <ModalPapelera
          pacientesEliminados={pacientesEliminados}
          cargando={cargando}
          onRestaurar={handleRestaurar}
          onVaciar={vaciar}
          contadorElegibles={contadorElegibles}
          aniosRetencion={aniosRetencion}
          puedeVaciar={false}
          onCerrar={() => setMostrarPapelera(false)}
        />
      )}

      {pacienteAccion && (
        <ModalDesactivarBloquear
          modo={pacienteAccion.modo}
          paciente={pacienteAccion.paciente}
          onConfirmar={handleConfirmarAccion}
          onCerrar={() => setPacienteAccion(null)}
        />
      )}
    </div>
  )
})

PacientesListado.displayName = 'PacientesListado'
