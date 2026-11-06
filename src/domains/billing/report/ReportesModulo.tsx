import React, { memo, useState } from 'react'
import { PERIODOS_REPORTES } from './constants/reportesConstants'
import { useReportes } from './hooks/useReportes'
import { ReportesSummaryCards } from './components/ReportesSummaryCards'
import { RankingPrestacionesTable } from './components/RankingPrestacionesTable'
import { GraficoProductividad } from './components/GraficoProductividad'
import { RendimientoProfesionales } from './components/RendimientoProfesionales'
import { ReporteImprimibleLetter } from './components/ReporteImprimibleLetter'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { exportService } from './services/exportService'
import { FileText, BarChart3, FileSpreadsheet } from 'lucide-react'
import type { Paciente } from '../../../domains/clinical/patient/schemas/pacienteSchema'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'

export const ReportesModulo: React.FC = memo(() => {
  // (F2-02) — pacientes y userProfile ya no llegan como prop desde App.jsx: se leen directo de los stores.
  const pacientes = usePacientesStore((state: { pacientes: Paciente[] }) => state.pacientes)
  const userProfile = useSesionStore((state: { userProfile: { nombreCompleto?: string } | null }) => state.userProfile)

  const [verReporteLetter, setVerReporteLetter] = useState<boolean>(false)
  const { periodoSeleccionado, setPeriodoSeleccionado, metricas, monedaSeleccionada, setMonedaSeleccionada, monedasDisponibles } = useReportes(pacientes)

  const handleExportarPDF = (): void => {
    exportService.exportarReportePDF(metricas, userProfile || undefined, monedaSeleccionada)
  }

  const handleExportarExcel = (): void => {
    exportService.exportarReporteCompletoExcel(metricas, periodoSeleccionado, monedaSeleccionada)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Reportes gerenciales y métricas clínicas"
        description="Inteligencia de negocios, rentabilidad de arancel y flujo de recaudación."
        className="print:hidden"
        actions={
          <>
            <span className="text-xs font-semibold text-gray-600 dark:text-graphite-400">Período:</span>
            <select
              value={periodoSeleccionado}
              onChange={(e) => setPeriodoSeleccionado(e.target.value)}
              className="p-2 border border-gray-300 dark:border-graphite-600 rounded-xl bg-white dark:bg-graphite-800 font-bold text-xs"
            >
              {PERIODOS_REPORTES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <label className="text-xs font-semibold text-gray-600 dark:text-graphite-400" htmlFor="reportes-moneda">Moneda:</label>
            <select id="reportes-moneda" aria-label="Moneda financiera del reporte" value={monedaSeleccionada}
              onChange={(e) => setMonedaSeleccionada(e.target.value as typeof monedaSeleccionada)}
              className="p-2 border border-gray-300 dark:border-graphite-600 rounded-xl bg-white dark:bg-graphite-800 font-bold text-xs">
              {monedasDisponibles.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
            </select>

            <button
              onClick={handleExportarPDF}
              className="bg-surface border border-surface-border text-graphite-700 dark:text-graphite-200 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-surface-elevated transition-micro shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Exportar reporte como PDF"
              title="Exportar a PDF (abre diálogo de impresión)"
            >
              <span className="inline-flex items-center gap-1">
                <FileText size={14} />
                Exportar PDF
              </span>
            </button>
            <button
              onClick={handleExportarExcel}
              className="bg-surface border border-surface-border text-graphite-700 dark:text-graphite-200 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-surface-elevated transition-micro shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Exportar reporte completo como Excel"
              title="Descargar Excel con resumen, ranking y rendimiento"
            >
              <span className="inline-flex items-center gap-1">
                <FileSpreadsheet size={14} />
                Exportar Excel
              </span>
            </button>
            <button
              onClick={() => setVerReporteLetter(true)}
              className="bg-surface border border-surface-border text-graphite-700 dark:text-graphite-200 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-surface-elevated transition-micro shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="inline-flex items-center gap-1">
                <FileText size={14} />
                Informe Letter
              </span>
            </button>
          </>
        }
      />

      <div className="print:hidden">
        <ReportesSummaryCards metricas={metricas} moneda={monedaSeleccionada} />
      </div>

      {verReporteLetter ? (
        <ReporteImprimibleLetter
          metricas={metricas}
          moneda={monedaSeleccionada}
          userProfile={userProfile}
          alCerrar={() => setVerReporteLetter(false)}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RankingPrestacionesTable topPrestaciones={metricas.topPrestaciones} moneda={monedaSeleccionada} />
            <GraficoProductividad desgloseEspecialidad={metricas.desgloseEspecialidad} moneda={monedaSeleccionada} />
          </div>

          <RendimientoProfesionales recaudacionPorMetodo={metricas.recaudacionPorMetodo} moneda={monedaSeleccionada} />
        </div>
      )}
    </div>
  )
})

ReportesModulo.displayName = 'ReportesModulo'
export default ReportesModulo
