import React, { memo, useState, useEffect } from 'react'
import { ESTADOS_PRESUPUESTO } from './constants/presupuestosConstants'
import { usePresupuestos } from './hooks/usePresupuestos'
import { PresupuestosSummaryCards } from './components/PresupuestosSummaryCards'
import { TablaPresupuestosGlobales } from './components/TablaPresupuestosGlobales'
import { ModalNuevoPresupuesto } from './components/ModalNuevoPresupuesto'
import { ModalRegistrarPago } from './components/ModalRegistrarPago'
import { DocumentoPresupuestoImprimible } from './components/DocumentoPresupuestoImprimible'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { usePrestacionesStore } from '../../../app/stores/prestacionesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { useAppDialog } from '../../../shared/hooks/useAppDialog'
import { useRBAC } from '../../../shared/hooks/useRBAC'
import { ClipboardList } from 'lucide-react'
import type { PresupuestoLocal } from './services/presupuestosStorageService'
import { presupuestosStorageService } from './services/presupuestosStorageService'
import { pagosService } from './services/pagosService'
import { presupuestoPlanSyncService } from './services/presupuestoPlanSyncService'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'
import { formatearImporteDocumento, resolverIdiomaDocumento } from '../../../shared/utils/formatoDocumento'
import { useClinicaDocumento } from '../../organization/clinic/hooks/useClinicaDocumento'
import { inventarioCloudService, type ProductoVentaPresupuesto, type UbicacionInventario } from '../../operations/inventory/services/inventarioCloudService'
import { Modal } from '../../../shared/ui/ui/Modal'
import { Button } from '../../../shared/ui/ui/Button'
import { esUuidValido } from '../../../infrastructure/supabase/migrations/uuidUtils'

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
  const prestaciones = usePrestacionesStore((state) => state.prestacionesArancel)
  const userProfile = useSesionStore((state) => state.userProfile)
  const { rol } = useRBAC()
  const clinicaDocumento = useClinicaDocumento()
  const idiomaDocumento = resolverIdiomaDocumento(clinicaDocumento.idiomaDocumentos)
  const puedeRegistrarPago = rol === 'admin' || rol === 'dentista' || rol === 'recepcion'

  const [modalAbierto, setModalAbierto] = useState<boolean>(false)
  const { alert: dialogAlert, confirm } = useAppDialog()
  const [presupuestoVerDocumento, setPresupuestoVerDocumento] = useState<PresupuestoLocal | null>(null)
  const [presupuestoParaPago, setPresupuestoParaPago] = useState<PresupuestoLocal | null>(null)
  const [productosInventario, setProductosInventario] = useState<ProductoVentaPresupuesto[]>([])
  const [cargandoProductosInventario, setCargandoProductosInventario] = useState(false)
  const [errorCatalogoInventario, setErrorCatalogoInventario] = useState(false)
  const [presupuestoParaAprobar, setPresupuestoParaAprobar] = useState<PresupuestoLocal | null>(null)
  const [ubicacionesAprobacion, setUbicacionesAprobacion] = useState<UbicacionInventario[]>([])
  const [ubicacionAprobacionId, setUbicacionAprobacionId] = useState('')
  const [cargandoUbicacionesAprobacion, setCargandoUbicacionesAprobacion] = useState(false)
  const [aprobandoConInventario, setAprobandoConInventario] = useState(false)

  useEffect(() => {
    if (!modalAbierto) return
    let vigente = true
    setCargandoProductosInventario(true)
    setErrorCatalogoInventario(false)
    void inventarioCloudService.listarProductosVenta()
      .then((productos) => { if (vigente) setProductosInventario(productos) })
      .catch(() => {
        if (!vigente) return
        setProductosInventario([])
        setErrorCatalogoInventario(true)
      })
      .finally(() => { if (vigente) setCargandoProductosInventario(false) })
    return () => { vigente = false }
  }, [modalAbierto])

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

  const solicitarAprobacionConInventario = async (presupuesto: PresupuestoLocal): Promise<void> => {
    if (!esUuidValido(presupuesto.id) || presupuesto.sincronizado === false) {
      await dialogAlert({
        title: 'Presupuesto pendiente de sincronización',
        description: 'Espera a que se sincronice el presupuesto y vuelve a solicitar la aprobación.',
        variant: 'warning', confirmText: 'Entendido'
      })
      return
    }
    setPresupuestoParaAprobar(presupuesto)
    setUbicacionAprobacionId('')
    setCargandoUbicacionesAprobacion(true)
    try {
      setUbicacionesAprobacion(await inventarioCloudService.listarUbicaciones())
    } catch {
      setUbicacionesAprobacion([])
      await dialogAlert({
        title: 'No se pudieron cargar las ubicaciones',
        description: 'Revisa la conexión y los permisos de inventario antes de aprobar este presupuesto.',
        variant: 'warning', confirmText: 'Entendido'
      })
      setPresupuestoParaAprobar(null)
    } finally {
      setCargandoUbicacionesAprobacion(false)
    }
  }

  const confirmarAprobacionConInventario = async (): Promise<void> => {
    if (!presupuestoParaAprobar || !ubicacionAprobacionId || aprobandoConInventario) return
    setAprobandoConInventario(true)
    try {
      await presupuestosStorageService.aprobarPresupuestoConInventario(
        presupuestoParaAprobar.id,
        ubicacionAprobacionId
      )
      setPresupuestoParaAprobar(null)
      setUbicacionesAprobacion([])
      setUbicacionAprobacionId('')
    } catch {
      await dialogAlert({
        title: 'No se completó la aprobación',
        description: 'El presupuesto y el stock no se confirmaron. Revisa el stock disponible en la ubicación y vuelve a intentar.',
        variant: 'warning', confirmText: 'Entendido'
      })
    } finally {
      setAprobandoConInventario(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="Presupuestos globales y cotizaciones"
        description="Panel central de seguimiento de tratamientos y planes de financiamiento. Para registrar un abono, aprueba el presupuesto y usa «Registrar pago» en su fila."
        className="print:hidden"
        actions={
          <button
            onClick={() => setModalAbierto(true)}
            className="bg-primary hover:bg-champagne-400 dark:bg-champagne-300 dark:hover:bg-champagne-200 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-micro shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            + Nuevo borrador
          </button>
        }
      />

      <div className="print:hidden">
        <PresupuestosSummaryCards resumen={resumen} presupuestos={presupuestos} />
      </div>

      {presupuestoVerDocumento ? (
        <DocumentoPresupuestoImprimible
          presupuesto={presupuestoVerDocumento}
          userProfile={userProfile}
          onRegistrarPago={puedeRegistrarPago ? () => setPresupuestoParaPago(presupuestoVerDocumento) : undefined}
          alCerrar={() => setPresupuestoVerDocumento(null)}
        />
      ) : (
        <>
          <div className="bg-slate-50 dark:bg-surface  p-4 border border-surface rounded-2xl flex justify-between items-center flex-wrap gap-3 text-xs print:hidden">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="font-semibold text-graphite-600 dark:text-graphite-400 ">
                Estado:
              </span>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800  text-graphite-900 dark:text-graphite-100  font-semibold flex-1 sm:flex-initial focus:ring-2 focus:ring-primary/40 cursor-pointer"
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
              className="p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800  text-graphite-900 dark:text-graphite-100  w-full sm:w-64 focus:ring-2 focus:ring-primary/40"
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
            onRegistrarPago={puedeRegistrarPago ? (p) => setPresupuestoParaPago(p) : undefined}
            onSolicitarAprobacionConInventario={solicitarAprobacionConInventario}
          onConfirmarRevision={rol === 'admin' || rol === 'dentista' ? async (p) => {
            const revisado = await confirm({
              title: 'Confirmar revisión clínica',
              description: `Revisa los ítems y descuentos del presupuesto ${p.folio} por ${formatearImporteDocumento(p.montoTotal, p.moneda, idiomaDocumento)} antes de habilitar su envío.`,
              variant: 'warning', confirmText: 'Confirmar revisión',
            })
            if (!revisado) return
            try {
              await presupuestoPlanSyncService.confirmarRevision(String(p.id))
            } catch (cause) {
              await dialogAlert({ title: 'No se pudo confirmar',
                description: cause instanceof Error ? cause.message : 'Revisa el estado del presupuesto.',
                variant: 'warning', confirmText: 'Entendido' })
            }
          } : undefined}
          />
        </>
      )}

      {modalAbierto && (
        <ModalNuevoPresupuesto
          pacientes={pacientes}
          prestaciones={prestaciones}
          productosInventario={productosInventario}
          cargandoProductosInventario={cargandoProductosInventario}
          errorCatalogoInventario={errorCatalogoInventario}
          alGuardar={agregarPresupuesto}
          alCerrar={() => setModalAbierto(false)}
        />
      )}

      {presupuestoParaPago && (
        <ModalRegistrarPago
          saldoPendiente={Math.max(0, (presupuestoParaPago.montoTotal || 0) - (presupuestoParaPago.montoAbonado || 0))}
          totalPresupuesto={presupuestoParaPago.montoTotal || 0}
          presupuestoId={presupuestoParaPago.id}
          folioPresupuesto={presupuestoParaPago.folio}
          pacienteNombre={presupuestoParaPago.pacienteNombre}
          moneda={presupuestoParaPago.moneda}
          onRegistrarPago={async (pago) => {
            try {
              const confirmado = await pagosService.registrarPagoManual({
                pagoId: pago.id,
                presupuestoId: presupuestoParaPago.id,
                monto: pago.monto,
                medioPago: pago.medioPago,
                referencia: pago.referencia,
                imputaciones: pago.imputaciones,
              })
              setPresupuestoVerDocumento((actual) => actual && String(actual.id) === String(presupuestoParaPago.id)
                ? { ...actual, montoAbonado: confirmado.montoAbonado, estado: confirmado.estado }
                : actual)
              setPresupuestoParaPago(null)
              return true
            } catch {
              return false
            }
          }}
          onCerrar={() => setPresupuestoParaPago(null)}
        />
      )}

      {presupuestoParaAprobar && (
        <Modal
          isOpen={true}
          onClose={() => { if (!aprobandoConInventario) setPresupuestoParaAprobar(null) }}
          title="Aprobar presupuesto con productos"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-graphite-700 dark:text-graphite-200">
              Elige la ubicación desde donde se reservará el stock del presupuesto {presupuestoParaAprobar.folio}. La aprobación y las salidas de inventario se guardan en una sola operación.
            </p>
            <div>
              <label className="block font-semibold text-sm mb-1">Ubicación de origen *</label>
              <select
                value={ubicacionAprobacionId}
                onChange={(event) => setUbicacionAprobacionId(event.target.value)}
                disabled={cargandoUbicacionesAprobacion || ubicacionesAprobacion.length === 0 || aprobandoConInventario}
                className="w-full p-2.5 rounded-xl border border-surface bg-white dark:bg-graphite-900 dark:text-graphite-100"
              >
                <option value="">{cargandoUbicacionesAprobacion ? 'Cargando ubicaciones…' : '-- Seleccionar ubicación --'}</option>
                {ubicacionesAprobacion.map((ubicacion) => (
                  <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>
                ))}
              </select>
              {!cargandoUbicacionesAprobacion && ubicacionesAprobacion.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">No hay ubicaciones activas disponibles para esta clínica.</p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" onClick={() => setPresupuestoParaAprobar(null)} variant="ghost" fullWidth disabled={aprobandoConInventario}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void confirmarAprobacionConInventario()} variant="primary" fullWidth disabled={!ubicacionAprobacionId || aprobandoConInventario || cargandoUbicacionesAprobacion}>
                {aprobandoConInventario ? 'Confirmando…' : 'Aprobar y descontar stock'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
})

PresupuestosModulo.displayName = 'PresupuestosModulo'
