/**
 * PresupuestoSection — Sección de presupuesto del paciente (F2-07a, F2-12)
 * Refactorizado con hook usePresupuesto + 4 sub-componentes (F7-25)
 */
import React, { memo } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { ModalDescuentoInventario } from './ModalDescuentoInventario'
import { FormularioAgregarPrestacion } from './FormularioAgregarPrestacion'
import { FormularioRegistrarAbono } from './FormularioRegistrarAbono'
import { DocumentoImprimiblePresupuesto } from './DocumentoImprimiblePresupuesto'
import { usePresupuesto, type UsePresupuestoProps, type ItemPresupuesto, type AbonoItem } from '../hooks/usePresupuesto'
import type { EstadosPiezaDental } from '../../../../shared/ui/DienteSVG'
import type { UserProfilePresupuestoRef } from './TablaItemsPresupuesto'

export interface PresupuestoSectionProps extends UsePresupuestoProps {
  userProfile?: UserProfilePresupuestoRef | null
  odontogramaInicial: Record<string | number, EstadosPiezaDental | unknown>
  itemsPresupuesto: ItemPresupuesto[]
  abonos?: AbonoItem[]
  totalPresupuesto: number
  totalAbonado: number
  saldoPendiente: number
}

export const PresupuestoSection: React.FC<PresupuestoSectionProps> = memo((props) => {
  const {
    paciente,
    userProfile,
    itemsPresupuesto,
    abonos = [],
    odontogramaInicial,
    totalPresupuesto,
    totalAbonado,
    saldoPendiente
  } = props

  const {
    arancelActualizado,
    convenioAplicado,
    piezaPresupuesto,
    prestacionSeleccionadaId,
    nombrePrestacion,
    valorPrestacion,
    precioPendiente,
    precioBaseOriginal,
    porcentajeDescuentoAplicado,
    origenPrecioAplicado,
    sucursalPrecioAplicada,
    montoAbono,
    metodoPagoAbono,
    itemPendienteDescuento,
    categoriaDetectada,
    materialesDisponibles,
    ubicacionesInventario,
    descuentoGuardando,
    errorDescuento,
    modoSincronizado,
    handleSeleccionarPrestacion,
    handleCambiarConvenioSelect,
    handleAgregarItemPresupuesto,
    handleCambiarEstadoItem,
    handleConfirmarDescuento,
    handleCancelarDescuento,
    handleEliminarItem,
    handleAgregarAbono,
    handleEliminarAbono,
    setPiezaPresupuesto,
    setNombrePrestacion,
    setValorPrestacion,
    setValorAbono,
    setMetodoPagoAbono
  } = usePresupuesto(props)

  return (
    <div>
      {/* Formulario para agregar prestación */}
      <FormularioAgregarPrestacion
        arancelActualizado={arancelActualizado}
        convenioAplicado={convenioAplicado}
        piezaPresupuesto={piezaPresupuesto}
        prestacionSeleccionadaId={prestacionSeleccionadaId}
        nombrePrestacion={nombrePrestacion}
        valorPrestacion={valorPrestacion}
        precioPendiente={precioPendiente}
        precioBaseOriginal={precioBaseOriginal}
        porcentajeDescuentoAplicado={porcentajeDescuentoAplicado}
        origenPrecioAplicado={origenPrecioAplicado}
        sucursalPrecioAplicada={sucursalPrecioAplicada}
        handleSeleccionarPrestacion={handleSeleccionarPrestacion}
        handleCambiarConvenioSelect={handleCambiarConvenioSelect}
        handleAgregarItemPresupuesto={handleAgregarItemPresupuesto}
        setPiezaPresupuesto={setPiezaPresupuesto}
        setNombrePrestacion={setNombrePrestacion}
        setValorPrestacion={setValorPrestacion}
      />

      {/* Formulario para registrar abono */}
      <FormularioRegistrarAbono
        abonos={abonos}
        montoAbono={montoAbono}
        metodoPagoAbono={metodoPagoAbono}
        handleAgregarAbono={handleAgregarAbono}
        handleEliminarAbono={handleEliminarAbono}
        setValorAbono={setValorAbono}
        setMetodoPagoAbono={setMetodoPagoAbono}
      />

      {/* Botón de Impresión Letter */}
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => window.print()} variant="primary" size="sm">
          <span className="flex items-center gap-1"><Printer size={14} />Imprimir Presupuesto con Odontograma (Letter)</span>
        </Button>
      </div>

      <p className="mb-3 rounded-xl border border-surface bg-surface-muted p-3 text-xs text-graphite-600 dark:text-graphite-300">
        El estado “Realizado” aquí corresponde al presupuesto y al descuento de insumos. Para cerrar el tratamiento en la ficha clínica y registrar el instrumental usado, utiliza Plan de tratamiento.
      </p>

      {/* Documento Imprimible del Presupuesto */}
      <DocumentoImprimiblePresupuesto
        paciente={paciente}
        userProfile={userProfile}
        odontogramaInicial={odontogramaInicial}
        itemsPresupuesto={itemsPresupuesto}
        totalPresupuesto={totalPresupuesto}
        totalAbonado={totalAbonado}
        saldoPendiente={saldoPendiente}
        handleCambiarEstadoItem={handleCambiarEstadoItem}
        handleEliminarItem={handleEliminarItem}
      />

      {/* F2-12: Modal de selección de materiales para descuento de inventario */}
      {itemPendienteDescuento && (
        <ModalDescuentoInventario
          item={itemPendienteDescuento}
          categoria={categoriaDetectada}
          materialesDisponibles={materialesDisponibles}
          alConfirmar={handleConfirmarDescuento}
          alCancelar={handleCancelarDescuento}
          ubicaciones={ubicacionesInventario}
          guardando={descuentoGuardando}
          error={errorDescuento}
          modoSincronizado={modoSincronizado}
        />
      )}
    </div>
  )
})

PresupuestoSection.displayName = 'PresupuestoSection'
