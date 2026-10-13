import React, { memo, useState, useEffect, useMemo, useRef } from 'react'
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
import { useHistorialBusqueda } from '../../hooks/useHistorialBusqueda'
import { useRBAC } from '../../../../../shared/hooks/useRBAC'
import { PERMISOS } from '../../../../../constants/rbacConstants'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import { timelineService } from '../../services/timelineService'
import { pacientesStorageService } from '../../services/pacientesStorageService'
import { useSesionStore } from '../../../../../app/stores/sesionStore'
import type { Paciente } from '../../schemas/pacienteSchema'

import { PacientesKPIs } from './PacientesKPIs'
import { PacientesBusqueda } from './PacientesBusqueda'
import { PacientesFiltrosAvanzados } from './PacientesFiltrosAvanzados'
import { PacientesFiltrosGuardados } from './PacientesFiltrosGuardados'
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
  const cargarPacientes = usePacientesStore((s) => s.cargarPacientes)
  const isLoadingPacientes = usePacientesStore((s) => s.isLoadingPacientes)
  const setPacienteActivo = usePacientesStore((s) => s.setPacienteActivo)
  const vistaActual = usePacientesStore((s) => s.vistaActual)
  const filtros = usePacientesStore((s) => s.filtros)
  const busqueda = usePacientesStore((s) => s.busquedaActual)
  const setBusqueda = usePacientesStore((s) => s.setBusquedaActual)
  const userProfile = useSesionStore((s) => s.userProfile)
  const [mostrarFiltros, setMostrarFiltros] = useState<boolean>(false)
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState<boolean>(false)
  const [mostrarPapelera, setMostrarPapelera] = useState<boolean>(false)
  const [pacienteAccion, setPacienteAccion] = useState<{ paciente: Paciente; modo: 'desactivar' | 'bloquear' } | null>(null)
  const [cargandoInicial, setCargandoInicial] = useState<boolean>(pacientes.length === 0)

  const inputBusquedaRef = useRef<HTMLInputElement>(null)
  const { historial, agregarBusqueda, limpiarHistorial } = useHistorialBusqueda()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputBusquedaRef.current?.focus()
        inputBusquedaRef.current?.select()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (busqueda.trim().length >= 3) {
        agregarBusqueda(busqueda)
      }
    }, 500)
    return () => clearTimeout(handler)
  }, [busqueda, agregarBusqueda])

  useEffect(() => {
    const handleAbrirModal = () => setMostrarModalNuevo(true)
    window.addEventListener('abrir_nuevo_paciente', handleAbrirModal)
    return () => window.removeEventListener('abrir_nuevo_paciente', handleAbrirModal)
  }, [])

  useEffect(() => {
    if (pacientes.length === 0) {
      const fetchPacientes = async () => {
        try {
          await cargarPacientes()
        } catch (error) {
          console.error('Error cargando pacientes:', error)
          notificationService.mostrar('Error al cargar pacientes desde Supabase', { tipo: 'error' })
        } finally {
          setCargandoInicial(false)
        }
      }
      fetchPacientes()
    } else {
      setCargandoInicial(false)
    }
  }, [cargarPacientes, pacientes.length])

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

  const handleConfirmarAccion = async (motivo: string) => {
    if (!pacienteAccion) return
    const { paciente, modo } = pacienteAccion
    const pid = paciente.id
    const nuevoEstado = modo === 'desactivar' ? 'desactivado' : 'bloqueado'
    const estadoAnterior = paciente.estado || 'activo'
    const usuarioNombre = String(userProfile?.nombreCompleto || userProfile?.nombre || 'Admin')

    if (modo === 'desactivar') {
      setPacientes((prev) =>
        prev.map((p) =>
          String(p.id) === String(pid)
            ? { ...p, estado: 'desactivado', deleted_at: new Date().toISOString(), motivoDesactivacion: motivo }
            : p
        )
      )
      await pacientesStorageService.actualizarPaciente(pid, { estado: 'desactivado' })
      await timelineService.agregarEvento(pid, {
        tipo: 'cambio_estado',
        fecha: new Date().toISOString(),
        titulo: `Paciente desactivado por ${usuarioNombre}`,
        detalles: `Estado anterior: ${estadoAnterior} · Motivo: ${motivo}`,
        usuario: usuarioNombre,
      })
      handleEliminarConPapelera(pid)
      notificationService.mostrar('Paciente desactivado correctamente', { tipo: 'success' })
    } else {
      setPacientes((prev) =>
        prev.map((p) =>
          String(p.id) === String(pid)
            ? { ...p, estado: 'bloqueado', bloqueado: true, motivoBloqueo: motivo, bloqueadoPor: usuarioNombre, bloqueadoAt: new Date().toISOString() }
            : p
        )
      )
      await pacientesStorageService.actualizarPaciente(pid, {
        estado: 'bloqueado',
        bloqueado: true,
        motivoBloqueo: motivo,
      })
      await timelineService.agregarEvento(pid, {
        tipo: 'cambio_estado',
        fecha: new Date().toISOString(),
        titulo: `Paciente bloqueado por ${usuarioNombre}`,
        detalles: `Estado anterior: ${estadoAnterior} · Motivo: ${motivo}`,
        usuario: usuarioNombre,
      })
      notificationService.mostrar('Paciente bloqueado para nuevas citas', { tipo: 'warning' })
    }
    setPacienteAccion(null)
    await refrescar()
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
      // Búsqueda multi-campo: nombre, RUT, teléfono, email, ID ficha
      const nom = (p.nombre || p.nombreCompleto || '').toLowerCase()
      const rutStr = (p.rut || '').toLowerCase()
      const telStr = p.telefono ? String(p.telefono) : ''
      const emailStr = (p.email || '').toLowerCase()
      const idStr = String(p.id || '')

      const q = busqueda.toLowerCase().trim()

      const coincideBusqueda =
        !q ||
        nom.includes(q) ||
        rutStr.includes(q) ||
        telStr.includes(q) ||
        emailStr.includes(q) ||
        idStr.includes(q)

      if (!coincideBusqueda) return false

      // 1. Filtro de estado
      const esDesactivado = p.estado === 'desactivado' || Boolean(p.deleted_at)
      if (esDesactivado && !q && !filtros.estado.includes('desactivado')) {
        return false
      }

      if (filtros.estado.length > 0 && !filtros.estado.includes(p.estado || 'activo')) {
        return false
      }

      // 2. Filtro de doctor
      if (filtros.doctor && filtros.doctor.length > 0) {
        const docId = String(p.doctorTratanteId || p.doctorTratante || '')
        if (!filtros.doctor.includes(docId)) return false
      }

      // 3. Filtro de última visita
      if (filtros.ultimaVisita && p.fechaUltimaVisita) {
        const fechaUltima = new Date(String(p.fechaUltimaVisita))
        const fechaFiltro = new Date(filtros.ultimaVisita)
        if (fechaUltima > fechaFiltro) return false
      }

      // 4. Filtro de próxima cita
      if (filtros.proximaCita && p.proximaCita) {
        const fechaProxima = new Date(String(p.proximaCita))
        const fechaFiltro = new Date(filtros.proximaCita)
        if (fechaProxima < fechaFiltro) return false
      }

      // 5. Filtro de edad
      if (filtros.edadMin && (p.edad == null || Number(p.edad) < Number(filtros.edadMin))) return false
      if (filtros.edadMax && (p.edad == null || Number(p.edad) > Number(filtros.edadMax))) return false

      // 6. Filtro de previsión
      if (filtros.prevision && filtros.prevision.length > 0 && !filtros.prevision.includes(p.prevision || '')) {
        return false
      }

      // 7. Filtro de etiquetas
      if (filtros.etiquetas && filtros.etiquetas.length > 0 && !filtros.etiquetas.some((tag) => (p.etiquetas || []).includes(tag))) {
        return false
      }

      // 8. Filtro de tratamiento
      if (
        filtros.tratamiento &&
        !(
          String(p.tratamientoActivo || (p as unknown as Record<string, unknown>).tratamiento || '')
            .toLowerCase()
            .includes(filtros.tratamiento.toLowerCase())
        )
      ) {
        return false
      }

      return true
    })
  }, [pacientes, busqueda, filtros])

  if (cargandoInicial && pacientes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="pacientes-loading-state">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-graphite-500 text-sm font-medium">Cargando pacientes...</p>
        </div>
      </div>
    )
  }

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
      <PacientesBusqueda
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        totalResultados={pacientesFiltrados.length}
        inputRef={inputBusquedaRef}
        mostrarFiltros={mostrarFiltros}
        onToggleFiltros={() => setMostrarFiltros((prev) => !prev)}
        historial={historial}
        onLimpiarHistorial={limpiarHistorial}
      />

      {mostrarFiltros && (
        <div className="space-y-4 mb-6">
          <PacientesFiltrosAvanzados />
          <PacientesFiltrosGuardados />
        </div>
      )}

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
          busqueda={busqueda}
          alSeleccionarPaciente={handleSeleccionar}
          alEliminarPaciente={handleEliminarConPapelera}
          onDesactivarPaciente={handleSolicitarDesactivar}
          onBloquearPaciente={(p) => setPacienteAccion({ paciente: p, modo: 'bloquear' })}
        />
      ) : vistaActual === 'tarjetas' ? (
        <VistaTarjetas
          pacientes={pacientesFiltrados}
          busqueda={busqueda}
          alSeleccionarPaciente={handleSeleccionar}
          alEliminarPaciente={handleEliminarConPapelera}
          onDesactivarPaciente={handleSolicitarDesactivar}
          onBloquearPaciente={(p) => setPacienteAccion({ paciente: p, modo: 'bloquear' })}
        />
      ) : (
        <VistaLista
          pacientes={pacientesFiltrados}
          busqueda={busqueda}
          alSeleccionarPaciente={handleSeleccionar}
          alEliminarPaciente={handleEliminarConPapelera}
          onDesactivarPaciente={handleSolicitarDesactivar}
          onBloquearPaciente={(p) => setPacienteAccion({ paciente: p, modo: 'bloquear' })}
        />
      )}

      <PacientesAccionesMasivas />

      {mostrarModalNuevo && (
        <ModalNuevoPaciente
          pacientes={pacientes}
          alGuardar={handleCrearPaciente}
          alCerrar={() => setMostrarModalNuevo(false)}
          onVerFichaExistente={(paciente) => {
            setMostrarModalNuevo(false)
            setPacienteActivo(paciente)
          }}
        />
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
