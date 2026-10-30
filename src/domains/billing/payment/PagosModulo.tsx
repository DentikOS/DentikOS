import React, { memo, useState, useEffect } from 'react'
import { METODOS_PAGO_GOLD } from './constants/pagosConstants'
import { usePagos } from './hooks/usePagos'
import { PagosSummaryCards } from './components/PagosSummaryCards'
import { TablaHistorialPagos } from './components/TablaHistorialPagos'
import { ModalNuevoPago, type PacienteRefPago, type UserProfileRefPago } from './components/ModalNuevoPago'
import { ModalConfirmarPurga } from './components/ModalConfirmarPurga'
import { ComprobantePagoImprimible } from './components/ComprobantePagoImprimible'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { useRBAC } from '../../../shared/hooks/useRBAC'
import { PERMISOS } from '../../../constants/rbacConstants'
import { restaurarPago, limpiarVencidos } from './services/papeleraPagosService'
import { ModalPapeleraPagos } from './components/ModalPapeleraPagos'
import { Trash2, CreditCard, Download } from 'lucide-react'
import type { Pago } from './services/pagosStorageService'

export const PagosModulo: React.FC = memo(() => {
  const pacientes = usePacientesStore((state) => state.pacientes)
  const userProfile = useSesionStore((state) => state.userProfile)

  const { puede } = useRBAC()
  const puedeExportar = puede(PERMISOS.EXPORTAR_AUDITORIA_PAGOS)
  const puedePurgar = puede(PERMISOS.PURGAR_PAGOS)

  const [modalAbierto, setModalAbierto] = useState<boolean>(false)
  const [pagoEditar, setPagoEditar] = useState<Pago | null>(null)
  const [comprobanteVer, setComprobanteVer] = useState<Pago | null>(null)
  const [pagoAPurgar, setPagoAPurgar] = useState<Pago | null>(null)
  const [modalPapeleraAbierto, setModalPapeleraAbierto] = useState<boolean>(false)

  const {
    pagos,
    resumen,
    busqueda,
    setBusqueda,
    metodoFiltro,
    setMetodoFiltro,
    estadoFiltro,
    setEstadoFiltro,
    mostrarPurgados,
    setMostrarPurgados,
    agregarOActualizarPago,
    anularPago,
    purgarPago,
    exportarAuditoria,
    refrescarPagos
  } = usePagos()

  // Job de limpieza: eliminar pagos purgados con >730 días (Commit K)
  useEffect(() => {
    const ejecutarLimpieza = async (): Promise<void> => {
      const eliminados = await limpiarVencidos()
      if (eliminados > 0) refrescarPagos()
    }
    ejecutarLimpieza()
  }, [refrescarPagos])

  const handlePurgarConfirmado = async (motivo: string): Promise<void> => {
    if (!pagoAPurgar) return
    const ok = await purgarPago(pagoAPurgar.id, motivo)
    if (ok) setPagoAPurgar(null)
  }

  const handleAbrirNuevo = (): void => {
    setPagoEditar(null)
    setModalAbierto(true)
  }

  const handleAbrirEditar = (pago: Pago): void => {
    setPagoEditar(pago)
    setModalAbierto(true)
  }

  const handleAbrirPapelera = (): void => {
    setModalPapeleraAbierto(true)
  }

  const handleRestaurarPago = async (pagoId: string | number): Promise<void> => {
    const ok = await restaurarPago(pagoId)
    if (ok) refrescarPagos()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-graphite-50 uppercase tracking-wider">
            <span className="inline-flex items-center gap-1">
              <CreditCard size={16} />Control de Pagos, Recaudación & DTE
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-graphite-400">
            Gestión de ingresos por caja, boletas de honorarios, bonos I-Med e imputación a tratamientos.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {puedePurgar && (
            <button
              onClick={handleAbrirPapelera}
              className="bg-white dark:bg-graphite-800 surgical:bg-surface text-graphite-800 dark:text-graphite-100 surgical:text-black text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-graphite-900 transition-micro border border-surface cursor-pointer"
              title="Ver pagos purgados (papelera)"
            >
              <span className="inline-flex items-center gap-1">
                <Trash2 size={12} />Papelera
              </span>
            </button>
          )}
          {puedeExportar && (
            <button
              onClick={() => exportarAuditoria()}
              className="bg-white dark:bg-graphite-800 surgical:bg-surface text-graphite-800 dark:text-graphite-100 surgical:text-black text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-graphite-900 transition-micro border border-surface cursor-pointer"
              title="Exportar todos los pagos (vigentes + anulados) a XLSX"
            >
              <span className="inline-flex items-center gap-1">
                <Download size={14} />Exportar auditoría
              </span>
            </button>
          )}
          <button
            onClick={handleAbrirNuevo}
            className="bg-primary hover:bg-champagne-600 dark:bg-gold-satin dark:hover:bg-primary text-white dark:text-graphite-950 text-xs font-bold px-4 py-2.5 rounded-lg transition-micro shadow-xs cursor-pointer"
          >
            + Registrar Pago / Recibo
          </button>
        </div>
      </div>

      <div className="print:hidden rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-graphite-700 dark:text-graphite-200">
        Para abonar un presupuesto aprobado, usa su acción «Registrar pago» en Presupuestos; así se actualizan el saldo y el estado del presupuesto.
        <button
          type="button"
          className="ml-2 font-bold text-primary underline"
          onClick={() => window.dispatchEvent(new CustomEvent('navegar_seccion', { detail: 'Presupuestos' }))}
        >
          Ir a Presupuestos
        </button>
      </div>

      <div className="print:hidden">
        <PagosSummaryCards resumen={resumen} />
      </div>

      {comprobanteVer ? (
        <ComprobantePagoImprimible
          pago={comprobanteVer}
          userProfile={userProfile}
          alCerrar={() => setComprobanteVer(null)}
        />
      ) : (
        <>
          <div className="bg-slate-50 dark:bg-surface surgical:bg-surface p-4 border border-surface rounded-2xl flex justify-between items-center flex-wrap gap-3 text-xs print:hidden">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="font-semibold text-graphite-600 dark:text-graphite-400 surgical:text-black">
                Medio:
              </span>
              <select
                value={metodoFiltro}
                onChange={(e) => setMetodoFiltro(e.target.value)}
                className="p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-100 surgical:text-black font-semibold flex-1 sm:flex-initial focus:ring-2 focus:ring-primary/40"
              >
                <option value="Todos">Todos los métodos</option>
                {METODOS_PAGO_GOLD.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>

              <span className="font-semibold text-graphite-600 dark:text-graphite-400 surgical:text-black ml-2">
                Estado:
              </span>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-100 surgical:text-black font-semibold focus:ring-2 focus:ring-primary/40"
              >
                <option value="Todos">Todos</option>
                <option value="Emitido">Vigentes</option>
                <option value="Anulado">Anulados</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 font-semibold text-graphite-600 dark:text-graphite-400 surgical:text-black cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={mostrarPurgados}
                onChange={(e) => setMostrarPurgados(e.target.checked)}
                className="rounded"
              />
              Mostrar purgados
            </label>

            <input
              type="text"
              placeholder="Buscar por recibo, DTE, paciente o RUT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="p-2 border border-surface rounded-lg bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-100 surgical:text-black w-full sm:w-64 focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <TablaHistorialPagos
            pagos={pagos}
            onVerComprobante={setComprobanteVer}
            onEditar={handleAbrirEditar}
            onAnular={anularPago}
            onPurgar={setPagoAPurgar}
            puedePurgar={puedePurgar}
          />
        </>
      )}

      {modalAbierto && (
        <ModalNuevoPago
          pagoEditar={pagoEditar}
          pacientes={pacientes}
          userProfile={userProfile}
          alGuardar={(p: Pago) => agregarOActualizarPago(p)}
          alCerrar={() => setModalAbierto(false)}
        />
      )}

      {pagoAPurgar && (
        <ModalConfirmarPurga
          pago={pagoAPurgar}
          onConfirmar={handlePurgarConfirmado}
          alCerrar={() => setPagoAPurgar(null)}
        />
      )}

      {modalPapeleraAbierto && (
        <ModalPapeleraPagos
          alCerrar={() => setModalPapeleraAbierto(false)}
          onRestaurar={handleRestaurarPago}
          onAccionCompletada={refrescarPagos}
        />
      )}
    </div>
  )
})

PagosModulo.displayName = 'PagosModulo'
