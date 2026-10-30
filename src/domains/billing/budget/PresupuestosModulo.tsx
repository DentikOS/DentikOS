import React, { memo, useState, useEffect } from 'react'
import { ESTADOS_PRESUPUESTO } from './constants/presupuestosConstants'
import { usePresupuestos } from './hooks/usePresupuestos'
import { PresupuestosSummaryCards } from './components/PresupuestosSummaryCards'
import { TablaPresupuestosGlobales } from './components/TablaPresupuestosGlobales'
import { ModalNuevoPresupuesto } from './components/ModalNuevoPresupuesto'
import { ModalRegistrarPago } from './components/ModalRegistrarPago'
import { DocumentoPresupuestoImprimible, type UserProfilePresupuesto } from './components/DocumentoPresupuestoImprimible'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { prestacionesStorageService } from '../../organization/prestations/services/prestacionesStorageService'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { useAppDialog } from '../../../shared/hooks/useAppDialog'
import { ClipboardList } from 'lucide-react'
import type { PresupuestoLocal } from './services/presupuestosStorageService'
import { pagosService } from './services/pagosService'
import type { PacienteFormRef, PrestacionFormRef } from './components/CamposFormularioPresupuesto'

export interface PresupuestosModuloProps {
  setPacienteSeleccionado?: (paciente: unknown) => void
  setActiveSection?: (section: string) => void
}

export const PresupuestosModulo: React.FC<PresupuestosModuloProps> = memo(({
  setPacienteSeleccionado,
  setActiveSection
}) => {
  // (F2-02) — pacientes, prestacionesArancel y userProfile ya no llegan como prop
  // desde App.jsx: se leen directo de los stores. setPacienteSeleccionado y
  // setActiveSection son navegación local de App.jsx, fuera del alcance de F2-01,
  // así que se quedan como props.
  const pacientes = usePacientesStore((state) => state.pacientes)
  const prestaciones = prestacionesStorageService.obtenerPrestaciones([]) || []
  const userProfile = useSesionStore((state) => state.userProfile)

  const [modalAbierto, setModalAbierto] = useState<boolean>(false)
  const { alert: dialogAlert } = useAppDialog()
  const [presupuestoVerDocumento, setPresupuestoVerDocumento] = useState<PresupuestoLocal | null>(null)
  const [presupuestoParaPago, setPresupuestoParaPago] = useState<PresupuestoLocal | null>(null)

  useEffect(() => {
    const handleAbrirModalPresupuesto = () => {
      setModalAbierto(true)
    }
    window.addEventListener('abrir_modal_presupuesto', handleAbrirModalPresupuesto)
    return () => window.removeEventListener('abrir_modal_presupuesto', handleAbrirModalPresupuesto)
  }, [])

  const {
    presupuestos,
    resumen,
    busqueda,
    setBusqueda,
    estadoFiltro,
    setEstadoFiltro,
    agregarPresupuesto,
    cambiarEstadoPresupuesto,
    archivarPresupuesto
  } = usePresupuestos(pacientes)

  const handleVerFichaPaciente = async (presupuesto: PresupuestoLocal): Promise<void> => {
    const pac = pacientes.find((p) => String(p.id) === String(presupuesto.pacienteId))
    if (pac && setPacienteSeleccionado && setActiveSection) {
      setPacienteSeleccionado(pac)
      setActiveSection('Pacientes')
    } else {
      await dialogAlert({
        title: 'Ficha clínica no disponible',
        description: 'Abre la sección Pacientes para consultar la ficha clínica.',
        variant: 'info',
        confirmText: 'Entendido'
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-graphite-50 uppercase tracking-wider inline-flex items-center gap-2">
            <ClipboardList size={16} />Presupuestos Globales & Cotizaciones
          </h2>
          <p className="text-xs text-gray-500 dark:text-graphite-400">
            Panel central de seguimiento de tratamientos y planes de financiamiento.
          </p>
        </div>

        <button
          onClick={() => setModalAbierto(true)}
          className="bg-primary hover:bg-champagne-600 dark:bg-gold-satin dark:hover:bg-primary text-white dark:text-graphite-950 text-xs font-bold px-4 py-2.5 rounded-lg transition-micro shadow-xs cursor-pointer"
        >
          + Nuevo borrador
        </button>
      </div>

      <div className="print:hidden">
        <PresupuestosSummaryCards resumen={resumen} />
      </div>

      {presupuestoVerDocumento ? (
        <DocumentoPresupuestoImprimible
          presupuesto={presupuestoVerDocumento}
          userProfile={userProfile}
          alCerrar={() => setPresupuestoVerDocumento(null)}
        />
      ) : (
        <>
          <div className="bg-slate-50 dark:bg-surface surgical:bg-surface p-4 border border-surface rounded-2xl flex justify-between items-center flex-wrap gap-3 text-xs print:hidden">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="font-semibold text-graphite-600 dark:text-graphite-400 surgical:text-black">
                Estado:
              </span>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-100 surgical:text-black font-semibold flex-1 sm:flex-initial focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="Todos">Todos los estados</option>
                <option value="Archivados">Archivados</option>
                {ESTADOS_PRESUPUESTO.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="Buscar por folio, paciente o RUT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-100 surgical:text-black w-full sm:w-64 focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <TablaPresupuestosGlobales
            presupuestos={presupuestos}
            onCambiarEstado={async (id, estado) => {
              try {
                const ok = await cambiarEstadoPresupuesto(id, estado)
                if (!ok) await dialogAlert({ title: 'Estado no actualizado', description: 'Revisa el presupuesto y vuelve a intentar.', variant: 'warning', confirmText: 'Entendido' })
                return ok
              } catch {
                await dialogAlert({ title: 'Estado no actualizado', description: 'Revisa el presupuesto y vuelve a intentar.', variant: 'warning', confirmText: 'Entendido' })
                return false
              }
            }}
            onVerFichaPaciente={handleVerFichaPaciente}
            onVerDocumento={setPresupuestoVerDocumento}
            onArchivar={archivarPresupuesto}
            onRegistrarPago={(p) => setPresupuestoParaPago(p)}
          />
        </>
      )}

      {modalAbierto && (
        <ModalNuevoPresupuesto
          pacientes={pacientes}
          prestaciones={prestaciones}
          alGuardar={agregarPresupuesto}
          alCerrar={() => setModalAbierto(false)}
        />
      )}

      {presupuestoParaPago && (
        <ModalRegistrarPago
          saldoPendiente={Math.max(0, (presupuestoParaPago.montoTotal || 0) - (presupuestoParaPago.montoAbonado || 0))}
          totalPresupuesto={presupuestoParaPago.montoTotal || 0}
          folioPresupuesto={presupuestoParaPago.folio}
          pacienteNombre={presupuestoParaPago.pacienteNombre}
          onRegistrarPago={async (pago) => {
            try {
              await pagosService.registrarPagoManual({
                pagoId: pago.id,
                presupuestoId: presupuestoParaPago.id,
                monto: pago.monto,
                medioPago: pago.medioPago,
                referencia: pago.referencia,
              })
              setPresupuestoParaPago(null)
              return true
            } catch {
              return false
            }
          }}
          onCerrar={() => setPresupuestoParaPago(null)}
        />
      )}
    </div>
  )
})

PresupuestosModulo.displayName = 'PresupuestosModulo'
