import React, { memo, useState } from 'react'
import { Mail, MessageCircle, ScrollText, Bell, ClipboardList } from 'lucide-react'
import {
  CANALES_COMUNICACION,
  ESTADOS_CONFIRMACION_CITA,
  type MensajeHistorial
} from './constants/comunicacionesConstants'
import { useComunicaciones } from './hooks/useComunicaciones'
import { ComunicacionesSummaryCards } from './components/ComunicacionesSummaryCards'
import { TablaHistorialMensajes } from './components/TablaHistorialMensajes'
import { PlantillasManager } from './components/PlantillasManager'
import { RecallPacientesSection, type PacienteRecall } from './components/RecallPacientesSection'
import { ModalEnviarMensaje } from './components/ModalEnviarMensaje'
import { ModalEditarBitacora } from './components/ModalEditarBitacora'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'

type TabComunicaciones = 'historial' | 'plantillas' | 'recall'

export const ComunicacionesModulo: React.FC = memo(() => {
  // (F2-02) — pacientes y userProfile ya no llegan como prop desde App.jsx: se leen directo de los stores.
  const pacientes = usePacientesStore((state) => state.pacientes)
  const userProfile = useSesionStore((state: { userProfile: { nombreCompleto?: string } | null }) => state.userProfile)

  const [tabActual, setTabActual] = useState<TabComunicaciones>('historial')
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState<boolean>(false)
  const [registroEditarBitacora, setRegistroEditarBitacora] = useState<MensajeHistorial | null>(null)

  const {
    plantillas,
    historial,
    resumen,
    busqueda,
    setBusqueda,
    canalFiltro,
    setCanalFiltro,
    estadoFiltro,
    setEstadoFiltro,
    registrarOActualizarEnvio,
    cambiarEstadoConfirmacion,
    eliminarRegistroBitacora,
    agregarOEditarPlantilla,
    eliminarPlantilla
  } = useComunicaciones()

  const handleEnviarRecall = (paciente: PacienteRecall, mensaje: string): void => {
    const registro: MensajeHistorial = {
      id: Date.now(),
      pacienteId: paciente.id,
      pacienteNombre: paciente.nombre,
      pacienteTelefono: String(paciente.telefono || 'N/I'),
      pacienteEmail: paciente.email || 'N/I',
      canal: 'whatsapp',
      plantillaNombre: 'Recall / Control 6 Meses',
      mensajeEnviado: mensaje,
      fechaEnvio: new Date().toLocaleDateString('es-CL'),
      horaEnvio: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      estado: 'Enviado',
      notaBitacora: 'Recall preventivo enviado desde panel de comunicaciones.'
    }
    registrarOActualizarEnvio(registro)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mail}
        title="Comunicaciones y fidelización"
        description="Recordatorios de citas, confirmaciones bidireccionales, recalls de 6 meses y bitácora."
        className="print:hidden"
        actions={
          <button
            onClick={() => setModalNuevoAbierto(true)}
            className="bg-primary hover:bg-champagne-400 dark:bg-champagne-300 dark:hover:bg-champagne-200 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-micro shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={12} />
              Transmitir Mensaje
            </span>
          </button>
        }
      />

      <div className="print:hidden">
        <ComunicacionesSummaryCards resumen={resumen} />
      </div>

      <div className="scrollable-tab-strip flex gap-2 border-b border-surface pb-1 print:hidden text-xs overflow-x-auto" role="group" aria-label="Secciones de comunicaciones">
        <button
          type="button"
          onClick={() => setTabActual('historial')}
          aria-pressed={tabActual === 'historial'}
          className={`px-4 py-2 rounded-lg font-bold transition-micro whitespace-nowrap cursor-pointer ${
            tabActual === 'historial'
              ? 'bg-primary dark:bg-champagne-300 text-primary-foreground dark:text-graphite-950 shadow-xs'
              : 'bg-slate-100 dark:bg-graphite-800  text-graphite-600 dark:text-graphite-300  hover:bg-slate-200 dark:hover:bg-graphite-900'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <ScrollText size={12} />
            Bitácora & Confirmaciones
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabActual('recall')}
          aria-pressed={tabActual === 'recall'}
          className={`px-4 py-2 rounded-lg font-bold transition-micro whitespace-nowrap cursor-pointer ${
            tabActual === 'recall'
              ? 'bg-primary dark:bg-champagne-300 text-primary-foreground dark:text-graphite-950 shadow-xs'
              : 'bg-slate-100 dark:bg-graphite-800  text-graphite-600 dark:text-graphite-300  hover:bg-slate-200 dark:hover:bg-graphite-900'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <Bell size={12} />
            Citación Recall (6 Meses)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabActual('plantillas')}
          aria-pressed={tabActual === 'plantillas'}
          className={`px-4 py-2 rounded-lg font-bold transition-micro whitespace-nowrap cursor-pointer ${
            tabActual === 'plantillas'
              ? 'bg-primary dark:bg-champagne-300 text-primary-foreground dark:text-graphite-950 shadow-xs'
              : 'bg-slate-100 dark:bg-graphite-800  text-graphite-600 dark:text-graphite-300  hover:bg-slate-200 dark:hover:bg-graphite-900'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <ClipboardList size={12} />
            Gestor de Plantillas
          </span>
        </button>
      </div>

      {tabActual === 'historial' && (
        <>
          <div className="bg-slate-50 dark:bg-surface  p-4 border border-surface rounded-2xl flex justify-between items-center flex-wrap gap-3 text-xs print:hidden">
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-2">
              <label className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
                <span className="font-semibold text-graphite-600 dark:text-graphite-400 ">
                  Canal:
                </span>
                <select
                  value={canalFiltro}
                  onChange={(e) => setCanalFiltro(e.target.value)}
                  className="min-w-0 flex-1 p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800  text-graphite-900 dark:text-graphite-100  font-semibold focus:ring-2 focus:ring-primary/40 sm:flex-none"
                >
                  <option value="Todos">Todos los canales</option>
                  {CANALES_COMUNICACION.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-0 items-center justify-between gap-2 sm:ml-2 sm:justify-start">
                <span className="font-semibold text-graphite-600 dark:text-graphite-400 ">
                  Confirmación:
                </span>
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className="min-w-0 flex-1 p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800  text-graphite-900 dark:text-graphite-100  font-semibold focus:ring-2 focus:ring-primary/40 sm:flex-none"
                >
                  <option value="Todos">Todos los estados</option>
                  {ESTADOS_CONFIRMACION_CITA.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <input
              type="text"
              placeholder="Buscar por paciente o contenido..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800  text-graphite-900 dark:text-graphite-100  w-full sm:w-64 focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <TablaHistorialMensajes
            historial={historial}
            onCambiarEstado={cambiarEstadoConfirmacion}
            onEditarBitacora={setRegistroEditarBitacora}
            onEliminarBitacora={(id) => void eliminarRegistroBitacora(id)}
          />
        </>
      )}

      {tabActual === 'recall' && (
        <RecallPacientesSection
          pacientes={pacientes}
          alEnviarRecall={handleEnviarRecall}
        />
      )}

      {tabActual === 'plantillas' && (
        <PlantillasManager
          plantillas={plantillas}
          alGuardarPlantilla={agregarOEditarPlantilla}
          alEliminarPlantilla={(id) => void eliminarPlantilla(id)}
        />
      )}

      {modalNuevoAbierto && (
        <ModalEnviarMensaje
          pacientes={pacientes}
          plantillas={plantillas}
          userProfile={userProfile}
          alRegistrarEnvio={registrarOActualizarEnvio}
          alCerrar={() => setModalNuevoAbierto(false)}
        />
      )}

      {registroEditarBitacora && (
        <ModalEditarBitacora
          registroEditar={registroEditarBitacora}
          alGuardar={registrarOActualizarEnvio}
          alCerrar={() => setRegistroEditarBitacora(null)}
        />
      )}
    </div>
  )
})

ComunicacionesModulo.displayName = 'ComunicacionesModulo'
export default ComunicacionesModulo
