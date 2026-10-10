import React, { memo, useState, useEffect, useMemo } from 'react'
import { Trash2, Plus, Users } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Badge } from '../../../../../shared/ui/ui/Badge'
import { PageHeader } from '../../../../../shared/ui/ui/PageHeader'
import { EmptyState } from '../../../../../shared/ui/ui/EmptyState'
import { usePacientesStore } from '../../../../../app/stores/pacientesStore'
import { ModalNuevoPaciente, type NuevoPacienteFormData } from '../ModalNuevoPaciente'
import { ModalPapelera } from '../ModalPapelera'
import { usePapelera } from '../../hooks/usePapelera'
import { useRBAC } from '../../../../../shared/hooks/useRBAC'
import { PERMISOS } from '../../../../../constants/rbacConstants'
import type { Paciente } from '../../schemas/pacienteSchema'

import { PacientesKPIs } from './PacientesKPIs'
import { PacientesBusqueda } from './PacientesBusqueda'
import { VistaLista } from './VistaLista'
import { VistaTabla } from './VistaTabla'
import { VistaTarjetas } from './VistaTarjetas'
import { PacientesAccionesMasivas } from './PacientesAccionesMasivas'

export interface PacientesListadoProps {
  alSeleccionarPaciente: (paciente: Paciente) => void
  alEliminarPaciente: (id: string | number) => Promise<boolean> | boolean
  alPacienteCreado?: (nuevoPaciente: NuevoPacienteFormData | Paciente) => void
}

export const PacientesListado: React.FC<PacientesListadoProps> = memo(({
  alSeleccionarPaciente,
  alEliminarPaciente,
  alPacienteCreado,
}) => {
  const pacientes = usePacientesStore((s) => s.pacientes)
  const setPacientes = usePacientesStore((s) => s.setPacientes)
  const vistaActual = usePacientesStore((s) => s.vistaActual)
  const filtros = usePacientesStore((s) => s.filtros)

  const [busqueda, setBusqueda] = useState<string>('')
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState<boolean>(false)
  const [mostrarPapelera, setMostrarPapelera] = useState<boolean>(false)

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

  const handleEliminarConPapelera = async (id: string | number): Promise<void> => {
    const exito = await alEliminarPaciente(id)
    if (exito) {
      await refrescar()
    }
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

      if (filtros.estado.length > 0) {
        const est = p.estado || 'activo'
        if (!filtros.estado.includes(est)) return false
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
                icon={Trash2}
              >
                Papelera
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

      <PacientesBusqueda
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        totalResultados={pacientesFiltrados.length}
      />

      {pacientesFiltrados.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin pacientes"
          description={
            busqueda
              ? `No hay pacientes que coincidan con "${busqueda}".`
              : 'Aún no hay pacientes registrados. Crea el primero para comenzar.'
          }
          action={
            !busqueda && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setMostrarModalNuevo(true)}
              >
                Crear primer paciente
              </Button>
            )
          }
        />
      ) : vistaActual === 'tabla' ? (
        <VistaTabla
          pacientes={pacientesFiltrados}
          alSeleccionarPaciente={alSeleccionarPaciente}
          alEliminarPaciente={handleEliminarConPapelera}
        />
      ) : vistaActual === 'tarjetas' ? (
        <VistaTarjetas
          pacientes={pacientesFiltrados}
          alSeleccionarPaciente={alSeleccionarPaciente}
          alEliminarPaciente={handleEliminarConPapelera}
        />
      ) : (
        <VistaLista
          pacientes={pacientesFiltrados}
          alSeleccionarPaciente={alSeleccionarPaciente}
          alEliminarPaciente={handleEliminarConPapelera}
        />
      )}

      <PacientesAccionesMasivas />

      {mostrarModalNuevo && (
        <ModalNuevoPaciente
          pacientes={pacientes}
          alGuardar={handleCrearPaciente}
          alCerrar={() => setMostrarModalNuevo(false)}
        />
      )}

      {mostrarPapelera && (
        <ModalPapelera
          pacientesEliminados={pacientesEliminados}
          cargando={cargando}
          onRestaurar={restaurar}
          onVaciar={vaciar}
          contadorElegibles={contadorElegibles}
          aniosRetencion={aniosRetencion}
          puedeVaciar={puede(PERMISOS.VACIAR_PAPELERA)}
          onCerrar={() => setMostrarPapelera(false)}
        />
      )}
    </div>
  )
})

PacientesListado.displayName = 'PacientesListado'
