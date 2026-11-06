/**
 * CamposFormularioPresupuesto — Campos del formulario de presupuesto formal
 * Extraído de ModalNuevoPresupuesto.jsx para cumplir límites de allowlist (F7-25)
 */
import React from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { Tooth } from '../../../../shared/ui/icons/Tooth'
import { Input } from '../../../../shared/ui/ui/Input'
import { X } from 'lucide-react'

import type { PresupuestoItemLocal } from '../services/presupuestosStorageService'
import type { ConvenioClinica } from '../../../organization/clinic/schemas/configuracionConveniosSchema'
import { formatearImporteDocumento } from '../../../../shared/utils/formatoDocumento'
import type { ProductoVentaPresupuesto } from '../../../operations/inventory/services/inventarioCloudService'

export interface HallazgoOdontograma {
  pieza: string
  diagnostico: string
}

export type ItemSeleccionadoPresupuesto = PresupuestoItemLocal

export interface PacienteFormRef {
  id: string | number
  nombre?: string
  rut?: string
  prevision?: string | null
  [key: string]: unknown
}

export interface PrestacionFormRef {
  id: string | number
  nombre: string
  precio?: number | string
  precioParticular?: number | string
  [key: string]: unknown
}

export interface LaboratorioPresupuestoOption {
  id: string
  nombre: string
}

export interface TipoLaboratorioPresupuestoOption extends LaboratorioPresupuestoOption {
  categoria: string
}

export interface CamposFormularioPresupuestoProps {
  pacientes: PacienteFormRef[]
  prestaciones: PrestacionFormRef[]
  convenios: ConvenioClinica[]
  pacienteId: string | number
  convenio: string
  hallazgosOdontograma: HallazgoOdontograma[]
  piezaDental: string
  prestacionSelId: string
  itemsSeleccionados: ItemSeleccionadoPresupuesto[]
  montoTotal: number
  moneda?: string
  observacion: string
  setPacienteId: (val: string) => void
  setConvenio: (val: string) => void
  setPiezaDental: (val: string) => void
  setPrestacionSelId: (val: string) => void
  setObservacion: (val: string) => void
  handleImportarHallazgo: (hallazgo: HallazgoOdontograma) => void
  handleAgregarItem: () => void
  productosInventario?: ProductoVentaPresupuesto[]
  cargandoProductosInventario?: boolean
  errorCatalogoInventario?: boolean
  handleAgregarProducto?: (producto: ProductoVentaPresupuesto, cantidad: number) => void
  laboratoriosLaboratorio?: LaboratorioPresupuestoOption[]
  tiposTrabajoLaboratorio?: TipoLaboratorioPresupuestoOption[]
  cargandoCatalogoLaboratorio?: boolean
  errorCatalogoLaboratorio?: boolean
  onCambiarClasificacionLaboratorio?: (itemId: string | number, esLaboratorio: boolean) => void
  onCambiarCampoLaboratorio?: (
    itemId: string | number,
    campo: 'laboratorioId' | 'tipoTrabajoLaboratorioId' | 'piezaDentaria' | 'colorGuia' | 'indicacionesTecnicas',
    valor: string
  ) => void
  handleEliminarItem: (itemId: string | number) => void
}

export const CamposFormularioPresupuesto: React.FC<CamposFormularioPresupuestoProps> = ({
  pacientes,
  prestaciones,
  convenios,
  pacienteId,
  convenio,
  hallazgosOdontograma,
  piezaDental,
  prestacionSelId,
  itemsSeleccionados,
  montoTotal,
  moneda = 'CLP',
  observacion,
  setPacienteId,
  setConvenio,
  setPiezaDental,
  setPrestacionSelId,
  setObservacion,
  handleImportarHallazgo,
  handleAgregarItem,
  productosInventario = [],
  cargandoProductosInventario = false,
  errorCatalogoInventario = false,
  handleAgregarProducto,
  laboratoriosLaboratorio = [],
  tiposTrabajoLaboratorio = [],
  cargandoCatalogoLaboratorio = false,
  errorCatalogoLaboratorio = false,
  onCambiarClasificacionLaboratorio,
  onCambiarCampoLaboratorio,
  handleEliminarItem
}) => {
  const [productoInventarioId, setProductoInventarioId] = React.useState('')
  const [cantidadProducto, setCantidadProducto] = React.useState('1')
  const productoSeleccionado = productosInventario.find((producto) => producto.id === productoInventarioId)
  const cantidadProductoNumero = Number(cantidadProducto)
  const totalProducto = productoSeleccionado && Number.isFinite(cantidadProductoNumero) && cantidadProductoNumero > 0
    ? Math.round(cantidadProductoNumero * productoSeleccionado.precioVenta * (1 + productoSeleccionado.ivaPorcentaje / 100))
    : 0

  return (
    <>
      {/* Selects: Paciente + Convenio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Paciente *
          </label>
          <select
            value={pacienteId}
            onChange={(e) => {
              setPacienteId(e.target.value)
              const pac = pacientes.find((p) => String(p.id) === String(e.target.value))
              const configurado = convenios.find((item) => item.activo && (
                item.id.toLowerCase() === pac?.prevision?.toLowerCase() ||
                item.nombre.toLowerCase() === pac?.prevision?.toLowerCase()
              ))
              const fonasaConfigurado = pac?.prevision?.toLocaleLowerCase('es-CL').includes('fonasa')
                ? convenios.filter((item) => item.tipo === 'fonasa')
                : []
              setConvenio(configurado?.id || (fonasaConfigurado.length === 1 ? fonasaConfigurado[0].id : null) || (
                pac?.prevision?.toLocaleLowerCase('es-CL').includes('fonasa') ? '__fonasa_catalogo__' : 'Particular'
              ))
            }}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-900 font-bold cursor-pointer dark:text-graphite-100"
          >
            <option value="">-- Seleccionar Paciente --</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.rut})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Convenio / Previsión
          </label>
          <select
            value={convenio}
            onChange={(e) => setConvenio(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-900 font-semibold cursor-pointer dark:text-graphite-100"
          >
            <option value="Particular">Particular</option>
            {(convenio === '__fonasa_catalogo__' || pacientes.some((paciente) =>
              String(paciente.prevision || '').toLocaleLowerCase('es-CL').includes('fonasa')
            )) && <option value="__fonasa_catalogo__">FONASA · precio base del catálogo</option>}
            {convenios.filter((item) => item.activo).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}{item.tipo === 'fonasa' ? ` · Tramo ${item.tramoFonasa}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Precarga rápida desde el Odontograma del paciente */}
      {hallazgosOdontograma.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-xl space-y-1.5">
          <span className="font-bold text-blue-900 dark:text-blue-200 text-[11px] block">
            <span className="flex items-center gap-1.5">
              <Icon icon={Tooth} size="sm" />Hallazgos detectados en Odontograma
            </span>{' '}
            ({hallazgosOdontograma.length}):
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {hallazgosOdontograma.map((h, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleImportarHallazgo(h)}
                className="bg-white dark:bg-graphite-800 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-900 dark:text-blue-200 font-bold px-2 py-1 rounded-lg text-[10px] cursor-pointer transition-colors shadow-2xs"
              >
                Revisar pieza {h.pieza}: {h.diagnostico}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agregar prestaciones dinámicamente */}
      <div className="bg-gray-50 dark:bg-graphite-800 p-3 rounded-xl border dark:border-graphite-700 space-y-2">
        <label className="block font-bold text-gray-800 dark:text-graphite-100 uppercase text-[10px]">
          Añadir Tratamientos del Arancel
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <div className="sm:col-span-3">
            <Input
              type="text"
              placeholder="Pieza (1.6)"
              value={piezaDental}
              onChange={(e) => setPiezaDental(e.target.value)}
            />
          </div>

          <div className="sm:col-span-6 min-w-0">
            <select
              value={prestacionSelId}
              onChange={(e) => setPrestacionSelId(e.target.value)}
              className="w-full p-2 rounded-lg border dark:border-graphite-600 bg-white dark:bg-graphite-900 font-medium truncate text-xs cursor-pointer dark:text-graphite-100"
            >
              <option value="">-- Seleccionar Prestación --</option>
              {prestaciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({formatearImporteDocumento(
                    parseFloat(String(p.precioParticular ?? p.precio ?? 0)) || 0, moneda,
                  )})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={handleAgregarItem}
              className="w-full bg-graphite-900 dark:bg-graphite-100 text-white dark:text-graphite-900 p-2 rounded-lg font-bold hover:bg-graphite-800 dark:hover:bg-graphite-200 transition-colors shadow-xs cursor-pointer"
            >
              + Añadir
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-36 overflow-y-auto pt-1">
          {itemsSeleccionados.map((it) => (
            <div
              key={String(it.id)}
              className="flex justify-between items-center p-2 bg-white dark:bg-graphite-900 border dark:border-graphite-700 rounded-lg"
            >
              <span className="truncate max-w-[280px] dark:text-graphite-100">
                {it.inventarioId
                  ? <><strong>{String(it.prestacion || it.prestacionNombre || 'Producto')}</strong> · {Number(it.cantidadInventario)} {it.inventarioUnidad || 'unidades'}</>
                  : <><strong>[{it.pieza ? String(it.pieza) : it.piezaDentaria ? String(it.piezaDentaria) : ''}]</strong> {it.prestacion ? String(it.prestacion) : String(it.prestacionNombre || '')}</>}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-gray-900 dark:text-graphite-100">
                  {formatearImporteDocumento(Number(it.valor || 0), moneda)}
                </span>
                <button
                  type="button"
                  onClick={() => it.id != null && handleEliminarItem(it.id)}
                  className="text-red-500 font-bold hover:text-red-700 cursor-pointer"
                  aria-label="Eliminar item"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {!it.inventarioId && onCambiarClasificacionLaboratorio && (
                <div className="w-full border-t border-surface pt-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={it.esLaboratorio === true}
                      disabled={cargandoCatalogoLaboratorio || tiposTrabajoLaboratorio.length === 0}
                      onChange={(event) => onCambiarClasificacionLaboratorio(it.id!, event.target.checked)}
                      aria-label={`Requiere orden de laboratorio: ${String(it.prestacion || it.prestacionNombre || 'ítem')}`}
                    />
                    Requiere orden de laboratorio
                  </label>
                  {it.esLaboratorio === true && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-background p-2">
                      <label className="space-y-1 text-[11px] font-medium">
                        <span>Tipo de trabajo *</span>
                        <select
                          required
                          value={it.tipoTrabajoLaboratorioId || ''}
                          onChange={(event) => onCambiarCampoLaboratorio?.(it.id!, 'tipoTrabajoLaboratorioId', event.target.value)}
                          className="w-full min-h-9 rounded-lg border border-surface bg-surface px-2"
                        >
                          <option value="">Seleccionar tipo</option>
                          {tiposTrabajoLaboratorio.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1 text-[11px] font-medium">
                        <span>Laboratorio</span>
                        <select
                          value={it.laboratorioId || ''}
                          onChange={(event) => onCambiarCampoLaboratorio?.(it.id!, 'laboratorioId', event.target.value)}
                          className="w-full min-h-9 rounded-lg border border-surface bg-surface px-2"
                        >
                          <option value="">Por asignar</option>
                          {laboratoriosLaboratorio.map(lab => <option key={lab.id} value={lab.id}>{lab.nombre}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1 text-[11px] font-medium">
                        <span>Pieza dental</span>
                        <input
                          value={it.piezaDentaria || ''}
                          maxLength={80}
                          onChange={(event) => onCambiarCampoLaboratorio?.(it.id!, 'piezaDentaria', event.target.value)}
                          className="w-full min-h-9 rounded-lg border border-surface bg-surface px-2"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-medium">
                        <span>Color guía</span>
                        <input
                          value={it.colorGuia || ''}
                          maxLength={80}
                          onChange={(event) => onCambiarCampoLaboratorio?.(it.id!, 'colorGuia', event.target.value)}
                          className="w-full min-h-9 rounded-lg border border-surface bg-surface px-2"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-medium sm:col-span-2">
                        <span>Indicaciones técnicas</span>
                        <textarea
                          value={it.indicacionesTecnicas || ''}
                          maxLength={3000}
                          rows={2}
                          onChange={(event) => onCambiarCampoLaboratorio?.(it.id!, 'indicacionesTecnicas', event.target.value)}
                          className="w-full rounded-lg border border-surface bg-surface px-2 py-1.5"
                        />
                      </label>
                      <p className="text-[10px] text-muted-foreground sm:col-span-2">
                        La orden se crea al aprobar el presupuesto. El precio del paciente no cambia.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {errorCatalogoLaboratorio && <p role="status" className="text-[10px] text-amber-700">No se pudo sincronizar el catálogo de laboratorio; el presupuesto puede guardarse sin clasificar ítems.</p>}
        {!cargandoCatalogoLaboratorio && !errorCatalogoLaboratorio && tiposTrabajoLaboratorio.length === 0 && (
          <p className="text-[10px] text-muted-foreground">El catálogo de laboratorio no tiene tipos activos en esta clínica.</p>
        )}
      </div>

      <div className="bg-sky-50 dark:bg-sky-950/20 p-3 rounded-xl border border-sky-200 dark:border-sky-900 space-y-2">
        <label className="block font-bold text-sky-950 dark:text-sky-200 uppercase text-[10px]">
          Añadir productos de inventario
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div className="sm:col-span-7 min-w-0">
            <label className="block text-[10px] font-semibold mb-1 text-sky-950 dark:text-sky-200">Producto</label>
            <select
              value={productoInventarioId}
              onChange={(event) => setProductoInventarioId(event.target.value)}
              disabled={cargandoProductosInventario || productosInventario.length === 0}
              className="w-full p-2 rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-graphite-900 text-xs dark:text-graphite-100"
            >
              <option value="">{cargandoProductosInventario ? 'Cargando catálogo…' : '-- Seleccionar producto --'}</option>
              {productosInventario.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre} · {formatearImporteDocumento(producto.precioVenta, moneda)} + IVA {producto.ivaPorcentaje}%
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-semibold mb-1 text-sky-950 dark:text-sky-200">Cantidad</label>
            <Input type="number" min="0.001" step="0.001" value={cantidadProducto}
              onChange={(event) => setCantidadProducto(event.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <button
              type="button"
              disabled={!productoSeleccionado || !handleAgregarProducto || cantidadProductoNumero <= 0 || !Number.isFinite(cantidadProductoNumero)}
              onClick={() => {
                if (productoSeleccionado && handleAgregarProducto) {
                  handleAgregarProducto(productoSeleccionado, cantidadProductoNumero)
                  setProductoInventarioId('')
                  setCantidadProducto('1')
                }
              }}
              className="w-full bg-sky-800 hover:bg-sky-900 disabled:opacity-50 text-white p-2 rounded-lg font-bold transition-colors"
            >
              + Añadir producto
            </button>
          </div>
        </div>
        <p className="text-[10px] text-sky-900 dark:text-sky-200">
          {productoSeleccionado
            ? `Total estimado con IVA: ${formatearImporteDocumento(totalProducto, moneda)}`
            : errorCatalogoInventario
              ? 'No se pudo sincronizar el catálogo de inventario; reintenta al recuperar conexión.'
              : productosInventario.length === 0 && !cargandoProductosInventario
              ? 'No hay productos de venta activos disponibles en el catálogo de esta clínica.'
              : 'La aprobación requiere elegir una ubicación con stock; el servidor vuelve a validar precio e IVA.'}
        </p>
      </div>

      {/* Monto Total */}
      <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
        <span className="font-bold text-emerald-900 dark:text-emerald-200 uppercase">
          Monto Total Cotizado:
        </span>
        <span className="text-base font-black text-emerald-900 dark:text-emerald-200">
          {formatearImporteDocumento(montoTotal, moneda)}
        </span>
      </div>

      {/* Observaciones */}
      <div>
        <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
          Observaciones / Indicaciones Especiales
        </label>
        <textarea
          rows={2}
          placeholder="Ej: Cotización válida por 30 días. Incluye controles postoperatorios..."
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-900 dark:text-graphite-100"
        />
      </div>
    </>
  )
}
