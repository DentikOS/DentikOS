import React, { memo, useState } from 'react'
import { useFinanzas } from './hooks/useFinanzas'
import { BalanceCajaCards } from './components/BalanceCajaCards'
import { ArqueoCajaDiario } from './components/ArqueoCajaDiario'
import { TablaMovimientos } from './components/TablaMovimientos'
import { ModalNuevoMovimiento } from './components/ModalNuevoMovimiento'
import { CuentasPendientes } from './components/CuentasPendientes'
import { CalculadoraBoletas } from './components/CalculadoraBoletas'
import { usePacientesStore } from '../../../app/stores/pacientesStore'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { DollarSign } from 'lucide-react'
import type { Paciente } from '../../../domains/clinical/patient/schemas/pacienteSchema'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'

type TabFinanzas =
  | 'Arqueo de Caja'
  | 'Historial Global de Movimientos'
  | 'Cuentas Pendientes'
  | 'Calculadora de Boletas'

const TABS: readonly TabFinanzas[] = [
  'Arqueo de Caja',
  'Historial Global de Movimientos',
  'Cuentas Pendientes',
  'Calculadora de Boletas'
]

export const FinanzasModulo: React.FC = memo(() => {
  // (F2-02) — pacientes y userProfile ya no llegan como prop desde App.jsx: se leen directo de los stores.
  const pacientes = usePacientesStore((state: { pacientes: Paciente[] }) => state.pacientes)
  const userProfile = useSesionStore((state: { userProfile?: { nombreCompleto?: string; [key: string]: unknown } | null }) => state.userProfile)

  const [tabActiva, setTabActiva] = useState<TabFinanzas>('Arqueo de Caja')
  const [modalAbierto, setModalAbierto] = useState<boolean>(false)

  const {
    movimientos,
    transaccionesDiaArqueo,
    fechaArqueo,
    setFechaArqueo,
    balanceGlobal,
    agregarMovimiento,
    eliminarMovimiento
  } = useFinanzas(pacientes)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={DollarSign}
        title="Control financiero y arqueo de caja"
        description="Gestión de ingresos, egresos, arqueos diarios y balances contables de la clínica."
        className="print:hidden"
        actions={
          <button
            onClick={() => setModalAbierto(true)}
            className="bg-primary hover:bg-champagne-400 dark:bg-champagne-300 dark:hover:bg-champagne-200 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-xl transition-micro shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            + Registrar Ingreso / Egreso Manual
          </button>
        }
      />

      <div className="print:hidden">
        <BalanceCajaCards balance={balanceGlobal} />
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-graphite-700 print:hidden flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              tabActiva === tab ? 'border-black text-black dark:text-graphite-50' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Renderizado de Pestañas */}
      {tabActiva === 'Arqueo de Caja' && (
        <ArqueoCajaDiario
          transaccionesDia={transaccionesDiaArqueo}
          fechaArqueo={fechaArqueo}
          setFechaArqueo={setFechaArqueo}
          userProfile={userProfile}
        />
      )}

      {tabActiva === 'Historial Global de Movimientos' && (
        <div className="print:hidden">
          <TablaMovimientos movimientos={movimientos} onEliminar={eliminarMovimiento} />
        </div>
      )}

      {tabActiva === 'Cuentas Pendientes' && (
        <div className="print:hidden">
          <CuentasPendientes pacientes={pacientes} />
        </div>
      )}

      {tabActiva === 'Calculadora de Boletas' && (
        <div className="print:hidden">
          <CalculadoraBoletas alRegistrarGastoHonorario={agregarMovimiento} />
        </div>
      )}

      {modalAbierto && (
        <ModalNuevoMovimiento
          alGuardar={agregarMovimiento}
          alCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
})

FinanzasModulo.displayName = 'FinanzasModulo'
