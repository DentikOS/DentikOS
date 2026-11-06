import React, { memo } from 'react'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'
import type { BalanceFinanzas } from '../utils/finanzasCalculations'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'

export interface BalanceCajaCardsProps {
  balance: BalanceFinanzas
}

export const BalanceCajaCards = memo<BalanceCajaCardsProps>(({ balance }) => {
  const esPositivo = balance.saldoNeto >= 0
  const monedas = Object.entries(balance.totalesPorMoneda || { CLP: balance })
  const mostrarMontos = (campo: 'totalIngresos' | 'totalEgresos' | 'saldoNeto') => monedas.map(([moneda, totales]) => (
    <span key={moneda} className="block">{formatearImporteDocumento(totales[campo], moneda)}</span>
  ))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Total Ingresos */}
      <div className="relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#B88E3A] before:to-transparent">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-1.5 text-primary">
            <TrendingUp size={13} />
            <span className="text-[10px] font-bold uppercase tracking-wider block">
              Total Ingresos
            </span>
          </div>
          <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
            DentikOS
          </span>
        </div>
        <span className="text-2xl font-black text-primary block tabular-nums tracking-tight">
          {mostrarMontos('totalIngresos')}
        </span>
      </div>

      {/* Total Egresos */}
      <div className="relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-rose-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 mb-1">
          <TrendingDown size={13} />
          <span className="text-[10px] font-bold uppercase tracking-wider block">
            Total Egresos / Gastos
          </span>
        </div>
        <span className="text-2xl font-black text-rose-600 dark:text-rose-400 block tabular-nums tracking-tight">
          {mostrarMontos('totalEgresos')}
        </span>
      </div>

      {/* Saldo Neto en Caja */}
      <div className="relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-graphite-600 dark:text-graphite-400 mb-1">
          <Wallet size={13} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">
            Saldo Neto en Caja
          </span>
        </div>
        <span
          className={`text-2xl font-black block tabular-nums tracking-tight ${
            esPositivo ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {mostrarMontos('saldoNeto')}
        </span>
      </div>
    </div>
  )
})

BalanceCajaCards.displayName = 'BalanceCajaCards'
