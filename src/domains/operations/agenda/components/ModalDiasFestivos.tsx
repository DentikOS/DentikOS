import React, { useState, useEffect } from 'react'
import { Calendar, Plus, Trash2, AlertCircle } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { Input } from '../../../../shared/ui/ui/Input'
import { clinicConfigService, type ClinicHoliday } from '../services/clinicConfigService'

export interface ModalDiasFestivosProps {
  isOpen: boolean
  alCerrar: () => void
}

export const ModalDiasFestivos: React.FC<ModalDiasFestivosProps> = ({
  isOpen,
  alCerrar,
}) => {
  const [festivos, setFestivos] = useState<ClinicHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)
  const [nuevo, setNuevo] = useState({
    fecha: '',
    nombre: '',
    tipo: 'clinica' as 'nacional' | 'clinica' | 'regional',
    recurrente: false,
  })

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    Promise.resolve(clinicConfigService.obtenerFestivos?.())
      .then((data) => setFestivos(data || []))
      .catch(() => setFestivos([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  const handleAgregar = async () => {
    if (!nuevo.fecha || !nuevo.nombre.trim()) return
    const ok = await clinicConfigService.agregarFestivo(nuevo)
    if (ok) {
      const actualizados = await clinicConfigService.obtenerFestivos()
      setFestivos(actualizados)
      setNuevo({ fecha: '', nombre: '', tipo: 'clinica', recurrente: false })
      setMostrarFormNuevo(false)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este día festivo?')) return
    const ok = await clinicConfigService.eliminarFestivo(id)
    if (ok) {
      setFestivos(festivos.filter(f => f.id !== id))
    }
  }

  const badgeTipo = (tipo: string) => {
    const estilos = {
      nacional: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300',
      clinica: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-300',
      regional: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300',
    }
    return estilos[tipo as keyof typeof estilos] || estilos.clinica
  }

  return (
    <Modal isOpen={isOpen} onClose={alCerrar} title="Días festivos de la clínica" size="lg">
      <div className="space-y-4">
        {/* Aviso */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/50">
          <AlertCircle className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-sky-900 dark:text-sky-200">
            Al agendar citas en días festivos, el sistema mostrará alerta. Los festivos recurrentes se aplican cada año.
          </p>
        </div>

        {/* Lista de festivos */}
        {loading ? (
          <p className="text-xs text-slate-500 text-center py-4">Cargando festivos...</p>
        ) : festivos.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No hay días festivos configurados</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
            {festivos.map(f => {
              const fecha = new Date(f.fecha + 'T00:00:00')
              const fechaFormateada = fecha.toLocaleDateString('es-CL', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
              })
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-surface-border hover:bg-surface-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#0F172A] dark:text-white truncate">
                        {f.nombre}
                      </p>
                      <p className="text-[10px] text-slate-500 capitalize">
                        {fechaFormateada}
                        {f.recurrente && ' · Se repite cada año'}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badgeTipo(f.tipo)}`}>
                      {f.tipo}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEliminar(f.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    aria-label="Eliminar festivo"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Formulario nuevo */}
        {mostrarFormNuevo ? (
          <div className="p-3 rounded-xl border border-surface-border bg-surface-muted/30 space-y-3">
            <p className="text-xs font-bold text-[#0F172A] dark:text-white">Nuevo día festivo</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Fecha"
                type="date"
                value={nuevo.fecha}
                onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })}
              />
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Tipo</label>
                <select
                  value={nuevo.tipo}
                  onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as 'nacional' | 'clinica' | 'regional' })}
                  className="w-full p-2 rounded-lg border border-surface-border bg-surface text-xs"
                >
                  <option value="nacional">Nacional</option>
                  <option value="clinica">Clínica</option>
                  <option value="regional">Regional</option>
                </select>
              </div>
            </div>
            <Input
              label="Nombre"
              type="text"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              placeholder="Ej: Aniversario de la clínica"
            />
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={nuevo.recurrente}
                onChange={(e) => setNuevo({ ...nuevo, recurrente: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-[#B88E3A]"
              />
              <span>Se repite cada año</span>
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
              <Button size="sm" variant="ghost" onClick={() => setMostrarFormNuevo(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="primary" onClick={handleAgregar} icon={Plus}>
                Agregar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setMostrarFormNuevo(true)}
            icon={Plus}
            className="w-full"
          >
            Agregar día festivo
          </Button>
        )}

        <div className="pt-2 flex justify-end">
          <Button size="sm" variant="ghost" onClick={alCerrar}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
