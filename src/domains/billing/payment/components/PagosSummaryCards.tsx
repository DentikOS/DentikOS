import React, { memo } from 'react'
import { DollarSign, CheckCircle2, Receipt, CreditCard } from 'lucide-react'
import { calcularResumenRecaudacion, type ResumenRecaudacion } from '../utils/pagosCalculations'
import type { Pago } from '../services/pagosStorageService'
import { formatearImporteDocumento, resolverIdiomaDocumento, resolverMonedaDocumento } from '../../../../shared/utils/formatoDocumento'
import { useClinicaDocumento } from '../../../organization/clinic/hooks/useClinicaDocumento'

export interface PagosSummaryCardsProps {
  resumen: ResumenRecaudacion
  pagos?: Pago[]
}

export const PagosSummaryCards: React.FC<PagosSummaryCardsProps> = memo(({ resumen, pagos }) => {
  const clinica = useClinicaDocumento()
  const idioma = resolverIdiomaDocumento(clinica.idiomaDocumentos)
  const monedaClinica = resolverMonedaDocumento(clinica.moneda)
  const grupos = new Map<string, Pago[]>()
  for (const pago of pagos || []) {
    const moneda = resolverMonedaDocumento(pago.moneda)
    grupos.set(moneda, [...(grupos.get(moneda) || []), pago])
  }
  const resumenesPorMoneda = grupos.size > 0
    ? [...grupos.entries()].map(([moneda, items]) => ({ moneda, resumen: calcularResumenRecaudacion(items) }))
    : [{ moneda: monedaClinica, resumen }]
  const mostrarMontos = (campo: keyof ResumenRecaudacion) => resumenesPorMoneda
    .sort((a, b) => a.moneda.localeCompare(b.moneda))
    .map(({ moneda, resumen: resumenMoneda }) => formatearImporteDocumento(resumenMoneda[campo] as number, moneda, idioma))
    .join(' · ')
  const mostrarCopagos = () => resumenesPorMoneda
    .sort((a, b) => a.moneda.localeCompare(b.moneda))
    .map(({ moneda, resumen: resumenMoneda }) => formatearImporteDocumento(
      resumenMoneda.totalBonoIMed + resumenMoneda.totalTarjetasPOS, moneda, idioma,
    ))
    .join(' · ')

  return (
    <div className="metric-grid text-xs">
      <div className="relative overflow-hidden p-5 bg-amber-50/70 dark:bg-amber-950/20  backdrop-blur-md border border-amber-200/80 dark:border-amber-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#B88E3A] before:to-transparent">
        <div className="flex items-center gap-1.5 text-primary mb-1">
          <DollarSign size={13} />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Recaudación Hoy</span>
        </div>
        <span className="text-2xl font-black text-primary  block tabular-nums tracking-tight">
          {mostrarMontos('recaudadoHoy')}
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-emerald-50/70 dark:bg-emerald-950/20  backdrop-blur-md border border-emerald-200/80 dark:border-emerald-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 mb-1">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Total Recaudado</span>
        </div>
        <span className="text-2xl font-black text-emerald-900 dark:text-emerald-300  block tabular-nums tracking-tight">
          {mostrarMontos('totalRecaudado')}
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#B88E3A]/40 before:to-transparent">
        <div className="flex items-center gap-1.5 text-graphite-600 dark:text-graphite-400 mb-1">
          <Receipt size={13} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Boletas Honorarios SII</span>
        </div>
        <span className="text-2xl font-black text-graphite-900 dark:text-graphite-50  block tabular-nums tracking-tight">
          {mostrarMontos('totalBoletasHonorarios')}
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-sky-50/70 dark:bg-sky-950/20  backdrop-blur-md border border-sky-200/80 dark:border-sky-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#0EA5E9]/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300 mb-1">
          <CreditCard size={13} className="text-clinical-info" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Co-Pagos I-Med / POS</span>
        </div>
        <span className="text-2xl font-black text-sky-900 dark:text-sky-300  block tabular-nums tracking-tight">
          {mostrarCopagos()}
        </span>
      </div>
    </div>
  )
})

PagosSummaryCards.displayName = 'PagosSummaryCards'
