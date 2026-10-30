import React, { memo, useState } from 'react'
import { TrendingUp, ClipboardList, Gift } from 'lucide-react'
import { Icon } from '../../../shared/ui/Icon'
import { Tooth } from '../../../shared/ui/icons/Tooth'
import { ESPECIALIDADES_ODONTOLOGICAS } from './constants/prestacionesConstants'
import { usePrestaciones, type PrestacionInput } from './hooks/usePrestaciones'
import { PrestacionesSummaryCards } from './components/PrestacionesSummaryCards'
import { TablaArancelPrestaciones } from './components/TablaArancelPrestaciones'
import { PaquetesClinicosManager } from './components/PaquetesClinicosManager'
import { ModalNuevaPrestacion } from './components/ModalNuevaPrestacion'
import { ReajusteMasivoModal } from './components/ReajusteMasivoModal'
import { usePrestacionesStore } from '../../../app/stores/prestacionesStore'
import type { Prestacion } from './services/prestacionesStorageService'
import { USE_SUPABASE } from '../../../infrastructure/supabase/supabaseClient'
import { useRBAC } from '../../../shared/hooks/useRBAC'
import { ImportarArancelLocal } from './components/ImportarArancelLocal'

interface PrestacionesStoreState {
  prestacionesArancel: Prestacion[]
  setPrestacionesArancel: (prestaciones: Prestacion[]) => void
}

export const PrestacionesModulo: React.FC = memo(() => {
  const { rol } = useRBAC()
  // (F2-02) — prestacionesArancel/setPrestacionesArancel ya no llegan como prop desde App.jsx: se leen directo del store.
  const prestacionesProp = usePrestacionesStore(
    (state: PrestacionesStoreState) => state.prestacionesArancel
  )
  const setPrestacionesProp = usePrestacionesStore(
    (state: PrestacionesStoreState) => state.setPrestacionesArancel
  )
  const estadoRemoto = usePrestacionesStore((state) => state.estadoRemoto)

  const [tabActual, setTabActual] = useState<'arancel' | 'paquetes'>('arancel')
  const [modalAbierto, setModalAbierto] = useState<boolean>(false)
  const [modalReajusteAbierto, setModalReajusteAbierto] = useState<boolean>(false)
  const [prestacionEditar, setPrestacionEditar] = useState<Prestacion | null>(null)
  const [errorOperacion, setErrorOperacion] = useState('')

  const {
    prestaciones,
    paquetes,
    resumen,
    busqueda,
    setBusqueda,
    especialidadFiltro,
    setEspecialidadFiltro,
    agregarOActualizarPrestacion,
    eliminarPrestacion,
    aplicarReajusteMasivo,
    agregarPaquete,
    eliminarPaquete
  } = usePrestaciones(prestacionesProp, setPrestacionesProp)

  const handleAbrirNuevo = (): void => {
    setPrestacionEditar(null)
    setModalAbierto(true)
  }

  const handleAbrirEditar = (prestacion: Prestacion): void => {
    setPrestacionEditar(prestacion)
    setModalAbierto(true)
  }

  return (
    <div className="space-y-6">
      {USE_SUPABASE && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs" role="status">
        {estadoRemoto === 'cargando' || estadoRemoto === 'pendiente'
          ? 'Cargando arancel compartido de la clínica…'
          : estadoRemoto === 'error'
            ? 'No se pudo cargar el arancel compartido. Revisa la conexión y vuelve a intentar.'
            : prestacionesProp.length === 0
              ? 'La clínica aún no tiene prestaciones sincronizadas. Registra las prestaciones y sus precios clínicos aquí.'
              : 'Arancel compartido con Plan de Tratamiento y Presupuestos.'}
        {estadoRemoto === 'error' && <button type="button" className="ml-2 underline" onClick={() => void usePrestacionesStore.getState().sincronizarDesdeSupabase()}>Reintentar</button>}
      </div>}
      {errorOperacion && <p role="alert" className="text-red-700 text-xs">{errorOperacion}</p>}
      {USE_SUPABASE && (rol === 'admin' || rol === 'dentista') && <ImportarArancelLocal />}
      <div className="flex justify-between items-center flex-wrap gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-graphite-50 uppercase tracking-wider flex items-center gap-2">
            <Icon icon={Tooth} size="md" />
            Arancel de Prestaciones & Paquetes Clínicos
          </h2>
          <p className="text-xs text-gray-500 dark:text-graphite-400">
            Catálogo oficial de procedimientos, convenios y promociones de la clínica.
          </p>
        </div>

        <div className="flex gap-2">
          {tabActual === 'arancel' && (
            <>
              <button
                onClick={() => setModalReajusteAbierto(true)}
                disabled={USE_SUPABASE}
                title={USE_SUPABASE ? 'Disponible cuando exista un reajuste atómico del arancel compartido' : undefined}
                className="bg-gray-100 dark:bg-graphite-800 text-gray-800 dark:text-graphite-100 text-xs font-bold px-3 py-2.5 rounded-xl hover:bg-gray-200 transition-colors border cursor-pointer"
              >
                <span className="inline-flex items-center gap-1">
                  <TrendingUp size={12} />Reajuste %
                </span>
              </button>
              <button
                onClick={handleAbrirNuevo}
                disabled={USE_SUPABASE && estadoRemoto !== 'listo'}
                className="bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors shadow-xs cursor-pointer"
              >
                + Nueva Prestación
              </button>
            </>
          )}
        </div>
      </div>

      <div className="print:hidden">
        <PrestacionesSummaryCards resumen={resumen} />
      </div>

      <div className="flex gap-2 border-b pb-1 print:hidden text-xs">
        <button
          onClick={() => setTabActual('arancel')}
          className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            tabActual === 'arancel'
              ? 'bg-black text-white shadow-xs'
              : 'bg-gray-100 dark:bg-graphite-800 text-gray-600 dark:text-graphite-400 hover:bg-gray-200'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <ClipboardList size={12} />Arancel General (Particular / Fonasa)
          </span>
        </button>

        <button
          onClick={() => setTabActual('paquetes')}
          className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            tabActual === 'paquetes'
              ? 'bg-black text-white shadow-xs'
              : 'bg-gray-100 dark:bg-graphite-800 text-gray-600 dark:text-graphite-400 hover:bg-gray-200'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <Gift size={12} />Packs y Promociones Clínicas
          </span>
        </button>
      </div>

      {tabActual === 'arancel' && (
        <>
          <div className="bg-gray-50 dark:bg-graphite-800 p-4 border border-gray-200 dark:border-graphite-700 rounded-2xl flex justify-between items-center flex-wrap gap-3 text-xs print:hidden">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="font-semibold text-gray-600 dark:text-graphite-400">Especialidad:</span>
              <select
                value={especialidadFiltro}
                onChange={(e) => setEspecialidadFiltro(e.target.value)}
                className="p-2 border rounded-xl bg-white dark:bg-graphite-800 font-semibold flex-1 sm:flex-initial"
              >
                <option value="Todas">Todas las especialidades</option>
                {ESPECIALIDADES_ODONTOLOGICAS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="Buscar por procedimiento o código Fonasa..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="p-2 border rounded-xl bg-white dark:bg-graphite-800 w-full sm:w-64"
            />
          </div>

          <TablaArancelPrestaciones
            prestaciones={prestaciones}
            onEditar={handleAbrirEditar}
            onEliminar={(id) => { setErrorOperacion(''); void eliminarPrestacion(id).catch((cause) => setErrorOperacion(cause instanceof Error ? cause.message : 'No se pudo eliminar la prestación.')) }}
          />
        </>
      )}

      {tabActual === 'paquetes' && (
        <>
          {USE_SUPABASE && <p className="text-xs text-amber-800">El precio y nombre de un pack nuevo se comparten como prestación; su descripción y promoción siguen guardadas en este navegador.</p>}
          <PaquetesClinicosManager
            paquetes={paquetes}
            alGuardarPaquete={agregarPaquete}
            alEliminarPaquete={eliminarPaquete}
          />
        </>
      )}

      {modalAbierto && (
        <ModalNuevaPrestacion
          prestacionEditar={prestacionEditar}
          alGuardar={(p: PrestacionInput) => agregarOActualizarPrestacion(p)}
          alCerrar={() => setModalAbierto(false)}
        />
      )}

      {modalReajusteAbierto && (
        <ReajusteMasivoModal
          alAplicarReajuste={aplicarReajusteMasivo}
          alCerrar={() => setModalReajusteAbierto(false)}
        />
      )}
    </div>
  )
})

PrestacionesModulo.displayName = 'PrestacionesModulo'
