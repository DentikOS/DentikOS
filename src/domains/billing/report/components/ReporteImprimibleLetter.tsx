import React, { memo } from 'react'
import { Printer } from 'lucide-react'
import type { MetricasReportes } from '../hooks/useReportes'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'

export interface UserProfileLetter {
  nombreCompleto?: string
  [key: string]: unknown
}

export interface ReporteImprimibleLetterProps {
  metricas: MetricasReportes
  moneda?: string
  userProfile?: UserProfileLetter | null
  alCerrar: () => void
}

export const ReporteImprimibleLetter: React.FC<ReporteImprimibleLetterProps> = memo(({
  metricas,
  moneda = 'CLP',
  userProfile,
  alCerrar
}) => {
  return (
    <div className="space-y-6 text-xs">
      <div className="flex justify-between items-center print:hidden bg-gray-50 dark:bg-graphite-800 p-4 border border-gray-200 dark:border-graphite-700 rounded-2xl">
        <span className="font-bold text-gray-700 dark:text-graphite-300">
          Vista Previa: Informe Ejecutivo de Gestión
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors duration-150"
          >
            <span className="inline-flex items-center gap-1">
              <Printer size={14} />
              Imprimir Informe Letter (PDF)
            </span>
          </button>
          <button
            onClick={alCerrar}
            className="bg-gray-200 dark:bg-graphite-700 text-gray-800 dark:text-graphite-200 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-300 dark:hover:bg-graphite-600 transition-colors duration-150"
          >
            Cerrar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-2xl p-8 max-w-3xl mx-auto space-y-6 text-gray-900 print:border-none print:max-w-none print:p-0">
        <div className="border-b-2 border-black pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider">
              Informe de Gestión Clínica y Financiera
            </h1>
            <p className="text-[10px] text-gray-600 font-bold">
              {userProfile?.nombreCompleto || 'Cirujano Dentista'} | DentikOS
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold bg-gray-100 px-2 py-1 rounded border border-gray-200">
              REP-{new Date().getFullYear()}
            </span>
            <span className="text-[10px] text-gray-500 block mt-1">
              Fecha Emisión: {new Date().toLocaleDateString('es-CL')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div>
            <span className="text-[10px] font-bold text-gray-500 block uppercase">
              Recaudado Total
            </span>
            <span className="text-base font-black text-emerald-900">
              {formatearImporteDocumento(metricas.totalRecaudado, moneda)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 block uppercase">
              Tasa Conversión
            </span>
            <span className="text-base font-black text-blue-900">
              {metricas.tasaConversionPresupuestos}% Aprobados
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 block uppercase">
              Ticket Promedio
            </span>
            <span className="text-base font-black text-purple-900">
              {formatearImporteDocumento(metricas.ticketPromedio, moneda)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold text-xs uppercase border-b border-gray-200 pb-1">
            Procedimientos Destacados
          </h4>
          <table className="w-full text-left border-collapse border border-gray-200 text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 font-bold uppercase text-[10px]">
                <th className="p-2 border border-gray-200">Procedimiento</th>
                <th className="p-2 border border-gray-200 text-center">Cantidad</th>
                <th className="p-2 border border-gray-200 text-right">Monto Total</th>
              </tr>
            </thead>
            <tbody>
              {metricas.topPrestaciones.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="p-2 border border-gray-200 font-semibold">{it.nombre}</td>
                  <td className="p-2 border border-gray-200 text-center">{it.cantidad}</td>
                  <td className="p-2 border border-gray-200 text-right font-bold">
                    {formatearImporteDocumento(it.montoTotal, moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-16 grid grid-cols-2 gap-8 text-center print:pt-24">
          <div className="border-t border-black pt-2">
            <p className="font-bold">Dirección Médica</p>
            <p className="text-[10px] text-gray-500">Auditoría Clínica</p>
          </div>

          <div className="border-t border-black pt-2">
            <p className="font-bold">{userProfile?.nombreCompleto || 'Firma Profesional'}</p>
            <p className="text-[10px] text-gray-500">Firma / Timbre Profesional</p>
          </div>
        </div>
      </div>
    </div>
  )
})

ReporteImprimibleLetter.displayName = 'ReporteImprimibleLetter'
