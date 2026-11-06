import React, { useState } from 'react'
import { DollarSign, RefreshCw, WifiOff } from 'lucide-react'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { obtenerAreasBP15, type AreaBP15 } from './treasuryPermissions'
import { useTreasury } from './hooks/useTreasury'
import { CajaPanel } from './components/CajaPanel'
import { ConciliacionPanel } from './components/ConciliacionPanel'
import { CarteraPanel } from './components/CarteraPanel'
import { GastosPanel } from './components/GastosPanel'
import { BonosPanel } from './components/BonosPanel'
import { LibrosPanel } from './components/LibrosPanel'
import { FlujoPanel } from './components/FlujoPanel'
import { ReportesPanel } from './components/ReportesPanel'

const LABELS: Record<AreaBP15, string> = {
  caja: 'Caja', conciliacion: 'Conciliación', cartera: 'Cartera', gastos: 'Gastos',
  bonos: 'Bonos', libros: 'Libros', flujo: 'Flujo', reportes: 'Reportes'
}

export const TreasuryModulo: React.FC = () => {
  const rol = useSesionStore((state) => state.userProfile?.rol)
  const areas = obtenerAreasBP15(rol)
  const [areaActiva, setAreaActiva] = useState<AreaBP15>('caja')
  const tesoreria = useTreasury()

  if (areas.length === 0) {
    return <section className="rounded-2xl border border-surface bg-surface p-6">
      <h1 className="text-lg font-bold">Acceso no disponible</h1>
      <p className="mt-2 text-sm text-secondary">Tu rol no tiene acceso al módulo de Finanzas y Tesorería.</p>
    </section>
  }

  const areaVisible = areas.includes(areaActiva) ? areaActiva : areas[0]
  const panelProps = { snapshot: tesoreria.snapshot, acciones: tesoreria.acciones, online: tesoreria.online, loading: tesoreria.loading }

  return (
    <div className="space-y-5" data-testid="bp15-treasury">
      <PageHeader
        icon={DollarSign}
        title="Finanzas y Tesorería"
        description="Caja, conciliación, cartera y control financiero interno de la clínica."
        actions={
          <button type="button" onClick={() => void tesoreria.refrescar()} disabled={tesoreria.loading}
            className="inline-flex items-center gap-2 rounded-xl border border-surface bg-surface px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        }
      />

      {!tesoreria.online && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <span className="inline-flex items-center gap-2"><WifiOff className="h-4 w-4" /> Sin conexión. Los datos visibles son de la última sincronización; las operaciones financieras no se confirmarán offline.</span>
      </div>}
      {tesoreria.error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/30 dark:text-red-100">{tesoreria.error}</div>}

      <nav aria-label="Áreas de tesorería" className="flex gap-1 overflow-x-auto border-b border-surface pb-px">
        {areas.map((area) => <button type="button" key={area} onClick={() => setAreaActiva(area)}
          aria-current={areaVisible === area ? 'page' : undefined}
          className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${areaVisible === area ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-primary'}`}>
          {LABELS[area]}
        </button>)}
      </nav>

      {areaVisible === 'caja' && <CajaPanel {...panelProps} />}
      {areaVisible === 'conciliacion' && <ConciliacionPanel {...panelProps} />}
      {areaVisible === 'cartera' && <CarteraPanel {...panelProps} />}
      {areaVisible === 'gastos' && <GastosPanel {...panelProps} />}
      {areaVisible === 'bonos' && <BonosPanel {...panelProps} />}
      {areaVisible === 'libros' && <LibrosPanel {...panelProps} />}
      {areaVisible === 'flujo' && <FlujoPanel {...panelProps} />}
      {areaVisible === 'reportes' && <ReportesPanel {...panelProps} />}
    </div>
  )
}

export default TreasuryModulo
