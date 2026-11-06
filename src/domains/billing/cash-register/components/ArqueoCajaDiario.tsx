import React, { memo } from 'react'
import { Printer, ClipboardList, CreditCard, Banknote, Building2 } from 'lucide-react'
import type { MovimientoFinanciero } from '../services/finanzasStorageService'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'

export interface ArqueoCajaDiarioProps {
  transaccionesDia?: MovimientoFinanciero[]
  fechaArqueo: string
  setFechaArqueo: React.Dispatch<React.SetStateAction<string>> | ((fecha: string) => void)
  userProfile?: { nombreCompleto?: string; [key: string]: unknown } | null
}

export const ArqueoCajaDiario = memo<ArqueoCajaDiarioProps>(({
  transaccionesDia = [],
  fechaArqueo,
  setFechaArqueo,
  userProfile
}) => {
  const ingresos = transaccionesDia.filter(t => (t.tipo || '').toLowerCase() === 'ingreso')
  const egresos = transaccionesDia.filter(t => (t.tipo || '').toLowerCase() === 'egreso')
  const monedas = [...new Set(transaccionesDia.map((movimiento) => movimiento.moneda || 'CLP'))]
  if (monedas.length === 0) monedas.push('CLP')
  const sumar = (lista: MovimientoFinanciero[]) => Object.fromEntries(monedas.map((moneda) => [
    moneda,
    lista.filter((movimiento) => (movimiento.moneda || 'CLP') === moneda)
      .reduce((total, movimiento) => total + (Number(movimiento.monto) || 0), 0),
  ])) as Record<string, number>
  const sumarMetodo = (metodo: string) => sumar(ingresos.filter((movimiento) => movimiento.metodoPago === metodo))
  const totalIngresos = sumar(ingresos)
  const totalEgresos = sumar(egresos)
  const saldoFinalCaja = Object.fromEntries(monedas.map((moneda) => [moneda, (totalIngresos[moneda] || 0) - (totalEgresos[moneda] || 0)]))
  const efectivo = sumarMetodo('Efectivo')
  const transferencia = sumarMetodo('Transferencia')
  const debito = sumarMetodo('Débito')
  const credito = sumarMetodo('Crédito')
  const mostrarMontos = (montos: Record<string, number>, negativo = false) => Object.entries(montos)
    .map(([moneda, monto]) => <span key={moneda} className="block">{negativo && monto > 0 ? '−' : ''}{formatearImporteDocumento(monto, moneda)}</span>)

  return (
    <div className="space-y-6">
      {/* Selector de Fecha e Impresión */}
      <div className="flex justify-between items-center bg-gray-50 dark:bg-graphite-800 p-4 rounded-2xl border border-gray-200 dark:border-graphite-700 print:hidden flex-wrap gap-3">
        <div className="flex items-center gap-3 text-xs">
          <label className="font-bold text-gray-700 dark:text-graphite-300">Seleccionar Fecha de Arqueo:</label>
          <input
            type="text"
            placeholder="DD/MM/AAAA"
            value={fechaArqueo}
            onChange={(e) => setFechaArqueo(e.target.value)}
            className="px-3 py-1.5 border rounded-lg bg-white dark:bg-graphite-800 font-bold text-gray-900 dark:text-graphite-50 w-32"
          />
        </div>

        <button
          onClick={() => window.print()}
          className="bg-black text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-800 shadow-sm flex items-center gap-2 transition-colors duration-150"
        >
          <span className="inline-flex items-center gap-1"><Printer size={14} />Imprimir Cierre de Caja Letter</span>
        </button>
      </div>

      {/* Documento de Cierre de Caja Imprimible */}
      <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-8 print:border-none print:p-0">
        {/* Encabezado */}
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-graphite-50">{userProfile?.nombreCompleto || 'DentikOS'}</h1>
            <p className="text-xs text-gray-600 dark:text-graphite-400">Arqueo y Cierre Diario de Caja Chica</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-gray-800 dark:text-graphite-100 uppercase">INFORME DE CAJA</h2>
            <p className="text-xs text-gray-500 dark:text-graphite-400">Fecha Arqueo: <strong>{fechaArqueo}</strong></p>
          </div>
        </div>

        {/* KPI Summaries de Caja */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-xs">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <span className="text-emerald-700 font-bold block uppercase text-[10px]">Total Ingresos Día</span>
            <span className="text-xl font-extrabold text-emerald-900">{mostrarMontos(totalIngresos)}</span>
          </div>

          <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
            <span className="text-red-700 font-bold block uppercase text-[10px]">Total Egresos / Gastos Día</span>
            <span className="text-xl font-extrabold text-red-900">{mostrarMontos(totalEgresos, true)}</span>
          </div>

          <div className="bg-gray-900 text-white p-4 rounded-xl">
            <span className="text-gray-300 font-bold block uppercase text-[10px]">Saldo Neto en Caja</span>
            <span className="text-xl font-extrabold text-white">{mostrarMontos(saldoFinalCaja)}</span>
          </div>
        </div>

        {/* Desglose por Medio de Pago */}
        <div className="bg-gray-50 dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 p-4 rounded-xl mb-6">
          <h4 className="text-xs font-bold text-gray-800 dark:text-graphite-100 uppercase tracking-wider mb-3">
            <span className="inline-flex items-center gap-1"><CreditCard size={12} />Desglose de Ingresos por Medio de Pago</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-white dark:bg-graphite-800 p-3 rounded-lg border">
              <span className="text-gray-500 dark:text-graphite-400 block text-[10px] inline-flex items-center gap-1"><Banknote size={10} />Efectivo:</span>
              <span className="font-bold text-gray-900 dark:text-graphite-50">{mostrarMontos(efectivo)}</span>
            </div>
            <div className="bg-white dark:bg-graphite-800 p-3 rounded-lg border">
              <span className="text-gray-500 dark:text-graphite-400 block text-[10px] inline-flex items-center gap-1"><Building2 size={10} />Transferencia:</span>
              <span className="font-bold text-gray-900 dark:text-graphite-50">{mostrarMontos(transferencia)}</span>
            </div>
            <div className="bg-white dark:bg-graphite-800 p-3 rounded-lg border">
              <span className="text-gray-500 dark:text-graphite-400 block text-[10px]"><span className="inline-flex items-center gap-1"><CreditCard size={8} />Débito:</span></span>
              <span className="font-bold text-gray-900 dark:text-graphite-50">{mostrarMontos(debito)}</span>
            </div>
            <div className="bg-white dark:bg-graphite-800 p-3 rounded-lg border">
              <span className="text-gray-500 dark:text-graphite-400 block text-[10px]"><span className="inline-flex items-center gap-1"><CreditCard size={8} />Crédito:</span></span>
              <span className="font-bold text-gray-900 dark:text-graphite-50">{mostrarMontos(credito)}</span>
            </div>
          </div>
        </div>

        {/* Tabla de Movimientos del Día */}
        <h4 className="text-xs font-bold text-gray-800 dark:text-graphite-100 uppercase tracking-wider mb-3">
          <span className="inline-flex items-center gap-1"><ClipboardList size={12} />Detalle de Transacciones del Día ({transaccionesDia.length})</span>
        </h4>

        {transaccionesDia.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-graphite-500 py-6 text-center bg-gray-50 dark:bg-graphite-800 rounded-xl border border-dashed">
            No existen transacciones ni cobros registrados para la fecha {fechaArqueo}.
          </p>
        ) : (
          <table className="w-full text-left text-xs mb-6 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 dark:border-graphite-600 bg-gray-100 dark:bg-graphite-800 text-gray-800 dark:text-graphite-100">
                <th className="p-2.5">Origen / Categoría</th>
                <th className="p-2.5">Paciente / Detalle</th>
                <th className="p-2.5">Medio de Pago</th>
                <th className="p-2.5 text-center">Tipo</th>
                <th className="p-2.5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {transaccionesDia.map(t => {
                const tipoLower = (t.tipo || '').toLowerCase()
                const esIngreso = tipoLower === 'ingreso'
                const concepto = typeof t.concepto === 'string' ? t.concepto : ''

                return (
                  <tr key={t.id} className="border-b border-gray-200 dark:border-graphite-700">
                    <td className="p-2.5 font-bold text-gray-900 dark:text-graphite-50">{t.categoria || 'General'}</td>
                    <td className="p-2.5 text-gray-700 dark:text-graphite-300">{t.pacienteNombre || concepto || 'S/D'}</td>
                    <td className="p-2.5 font-semibold text-gray-600 dark:text-graphite-400">{t.metodoPago || 'Efectivo'}</td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        esIngreso ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {t.tipo}
                      </span>
                    </td>
                    <td className={`p-2.5 text-right font-bold ${
                      esIngreso ? 'text-emerald-700' : 'text-red-600'
                    }`}>
                      {esIngreso ? '+' : '-'}{formatearImporteDocumento(Math.abs(Number(t.monto)), t.moneda || 'CLP')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pie de Firma Contable */}
        <div className="hidden print:block mt-16 pt-8 border-t border-gray-300 dark:border-graphite-600 text-center text-xs">
          <div className="w-64 mx-auto border-t border-black pt-2">
            <p className="font-bold">{userProfile?.nombreCompleto || 'Firma Responsable de Caja'}</p>
            <p className="text-gray-500 dark:text-graphite-400 text-[10px]">Recepción & Arqueo de Caja</p>
          </div>
        </div>
      </div>
    </div>
  )
})

ArqueoCajaDiario.displayName = 'ArqueoCajaDiario'
