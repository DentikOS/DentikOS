import React, { memo } from 'react'
import { formatearCLP } from '../../../../shared/utils/formatoMoneda'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { Tag } from 'lucide-react'
import type { PrestacionArancel } from '../hooks/usePresupuesto'
import { useConfiguracionConvenios } from '../../../organization/clinic/hooks/useConfiguracionConvenios'
import { useSedes } from '../../../organization/clinic/hooks/useSedes'

export interface FormularioAgregarPrestacionProps {
  arancelActualizado: PrestacionArancel[]
  convenioAplicado: string
  piezaPresupuesto: string
  prestacionSeleccionadaId: string | number
  nombrePrestacion: string
  valorPrestacion: string | number
  precioPendiente?: boolean
  precioBaseOriginal: number
  porcentajeDescuentoAplicado: number
  origenPrecioAplicado?: string | null
  sucursalPrecioAplicada?: string | null
  handleSeleccionarPrestacion: (id: string) => void
  handleCambiarConvenioSelect: (convenio: string) => void
  handleAgregarItemPresupuesto: (e: React.FormEvent<HTMLFormElement>) => void
  setPiezaPresupuesto: (pieza: string) => void
  setNombrePrestacion: (nombre: string) => void
  setValorPrestacion: (valor: string | number) => void
}

export const FormularioAgregarPrestacion: React.FC<FormularioAgregarPrestacionProps> = memo(({
  arancelActualizado,
  convenioAplicado,
  piezaPresupuesto,
  prestacionSeleccionadaId,
  nombrePrestacion,
  valorPrestacion,
  precioPendiente = false,
  precioBaseOriginal,
  porcentajeDescuentoAplicado,
  origenPrecioAplicado = null,
  sucursalPrecioAplicada = null,
  handleSeleccionarPrestacion,
  handleCambiarConvenioSelect,
  handleAgregarItemPresupuesto,
  setPiezaPresupuesto,
  setNombrePrestacion,
  setValorPrestacion
}) => {
  const { configuracion, cargando: cargandoConvenios, cargada: conveniosCargados, error: errorConvenios } = useConfiguracionConvenios()
  const { sedes, sedeActivaId, cargando: cargandoSedes, errorSincronizacion: errorSedes } = useSedes()
  const requiereSucursal = Boolean(configuracion.preciosEspecificos?.some((precio) => precio.alcance === 'sucursal'))
  const preciosSincronizados = conveniosCargados && !errorConvenios && (!requiereSucursal || (
    !cargandoSedes && !errorSedes && Boolean(sedeActivaId)
  ))
  const conveniosActivos = configuracion.convenios.filter((convenio) => convenio.activo)
  const seleccionActualExiste = convenioAplicado === 'Particular' || conveniosActivos.some((convenio) =>
    convenio.id === convenioAplicado || convenio.nombre.toLocaleLowerCase('es-CL') === convenioAplicado.toLocaleLowerCase('es-CL')
  )

  return (
    <div className="bg-gray-50 dark:bg-graphite-800 p-4 border border-gray-200 dark:border-graphite-700 rounded-2xl mb-6 print:hidden space-y-4">
      <div className="flex justify-between items-center border-b pb-2 flex-wrap gap-2">
        <h4 className="font-bold text-xs text-graphite-800 dark:text-graphite-100 uppercase tracking-wider">
          Añadir Prestación al Plan de Tratamiento
        </h4>
        
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-graphite-600 dark:text-graphite-400">Convenio Activo:</span>
          <select
            value={convenioAplicado}
            onChange={(e) => handleCambiarConvenioSelect(e.target.value)}
            disabled={cargandoConvenios}
            className="px-2.5 py-1 border rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold border-emerald-300 dark:border-emerald-700 cursor-pointer"
          >
            <option value="Particular">Particular (Sin Descuento)</option>
            {!seleccionActualExiste && convenioAplicado && (
              <option value={convenioAplicado}>{convenioAplicado} (sin regla configurada)</option>
            )}
            {conveniosActivos.map((convenio) => (
              <option key={convenio.id} value={convenio.id}>
                {convenio.nombre}{convenio.tipo === 'fonasa' ? ` · Tramo ${convenio.tramoFonasa}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <form onSubmit={handleAgregarItemPresupuesto} className="flex flex-wrap gap-3 items-end text-xs">
        <Input
          label="Pieza Dental"
          type="text"
          placeholder="Ej: 1.6 o General"
          value={piezaPresupuesto}
          onChange={(e) => setPiezaPresupuesto(e.target.value)}
          className="w-28"
        />

        <div className="flex-1 min-w-[200px]">
          <label className="block text-graphite-600 dark:text-graphite-400 mb-1 font-semibold">
            Catálogo & Packs ({arancelActualizado.length})
          </label>
          <select
            value={prestacionSeleccionadaId}
            onChange={(e) => handleSeleccionarPrestacion(e.target.value)}
            disabled={!preciosSincronizados}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-graphite-900 font-semibold text-xs dark:text-graphite-100 dark:border-graphite-600 cursor-pointer"
          >
            <option value="">-- Buscar en catálogo de prestaciones o packs --</option>
            {arancelActualizado.map(p => {
              const precioMostrar = parseFloat(String(p.precio ?? p.precioParticular ?? 0)) || 0
              return (
                <option key={p.id} value={p.id}>
                  [{String(p.especialidad || 'General')}] {p.nombre} — Base: {formatearCLP(precioMostrar)}
                </option>
              )
            })}
          </select>
        </div>

        <Input
          label="Nombre Prestación (O libre)"
          type="text"
          placeholder="Nombre de la prestación"
          value={nombrePrestacion}
          onChange={(e) => setNombrePrestacion(e.target.value)}
          className="flex-1 min-w-[180px]"
        />

        <Input
          label={<>Valor Final ($ CLP) {porcentajeDescuentoAplicado > 0 && <span className="text-emerald-600 font-bold">(-{porcentajeDescuentoAplicado}%)</span>}</>}
          type="number"
          placeholder="Monto"
          value={valorPrestacion}
          onChange={(e) => setValorPrestacion(e.target.value)}
          className="w-32"
        />

        <Button type="submit" variant="primary" size="sm" disabled={!preciosSincronizados}>
          + Agregar al Presupuesto
        </Button>
      </form>

      {!preciosSincronizados && (
        <p role={errorConvenios || (requiereSucursal && errorSedes) ? 'alert' : 'status'} className="text-[11px] text-graphite-500">
          {errorConvenios
            ? 'No se pudo sincronizar la configuración de precios. Vuelve a cargar antes de agregar prestaciones.'
            : requiereSucursal && errorSedes
              ? 'No se pudieron sincronizar las sucursales requeridas para calcular el precio.'
              : requiereSucursal && !sedeActivaId && !cargandoSedes
                ? 'Selecciona una sucursal activa para aplicar los precios configurados.'
                : 'Sincronizando la configuración de precios…'}
        </p>
      )}

      {precioPendiente && (
        <p role="status" className="text-[11px] text-amber-700 dark:text-amber-300">
          Esta prestación no tiene tarifa Fonasa configurada. Revisa el arancel o ingresa un importe validado antes de agregarla.
        </p>
      )}

      {precioBaseOriginal > 0 && porcentajeDescuentoAplicado > 0 && (
        <div className="text-[11px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
          <span><Tag size={12} className="inline" />Descuento aplicado por Convenio (<strong>{convenioAplicado}</strong>): -{porcentajeDescuentoAplicado}%</span>
          <span>Precio Base: <del>{formatearCLP(precioBaseOriginal)}</del> → Precio Final: <strong>{formatearCLP(Number(valorPrestacion) || 0)}</strong></span>
        </div>
      )}
      {(origenPrecioAplicado === 'convenio-precio-fijo' || origenPrecioAplicado === 'sucursal') && (
        <p className="text-[11px] text-primary">
          Precio fijo aplicado{origenPrecioAplicado === 'convenio-precio-fijo' ? ' por convenio' : ` en ${sedes.find((sede) => sede.id === sucursalPrecioAplicada)?.nombre || 'la sucursal activa'}`}.
        </p>
      )}
    </div>
  )
})

FormularioAgregarPrestacion.displayName = 'FormularioAgregarPrestacion'
