import React, { memo, useEffect, useState } from 'react'
import { CATEGORIAS_INSUMOS } from './constants/inventarioConstants'
import { useInventario, type ItemInventario } from './hooks/useInventario'
import { StockSummaryCards } from './components/StockSummaryCards'
import { TablaInventario } from './components/TablaInventario'
import { ModalNuevoItemStock } from './components/ModalNuevoItemStock'
import { AsociacionesInsumos } from './components/AsociacionesInsumos'
import { Settings, Package } from 'lucide-react'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'
import { ModalMovimientoInventario } from './components/ModalMovimientoInventario'
import { InventarioPanelesBP09 } from './components/InventarioPanelesBP09'
import { useRBAC } from '../../../shared/hooks/useRBAC'
import { USE_SUPABASE } from '../../../infrastructure/supabase/supabaseClient'
import { inventarioCloudService } from './services/inventarioCloudService'

export const InventarioModulo: React.FC = memo(() => {
  const [modalAbierto, setModalAbierto] = useState<boolean>(false)
  const [modalMovimientoAbierto, setModalMovimientoAbierto] = useState(false)
  const [itemEditar, setItemEditar] = useState<ItemInventario | null>(null)
  const [mostrarAsociaciones, setMostrarAsociaciones] = useState<boolean>(false)
  const [puedeRegistrarMovimientos, setPuedeRegistrarMovimientos] = useState(false)
  const { esAdmin, rol } = useRBAC()

  const {
    items,
    catalogoItems,
    resumen,
    busqueda,
    setBusqueda,
    categoriaFiltro,
    setCategoriaFiltro,
    agregarOActualizarItem,
    eliminarItem,
    ubicaciones,
    movimientos,
    cargando,
    importacionPendiente,
    copiaLocalPreservada,
    progresoImportacion,
    registrarMovimiento,
    importarDatosLocales,
    sincronizar
  } = useInventario()

  useEffect(() => {
    if (!USE_SUPABASE) {
      setPuedeRegistrarMovimientos(esAdmin || rol === 'asistente')
      return
    }
    let vigente = true
    void Promise.all([
      inventarioCloudService.puedeOperar('movimientos.registrar'),
      inventarioCloudService.puedeOperar('ajustes.gestionar'),
      inventarioCloudService.puedeOperar('transferencias.gestionar')
    ]).then((permisos) => {
      if (vigente) setPuedeRegistrarMovimientos(permisos.some(Boolean))
    }).catch(() => { if (vigente) setPuedeRegistrarMovimientos(esAdmin || rol === 'asistente') })
    return () => { vigente = false }
  }, [esAdmin, rol])

  const handleAbrirNuevo = (): void => {
    setItemEditar(null)
    setModalAbierto(true)
  }

  const handleAbrirEditar = (item: ItemInventario): void => {
    setItemEditar(item)
    setModalAbierto(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Inventario e insumos clínicos"
        description="Monitoreo de existencias, fechas de caducidad y reabastecimiento."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {!USE_SUPABASE && <button
              onClick={() => setMostrarAsociaciones(!mostrarAsociaciones)}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer w-full sm:w-auto ${mostrarAsociaciones ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 dark:bg-graphite-700 text-gray-700 dark:text-graphite-300 hover:bg-gray-300'}`}
            ><span className="inline-flex items-center gap-1"><Settings size={12} />{mostrarAsociaciones ? 'Ocultar' : 'Configurar'} asociaciones locales</span></button>}

            {puedeRegistrarMovimientos && <button
              type="button"
              onClick={() => setModalMovimientoAbierto(true)}
              className="rounded-xl border border-surface bg-surface px-4 py-2.5 text-xs font-bold text-graphite-700 shadow-xs hover:bg-surface-muted dark:text-graphite-200"
            >Registrar movimiento</button>}

            {esAdmin && <button
              onClick={handleAbrirNuevo}
              className="bg-primary hover:bg-champagne-400 dark:bg-champagne-300 dark:hover:bg-champagne-200 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-xl transition-micro shadow-xs cursor-pointer w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              + Agregar Nuevo Insumo
            </button>}
          </div>
        }
      />

      <StockSummaryCards resumen={resumen} />

      {cargando && <p className="text-xs text-gray-500" aria-live="polite">Sincronizando inventario con la clínica…</p>}
      {USE_SUPABASE && importacionPendiente > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950"><div><strong>Hay {importacionPendiente} artículos guardados localmente.</strong><p>Se preservaron antes de sincronizar; importa saldos como movimientos de apertura.</p></div>{esAdmin && <button type="button" disabled={progresoImportacion !== null} onClick={() => void importarDatosLocales()} className="rounded-xl bg-sky-800 px-3 py-2 font-bold text-white disabled:opacity-50">{progresoImportacion === null ? 'Importar datos locales' : `Importando ${progresoImportacion}%`}</button>}</div>}
      {USE_SUPABASE && copiaLocalPreservada > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">La clínica ya tenía inventario sincronizado. Conservamos aparte {copiaLocalPreservada} artículos locales para revisión y no los mezclamos automáticamente.</div>}

      <div className="bg-gray-50 dark:bg-graphite-800 p-4 border border-gray-200 dark:border-graphite-700 rounded-2xl flex justify-between items-center flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="font-semibold text-gray-600 dark:text-graphite-400">Categoría:</span>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="p-2 border border-gray-300 dark:border-graphite-600 rounded-xl bg-white dark:bg-graphite-800 font-semibold flex-1 sm:flex-initial"
          >
            <option value="Todas">Todas las categorías</option>
            {CATEGORIAS_INSUMOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Buscar insumo o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="p-2 border border-gray-300 dark:border-graphite-600 rounded-xl bg-white dark:bg-graphite-800 w-full sm:w-64"
        />
      </div>

      <TablaInventario
        items={items}
        onEditar={handleAbrirEditar}
        onEliminar={(id) => void eliminarItem(id)}
        canManage={esAdmin}
      />

      <InventarioPanelesBP09
        items={catalogoItems}
        ubicaciones={ubicaciones}
        movimientos={movimientos}
        onRegistrarMovimiento={registrarMovimiento}
        onRefresh={sincronizar}
      />

      {mostrarAsociaciones && !USE_SUPABASE && <AsociacionesInsumos items={items} />}

      {modalMovimientoAbierto && <ModalMovimientoInventario
        items={catalogoItems}
        ubicaciones={ubicaciones}
        onClose={() => setModalMovimientoAbierto(false)}
        onRegistrar={registrarMovimiento}
      />}

      {modalAbierto && (
        <ModalNuevoItemStock
          itemEditar={itemEditar}
          alGuardar={agregarOActualizarItem}
          alCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
})

InventarioModulo.displayName = 'InventarioModulo'
export default InventarioModulo
