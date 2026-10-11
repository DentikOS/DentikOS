import React, { useState, useMemo } from 'react'
import { tiempoRelativo } from '../../../../shared/utils/dateUtils'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { Scale, Calendar, User, ShieldCheck, UserX, X } from 'lucide-react'

export interface PacienteEliminadoUI {
  id: string | number
  nombre?: string
  rut?: string
  deleted_at?: string | null
  eliminadoPor?: string | null
  [key: string]: unknown
}

export interface ModalPapeleraProps {
  pacientesEliminados: PacienteEliminadoUI[]
  cargando: boolean
  onRestaurar: (pacienteId: string | number) => Promise<boolean | void>
  onVaciar?: () => Promise<void | unknown>
  contadorElegibles?: number
  aniosRetencion?: number
  puedeVaciar?: boolean
  onCerrar: () => void
}

export const ModalPapelera: React.FC<ModalPapeleraProps> = ({
  pacientesEliminados,
  cargando,
  onRestaurar,
  onCerrar,
}) => {
  const [busqueda, setBusqueda] = useState<string>('')
  const { confirm } = useAppDialog()
  const [restaurandoId, setRestaurandoId] = useState<string | number | null>(null)

  const pacientesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return pacientesEliminados
    const termino = busqueda.toLowerCase()
    return pacientesEliminados.filter((p) =>
      p.nombre?.toLowerCase().includes(termino) ||
      p.rut?.toLowerCase().includes(termino)
    )
  }, [pacientesEliminados, busqueda])

  const handleRestaurar = async (pacienteId: string | number): Promise<void> => {
    const confirmado = await confirm({
      title: 'Reactivar paciente',
      description: '¿Deseas reactivar este paciente? Su expediente clínico volverá a estar disponible en el directorio activo.',
      variant: 'warning',
      confirmText: 'Reactivar',
    })
    if (!confirmado) return
    setRestaurandoId(pacienteId)
    try {
      await onRestaurar(pacienteId)
    } finally {
      setRestaurandoId(null)
    }
  }

  const conteoTexto = `${pacientesEliminados.length} paciente${pacientesEliminados.length !== 1 ? 's' : ''} desactivado${pacientesEliminados.length !== 1 ? 's' : ''}`

  return (
    <Modal isOpen={true} onClose={onCerrar} size="xl" showCloseButton={false}>
      <div className="flex justify-between items-center mb-4 border-b dark:border-graphite-700 pb-3">
        <div>
          <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-50 inline-flex items-center gap-2">
            <UserX size={18} className="text-amber-500" />
            Pacientes Desactivados
          </h3>
          <p className="text-xs text-graphite-500 dark:text-graphite-400 mt-1">{conteoTexto}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="text-graphite-400 dark:text-graphite-500 hover:text-graphite-900 dark:hover:text-graphite-50 cursor-pointer"
          aria-label="Cerrar modal papelera"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nota Legal Ley 20.584 */}
      <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-200">
        <Scale size={16} className="shrink-0 text-amber-600" />
        <span>
          <strong>Ley 20.584:</strong> Las fichas clínicas no se destruyen. Retención mínima: 10 años.
        </span>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <Input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o RUT..."
        />
      </div>

      {/* Lista de pacientes desactivados */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-[420px]">
        {cargando ? (
          <div className="text-center py-12">
            <p className="text-graphite-500 dark:text-graphite-400">Cargando pacientes desactivados...</p>
          </div>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <UserX size={48} className="mx-auto mb-4 text-graphite-300" />
            <p className="text-graphite-500 dark:text-graphite-400 text-sm">
              {busqueda
                ? 'No se encontraron pacientes que coincidan con la búsqueda'
                : 'No hay pacientes desactivados'}
            </p>
          </div>
        ) : (
          pacientesFiltrados.map((paciente) => (
            <div
              key={paciente.id}
              className="p-4 border border-gray-200 dark:border-graphite-700 rounded-xl hover:border-gray-300 dark:hover:border-graphite-600 transition-all bg-gray-50 dark:bg-graphite-800"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-300 dark:bg-graphite-700 rounded-full flex items-center justify-center text-lg font-bold text-gray-600 dark:text-gray-300 shrink-0">
                  {paciente.nombre?.charAt(0).toUpperCase() || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-graphite-900 dark:text-graphite-50 text-sm truncate">
                    {paciente.nombre || 'Sin nombre'}
                  </h4>
                  <p className="text-xs text-graphite-600 dark:text-graphite-400 mt-1">
                    RUT: {paciente.rut || 'Sin RUT'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-graphite-500 dark:text-graphite-400">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={10} /> Desactivado {tiempoRelativo(paciente.deleted_at)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User size={10} /> Por: {paciente.eliminadoPor || 'Admin'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestaurar(paciente.id)}
                  disabled={restaurandoId === paciente.id}
                  className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <ShieldCheck size={14} />
                  {restaurandoId === paciente.id ? 'Reactivando...' : 'Reactivar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer informativo */}
      <div className="mt-4 pt-3 border-t dark:border-graphite-700 text-xs text-graphite-500 dark:text-graphite-400">
        <p>
          Los pacientes desactivados no pueden recibir citas pero conservan su historial legal inalterable.
        </p>
      </div>
    </Modal>
  )
}

ModalPapelera.displayName = 'ModalPapelera'
