import React, { memo } from 'react'
import { MessageCircle, Mail, Pin, Pencil, Trash2 } from 'lucide-react'
import {
  ESTADOS_CONFIRMACION_CITA,
  type MensajeHistorial
} from '../constants/comunicacionesConstants'
import { generarLinkWhatsAppWeb } from '../utils/comunicacionesCalculations'

export interface TablaHistorialMensajesProps {
  historial: MensajeHistorial[]
  onCambiarEstado: (id: number | string, nuevoEstado: string) => void
  onEditarBitacora: (registro: MensajeHistorial) => void
  onEliminarBitacora: (id: number | string) => void
}

export const TablaHistorialMensajes: React.FC<TablaHistorialMensajesProps> = memo(({
  historial,
  onCambiarEstado,
  onEditarBitacora,
  onEliminarBitacora
}) => {
  if (historial.length === 0) {
    return (
      <div className="p-10 text-center text-xs text-graphite-400 dark:text-graphite-500  bg-surface border border-surface rounded-2xl">
        No se encontraron registros en la bitácora de mensajes para el filtro seleccionado.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-surface rounded-2xl overflow-hidden shadow-xs text-xs">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-graphite-950  border-b border-surface text-graphite-600 dark:text-graphite-300  font-bold uppercase text-[10px]">
            <th className="p-3">Paciente / Contacto</th>
            <th className="p-3">Canal</th>
            <th className="p-3">Mensaje / Plantilla</th>
            <th className="p-3 text-center">Estado Confirmación</th>
            <th className="p-3">Fecha / Hora</th>
            <th className="p-3 text-right print:hidden">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface">
          {historial.map((m) => {
            const configEst =
              ESTADOS_CONFIRMACION_CITA.find((e) => e.id === m.estado) ||
              ESTADOS_CONFIRMACION_CITA[0]

            return (
              <tr
                key={m.id}
                className="hover:bg-slate-50 dark:hover:bg-graphite-800/50  transition-colors"
              >
                <td className="p-3">
                  <span className="font-extrabold text-graphite-900 dark:text-graphite-50  block">
                    {m.pacienteNombre}
                  </span>
                  <span className="text-[10px] text-graphite-500 dark:text-graphite-400  font-mono tabular-nums">
                    {m.pacienteTelefono || 'Sin fono'}
                  </span>
                </td>

                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] ${
                      m.canal === 'whatsapp'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                    }`}
                  >
                    {m.canal === 'whatsapp' ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={10} />
                        WhatsApp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={10} />
                        Email
                      </span>
                    )}
                  </span>
                </td>

                <td className="p-3 max-w-xs">
                  <span className="font-bold text-graphite-800 dark:text-graphite-100  block text-[11px]">
                    {m.plantillaNombre}
                  </span>
                  <span
                    className="text-graphite-500 dark:text-graphite-400  text-[10px] truncate block"
                    title={m.mensajeEnviado}
                  >
                    {m.mensajeEnviado}
                  </span>
                  {m.notaBitacora && (
                    <span className="text-[10px] italic text-champagne-700 dark:text-gold-satin bg-gold-light dark:bg-graphite-800 px-1.5 py-0.5 rounded border border-gold-satin/40 dark:border-primary/40 inline-block mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Pin size={8} />
                        Nota: {m.notaBitacora}
                      </span>
                    </span>
                  )}
                </td>

                <td className="p-3 text-center">
                  <select
                    value={m.estado}
                    onChange={(e) => onCambiarEstado(m.id, e.target.value)}
                    className={`px-2 py-1 rounded-lg font-bold text-[10px] border bg-surface cursor-pointer ${configEst.colorText} ${configEst.colorBorder}`}
                  >
                    {ESTADOS_CONFIRMACION_CITA.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-3 font-semibold text-graphite-700 dark:text-graphite-300  tabular-nums">
                  {m.fechaEnvio}{' '}
                  <span className="text-graphite-400 dark:text-graphite-500 font-normal block">
                    {m.horaEnvio} hrs
                  </span>
                </td>

                <td className="p-3 text-right print:hidden space-x-1 whitespace-nowrap">
                  {m.canal === 'whatsapp' && m.pacienteTelefono && (
                    <a
                      href={generarLinkWhatsAppWeb(m.pacienteTelefono, m.mensajeEnviado)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-emerald-600 text-white font-bold rounded-lg text-[10px] hover:bg-emerald-700 inline-block transition-micro"
                      title="Reenviar por WhatsApp Web"
                    >
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={10} />
                        Reenviar
                      </span>
                    </a>
                  )}

                  <button
                    onClick={() => onEditarBitacora(m)}
                    className="p-1.5 text-graphite-600 dark:text-graphite-400 hover:text-black dark:hover:text-white font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-graphite-800 transition-micro cursor-pointer"
                    title="Editar entrada en bitácora"
                  >
                    <Pencil size={12} />
                  </button>

                  <button
                    onClick={() => onEliminarBitacora(m.id)}
                    className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-micro cursor-pointer"
                    title="Eliminar de bitácora"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

TablaHistorialMensajes.displayName = 'TablaHistorialMensajes'
