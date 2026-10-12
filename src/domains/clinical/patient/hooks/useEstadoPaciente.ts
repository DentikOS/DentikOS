import { useEffect } from 'react'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import { calcularEstadoClinico } from '../utils/estadosPacienteCalculations'
import { pacientesStorageService } from '../services/pacientesStorageService'
import type { Paciente } from '../schemas/pacienteSchema'

/**
 * Hook que sincroniza el estado clínico calculado con el almacenado.
 * Solo actualiza si el estado actual es clínico (activo/inactivo/nuevo),
 * NUNCA sobreescribe estados administrativos (bloqueado/desactivado).
 */
export const useEstadoPaciente = (paciente: Paciente | null): void => {
  const setPacientes = usePacientesStore((s) => s.setPacientes)

  useEffect(() => {
    if (!paciente?.id) return

    const estadosAdministrativos = ['bloqueado', 'desactivado']
    if (estadosAdministrativos.includes(paciente.estado || '')) return

    const estadoCalculado = calcularEstadoClinico(paciente)
    if (paciente.estado === estadoCalculado) return

    // Actualizar en store
    setPacientes((prev) =>
      prev.map((p) =>
        String(p.id) === String(paciente.id) ? { ...p, estado: estadoCalculado } : p
      )
    )

    // Persistir en Supabase / local en background
    pacientesStorageService
      .actualizarPaciente(paciente.id, { estado: estadoCalculado })
      .catch((e: unknown) => console.error('Error sincronizando estado:', e))
  }, [
    paciente?.id,
    paciente?.fechaUltimaVisita,
    (paciente as unknown as Record<string, unknown>)?.ultimaVisita,
    paciente?.estado,
    setPacientes,
  ])
}
