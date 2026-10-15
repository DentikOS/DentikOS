import React, { memo, useState } from 'react'
import { Ban } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { SILLONES_DENTALES, TIPOS_BLOQUEO } from '../constants/agendaConstants'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { detectarConflictoBloqueo } from '../utils/agendaConflictos'
import type { Cita } from '../schemas/citaSchema'

export interface ModalNuevoBloqueoProps {
  fechaPredeterminada?: string
  alGuardar: (bloqueo: Cita) => void
  alCerrar: () => void
  citasExistentes?: Cita[]
}

export const ModalNuevoBloqueo: React.FC<ModalNuevoBloqueoProps> = memo(({
  fechaPredeterminada,
  alGuardar,
  alCerrar,
  citasExistentes = []
}) => {
  const { alert: dialogAlert, confirm: dialogConfirm } = useAppDialog()
  const [form, setForm] = useState({
    tipoBloqueo: 'almuerzo',
    fecha: fechaPredeterminada || obtenerFechaLocalISO(),
    fechaFin: '',
    horaInicio: '13:00',
    horaFin: '14:00',
    boxAsignado: 'Todos los Boxes',
    observaciones: '',
    recurrencia: 'ninguna',
    diasSemana: [1, 2, 3, 4, 5]
  })

  const tipoSeleccionado = Object.values(TIPOS_BLOQUEO).find((t) => t.id === form.tipoBloqueo)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()

    if (form.tipoBloqueo !== 'vacaciones' && form.horaInicio >= form.horaFin) {
      await dialogAlert({
        title: 'Horario inválido',
        description: 'La hora de fin debe ser posterior a la hora de inicio.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    if (form.tipoBloqueo === 'vacaciones' && form.fechaFin && form.fechaFin < form.fecha) {
      await dialogAlert({
        title: 'Rango de fechas inválido',
        description: 'La fecha de fin debe ser posterior a la fecha de inicio.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    const { hayConflicto, citasConflicto } = detectarConflictoBloqueo(
      {
        fecha: form.fecha,
        horaInicio: form.tipoBloqueo === 'vacaciones' ? '08:00' : form.horaInicio,
        horaFin: form.tipoBloqueo === 'vacaciones' ? '20:00' : form.horaFin,
        boxAsignado: form.boxAsignado,
      },
      citasExistentes
    )

    if (hayConflicto) {
      const descripcion = citasConflicto
        .map((c) => {
          const label = c.esBloqueo
            ? `Bloqueo: ${c.motivoBloqueo || 'Sin motivo'}`
            : `Cita: ${c.pacienteNombre || c.trataMiento || 'Sin paciente'}`
          return `* ${label} (${c.horaInicio} - ${c.horaFin}, ${c.boxAsignado || 'Box'})`
        })
        .join('\n')

      const confirmar = await dialogConfirm({
        title: 'Conflicto de horario',
        description: `El bloqueo se superpone con ${citasConflicto.length} actividad(es):\n${descripcion}\n\n¿Deseas continuar?`,
        variant: 'warning',
        confirmText: 'Continuar de todos modos',
        cancelText: 'Cancelar'
      })
      if (!confirmar) return
    }

    const bloqueo: Cita = {
      id: Date.now(),
      esBloqueo: true,
      fecha: form.fecha,
      motivoBloqueo: tipoSeleccionado?.label || 'Bloqueo',
      horaInicio: form.tipoBloqueo === 'vacaciones' ? '08:00' : form.horaInicio,
      horaFin: form.tipoBloqueo === 'vacaciones' ? '20:00' : form.horaFin,
      boxAsignado: form.boxAsignado,
      observaciones: form.observaciones,
      estado: 'Bloqueado',
      pacienteId: 'bloqueo',
      pacienteNombre: 'Bloqueo Horario',
      trataMiento: tipoSeleccionado?.label || 'Bloqueo',
      bloqueoRecurrencia: form.recurrencia !== 'ninguna' ? (form.recurrencia as any) : undefined,
      bloqueoFechaFin: form.fechaFin || undefined,
      bloqueoDiasSemana: form.recurrencia === 'semanal' ? form.diasSemana : undefined,
      tipoBloqueoId: form.tipoBloqueo,
      colorBloqueo: tipoSeleccionado?.color || '#94A3B8'
    }

    alGuardar(bloqueo)
    alCerrar()
  }

  return (
    <Modal isOpen={true} onClose={alCerrar} title="Añadir bloqueo / mantenimiento" size="md">
      <p className="text-xs text-graphite-500 dark:text-graphite-400 mb-4">
        Reserva franjas horarias no disponibles para atención.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="font-semibold text-graphite-700 dark:text-graphite-300 block mb-1">
            Tipo de Bloqueo
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(TIPOS_BLOQUEO).map((tipo) => {
              const Icon = tipo.icon
              const seleccionado = form.tipoBloqueo === tipo.id
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => setForm({ ...form, tipoBloqueo: tipo.id })}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 cursor-pointer ${
                    seleccionado
                      ? 'border-current bg-surface-muted/60 dark:bg-surface-muted/30 font-bold'
                      : 'border-surface-border hover:border-graphite-300 dark:hover:border-graphite-600'
                  }`}
                  style={{ color: tipo.color }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs">{tipo.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={form.tipoBloqueo === 'vacaciones' ? 'Fecha Inicio' : 'Fecha'}
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            required
          />

          {form.tipoBloqueo === 'vacaciones' && (
            <Input
              label="Fecha Fin"
              type="date"
              value={form.fechaFin}
              onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
            />
          )}
        </div>

        <div>
          <label className="font-semibold text-graphite-700 dark:text-graphite-300 block mb-1">
            Box / Sillón
          </label>
          <select
            value={form.boxAsignado}
            onChange={(e) => setForm({ ...form, boxAsignado: e.target.value })}
            className="w-full p-2.5 rounded-xl border border-graphite-300 dark:border-graphite-600 font-semibold bg-graphite-50 dark:bg-graphite-900 focus:bg-white dark:focus:bg-graphite-800 dark:text-graphite-100"
          >
            <option value="Todos los Boxes">Todos los Boxes</option>
            {SILLONES_DENTALES.map((s) => (
              <option key={s.id} value={s.nombre}>{s.nombre}</option>
            ))}
          </select>
        </div>

        {form.tipoBloqueo !== 'vacaciones' && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Hora Inicio"
              type="time"
              value={form.horaInicio}
              onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
              required
            />

            <Input
              label="Hora Fin"
              type="time"
              value={form.horaFin}
              onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
              required
            />
          </div>
        )}

        {tipoSeleccionado?.permiteRecurrencia && (
          <div>
            <label htmlFor="select-recurrencia" className="font-semibold text-graphite-700 dark:text-graphite-300 block mb-1">
              Repetir
            </label>
            <select
              id="select-recurrencia"
              value={form.recurrencia}
              onChange={(e) => setForm({ ...form, recurrencia: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-graphite-300 dark:border-graphite-600 font-semibold bg-graphite-50 dark:bg-graphite-900 focus:bg-white dark:focus:bg-graphite-800 dark:text-graphite-100"
            >
              <option value="ninguna">No repetir</option>
              <option value="diario">Diario (Lun-Vie)</option>
              <option value="semanal">Semanal (días específicos)</option>
              <option value="mensual">Mensual</option>
            </select>

            {form.recurrencia === 'semanal' && (
              <div className="mt-3">
                <label className="font-semibold text-graphite-700 dark:text-graphite-300 block mb-1">
                  Días de la semana
                </label>
                <div className="flex gap-2 flex-wrap">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia, idx) => (
                    <label key={dia} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.diasSemana.includes(idx + 1)}
                        onChange={(e) => {
                          const nuevos = e.target.checked
                            ? [...form.diasSemana, idx + 1]
                            : form.diasSemana.filter((d) => d !== idx + 1)
                          setForm({ ...form, diasSemana: nuevos })
                        }}
                      />
                      <span className="text-xs">{dia}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Input
          label="Notas / Observaciones (Opcional)"
          type="text"
          value={form.observaciones}
          onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
          placeholder="Ej. Revisión anual de compresor dental"
        />

        <div className="flex justify-end gap-2 pt-3 border-t border-graphite-100 dark:border-graphite-700">
          <Button type="button" onClick={alCerrar} variant="ghost">
            Cancelar
          </Button>
          <Button type="submit" variant="danger" icon={Ban}>
            Bloquear horario
          </Button>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevoBloqueo.displayName = 'ModalNuevoBloqueo'
