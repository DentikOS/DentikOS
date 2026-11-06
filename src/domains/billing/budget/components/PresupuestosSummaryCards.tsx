import React, { memo } from 'react'
import { FileSpreadsheet, DollarSign, CheckCircle2, TrendingUp } from 'lucide-react'
import type { ResumenPresupuestos } from '../utils/presupuestosCalculations'
import { formatearImporteDocumento, resolverIdiomaDocumento, resolverMonedaDocumento } from '../../../../shared/utils/formatoDocumento'
import { useClinicaDocumento } from '../../../organization/clinic/hooks/useClinicaDocumento'

export interface PresupuestosSummaryCardsProps {
  resumen: ResumenPresupuestos
  presupuestos?: Array<{ moneda?: string; montoTotal?: number | string; montoAbonado?: number | string }>
}

export const PresupuestosSummaryCards: React.FC<PresupuestosSummaryCardsProps> = memo(({ resumen, presupuestos }) => {
  const clinica = useClinicaDocumento()
  const idioma = resolverIdiomaDocumento(clinica.idiomaDocumentos)
  const monedaClinica = resolverMonedaDocumento(clinica.moneda)
  const grupos = new Map<string, { cotizado: number; abonado: number }>()
  for (const presupuesto of presupuestos || []) {
    const moneda = resolverMonedaDocumento(presupuesto.moneda)
    const actual = grupos.get(moneda) || { cotizado: 0, abonado: 0 }
    actual.cotizado += Number(presupuesto.montoTotal) || 0
    actual.abonado += Number(presupuesto.montoAbonado) || 0
    grupos.set(moneda, actual)
  }
  if (grupos.size === 0) grupos.set(monedaClinica, { cotizado: resumen.totalCotizado, abonado: resumen.totalAbonado })
  const mostrarTotales = (campo: 'cotizado' | 'abonado') => [...grupos.entries()]
    .sort(([monedaA], [monedaB]) => monedaA.localeCompare(monedaB))
    .map(([moneda, total]) => formatearImporteDocumento(total[campo], moneda, idioma))
    .join(' · ')

  return (
    <div className="metric-grid text-xs">
      <div className="relative overflow-hidden p-5 bg-surface/90 backdrop-blur-md border border-surface rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#B88E3A]/40 before:to-transparent">
        <div className="flex items-center gap-1.5 text-graphite-500 dark:text-graphite-400 mb-1">
          <FileSpreadsheet size={13} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">Total Emitidos</span>
        </div>
        <span className="text-2xl font-black text-graphite-900 dark:text-graphite-50  block tabular-nums tracking-tight">
          {resumen.totalEmitidos}{' '}
          <span className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">
            Cotizaciones
          </span>
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-amber-50/70 dark:bg-amber-950/20  backdrop-blur-md border border-amber-200/80 dark:border-amber-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#B88E3A] before:to-transparent">
        <div className="flex items-center gap-1.5 text-primary mb-1">
          <DollarSign size={13} />
          <span className="text-[10px] font-bold uppercase tracking-wider block">
            Monto Total Cotizado
          </span>
        </div>
        <span className="text-2xl font-black text-primary  block tabular-nums tracking-tight">
          {mostrarTotales('cotizado')}
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-emerald-50/70 dark:bg-emerald-950/20  backdrop-blur-md border border-emerald-200/80 dark:border-emerald-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-emerald-500/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 mb-1">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">
            Abonado Recaudado
          </span>
        </div>
        <span className="text-2xl font-black text-emerald-900 dark:text-emerald-300  block tabular-nums tracking-tight">
          {mostrarTotales('abonado')}
        </span>
      </div>

      <div className="relative overflow-hidden p-5 bg-sky-50/70 dark:bg-sky-950/20  backdrop-blur-md border border-sky-200/80 dark:border-sky-800/40  rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-transparent before:via-[#0EA5E9]/50 before:to-transparent">
        <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300 mb-1">
          <TrendingUp size={13} className="text-clinical-info" />
          <span className="text-[10px] font-bold uppercase tracking-wider block">
            Tasa Conversión
          </span>
        </div>
        <span className="text-2xl font-black text-sky-900 dark:text-sky-300  block tabular-nums tracking-tight">
          {resumen.tasaConversion}%{' '}
          <span className="text-xs font-semibold">Aprobados</span>
        </span>
      </div>
    </div>
  )
})

PresupuestosSummaryCards.displayName = 'PresupuestosSummaryCards'
