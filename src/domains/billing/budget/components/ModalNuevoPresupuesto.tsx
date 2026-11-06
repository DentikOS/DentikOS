/**
 * ModalNuevoPresupuesto — Modal para emitir presupuesto formal cotizado
 * Migrado a <Modal> base + CamposFormularioPresupuesto (F7-25)
 */
import React, { memo, useState, useEffect } from 'react'
import { generarFolioPresupuesto } from '../utils/presupuestosCalculations'
import type { PresupuestoLocal } from '../services/presupuestosStorageService'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { odontogramaStorageService } from '../../../clinical/odontogram'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import {
  CamposFormularioPresupuesto,
  type PacienteFormRef,
  type PrestacionFormRef,
  type HallazgoOdontograma,
  type ItemSeleccionadoPresupuesto
} from './CamposFormularioPresupuesto'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { useConfiguracionConvenios } from '../../../organization/clinic/hooks/useConfiguracionConvenios'
import { useConfiguracionFinanciera } from '../../../organization/clinic/hooks/useConfiguracionFinanciera'
import { useSedes } from '../../../organization/clinic/hooks/useSedes'
import { resolverPrecioPrestacion } from '../../../organization/clinic/schemas/configuracionConveniosSchema'
import { clinicStorageService } from '../../../organization/clinic/services/clinicStorageService'
import { resolverMonedaDocumento } from '../../../../shared/utils/formatoDocumento'
import type { ProductoVentaPresupuesto } from '../../../operations/inventory/services/inventarioCloudService'
import { laboratorioCloudService, type CatalogoLaboratorioPresupuesto } from '../../../addons/lab/services/laboratorioCloudService'

const log = createLogger('ModalNuevoPresupuesto')

export interface ModalNuevoPresupuestoProps {
  pacientes?: PacienteFormRef[]
  prestaciones?: PrestacionFormRef[]
  productosInventario?: ProductoVentaPresupuesto[]
  cargandoProductosInventario?: boolean
  errorCatalogoInventario?: boolean
  alGuardar: (nuevoPresupuesto: PresupuestoLocal) => boolean | Promise<boolean>
  alCerrar: () => void
}

export const ModalNuevoPresupuesto: React.FC<ModalNuevoPresupuestoProps> = memo(({
  pacientes = [],
  prestaciones = [],
  productosInventario = [],
  cargandoProductosInventario = false,
  errorCatalogoInventario = false,
  alGuardar,
  alCerrar
}) => {
  const [pacienteId, setPacienteId] = useState<string>('')
  const { alert: dialogAlert } = useAppDialog()
  const [convenio, setConvenio] = useState<string>('Particular')
  const { configuracion, cargando: cargandoConfiguracion, cargada: configuracionCargada } = useConfiguracionConvenios()
  const { configuracion: financiera, cargando: cargandoFinanciera, cargada: financieraCargada } = useConfiguracionFinanciera()
  const { sedeActivaId, cargando: cargandoSucursales, errorSincronizacion: errorSucursales } = useSedes()
  const convenios = configuracion.convenios.filter((item) => item.activo)
  const moneda = resolverMonedaDocumento(clinicStorageService.obtenerClinica()?.moneda)
  const [observacion, setObservacion] = useState<string>('')
  const [guardando, setGuardando] = useState(false)

  const [itemsSeleccionados, setItemsSeleccionados] = useState<ItemSeleccionadoPresupuesto[]>([])
  const [prestacionSelId, setPrestacionSelId] = useState<string>('')
  const [piezaDental, setPiezaDental] = useState<string>('')

  const [hallazgosOdontograma, setHallazgosOdontograma] = useState<HallazgoOdontograma[]>([])
  const [catalogoLaboratorio, setCatalogoLaboratorio] = useState<CatalogoLaboratorioPresupuesto>({ laboratorios: [], tiposTrabajo: [] })
  const [cargandoCatalogoLaboratorio, setCargandoCatalogoLaboratorio] = useState(true)
  const [errorCatalogoLaboratorio, setErrorCatalogoLaboratorio] = useState(false)

  useEffect(() => {
    let vigente = true
    setCargandoCatalogoLaboratorio(true)
    laboratorioCloudService.cargarCatalogoPresupuesto()
      .then(catalogo => {
        if (vigente) setCatalogoLaboratorio(catalogo)
      })
      .catch(() => {
        if (vigente) setErrorCatalogoLaboratorio(true)
      })
      .finally(() => {
        if (vigente) setCargandoCatalogoLaboratorio(false)
      })
    return () => { vigente = false }
  }, [])

  useEffect(() => {
    setItemsSeleccionados([])
    if (!pacienteId) {
      setHallazgosOdontograma([])
      return
    }

    try {
      const odonto = odontogramaStorageService.obtenerOdontograma(
        `odonto_inicial_${pacienteId}`,
        {}
      )
      if (odonto && typeof odonto === 'object') {
        const listaHallazgos: HallazgoOdontograma[] = []

        Object.keys(odonto as Record<string, unknown>).forEach((pieza) => {
          const estados = (odonto as Record<string, unknown>)[pieza]
          if (Array.isArray(estados)) {
            estados.forEach((est) => {
              if (est && est !== 'Sano') {
                listaHallazgos.push({ pieza, diagnostico: String(est) })
              }
            })
          }
        })

        setHallazgosOdontograma(listaHallazgos)
      } else {
        setHallazgosOdontograma([])
      }
    } catch (e) {
      log.error('Error al leer Odontograma del paciente:', e)
      setHallazgosOdontograma([])
    }
  }, [pacienteId])

  const handleAgregarItem = (): void => {
    if (!prestacionSelId) return
    if (cargandoConfiguracion || !configuracionCargada) {
      void dialogAlert({
        title: 'Configuración pendiente',
        description: 'Espera a que se sincronice la configuración de convenios y sucursales antes de agregar prestaciones.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }
    const prest = prestaciones.find((p) => String(p.id) === String(prestacionSelId))
    if (!prest) return

    const tienePrecioDeSucursal = configuracion.preciosEspecificos?.some((precio) =>
      precio.alcance === 'sucursal' && precio.prestacionId === String(prest.id)
    )
    if (tienePrecioDeSucursal && (cargandoSucursales || errorSucursales || !sedeActivaId)) {
      void dialogAlert({
        title: 'Sucursal requerida',
        description: errorSucursales
          ? 'No se pudieron sincronizar las sucursales. Vuelve a intentarlo antes de agregar esta prestación.'
          : 'Selecciona una sucursal activa y espera a que se sincronice antes de agregar esta prestación.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    const precioParticular = Number(prest.precioParticular ?? prest.precio ?? 0)
    const sucursalId = sedeActivaId
    const esFonasaCatalogo = convenio === '__fonasa_catalogo__'
    const convenioConfigurado = convenios.find((item) => item.id === convenio)
    const precio = resolverPrecioPrestacion(
      configuracion,
      {
        prestacionId: prest.id,
        convenioIdentificador: convenio === 'Particular' || esFonasaCatalogo ? null : convenio,
        especialidad: typeof prest.especialidad === 'string' ? prest.especialidad : null,
        categoria: typeof prest.categoria === 'string' ? prest.categoria : null,
        sucursalId,
        precioParticular: Number.isFinite(precioParticular) && precioParticular >= 0 ? Math.round(precioParticular) : 0,
      }
    )

    if (precio.precio === null || precio.precioBase === null) {
      void dialogAlert({
        title: 'Precio no disponible',
        description: `No se pudo resolver un precio para ${prest.nombre}. Revisa el precio base y las reglas de convenio o sucursal antes de incluirla en este presupuesto.`,
        variant: 'warning',
        confirmText: 'Entendido',
      })
      return
    }

    const nuevoItem: ItemSeleccionadoPresupuesto = {
      id: crypto.randomUUID(),
      prestacionId: prest.id,
      pieza: piezaDental || 'General',
      prestacion: prest.nombre,
      convenio: convenioConfigurado?.nombre || (esFonasaCatalogo ? 'FONASA' : 'Particular'),
      convenioId: convenio === 'Particular' ? undefined : esFonasaCatalogo ? 'fonasa' : convenio,
      precioBase: precio.precioBase,
      descuentoPct: precio.descuentoPct,
      precioOrigen: precio.origen,
      sucursalIdPrecio: sucursalId,
      valor: precio.precio,
      estado: 'Pendiente'
    }

    setItemsSeleccionados([...itemsSeleccionados, nuevoItem])
    setPrestacionSelId('')
    setPiezaDental('')
  }

  const handleImportarHallazgo = (hallazgo: HallazgoOdontograma): void => {
    setPiezaDental(hallazgo.pieza)
    setPrestacionSelId('')
  }

  const handleAgregarProducto = (producto: ProductoVentaPresupuesto, cantidad: number): void => {
    if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 99999999999.999
      || !Number.isFinite(producto.precioVenta) || producto.precioVenta <= 0
      || !Number.isFinite(producto.ivaPorcentaje) || producto.ivaPorcentaje < 0 || producto.ivaPorcentaje > 100) {
      void dialogAlert({
        title: 'Cantidad o precio inválido',
        description: 'Revisa la cantidad y el precio del producto antes de añadirlo.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }
    const total = Math.round(cantidad * producto.precioVenta * (1 + producto.ivaPorcentaje / 100))
    setItemsSeleccionados((items) => [...items, {
      id: crypto.randomUUID(),
      prestacionId: null,
      prestacionNombre: producto.nombre,
      prestacion: producto.nombre,
      inventarioId: producto.id,
      cantidadInventario: cantidad,
      inventarioUnidad: producto.unidad,
      precioUnitarioInventario: producto.precioVenta,
      ivaPorcentajeInventario: producto.ivaPorcentaje,
      convenio: 'Particular',
      valor: total,
      estado: 'Pendiente'
    }])
  }

  const handleEliminarItem = (itemId: string | number): void => {
    setItemsSeleccionados(itemsSeleccionados.filter((i) => i.id !== itemId))
  }

  const cambiarClasificacionLaboratorio = (itemId: string | number, esLaboratorio: boolean): void => {
    setItemsSeleccionados(items => items.map(item => String(item.id) === String(itemId)
      ? {
          ...item,
          esLaboratorio,
          laboratorioId: esLaboratorio ? item.laboratorioId || null : null,
          tipoTrabajoLaboratorioId: esLaboratorio ? item.tipoTrabajoLaboratorioId || null : null,
          piezaDentaria: esLaboratorio ? item.piezaDentaria || (item.pieza ? String(item.pieza) : null) : null,
          colorGuia: esLaboratorio ? item.colorGuia || null : null,
          indicacionesTecnicas: esLaboratorio ? item.indicacionesTecnicas || null : null,
        }
      : item))
  }

  const cambiarCampoLaboratorio = (
    itemId: string | number,
    campo: 'laboratorioId' | 'tipoTrabajoLaboratorioId' | 'piezaDentaria' | 'colorGuia' | 'indicacionesTecnicas',
    valor: string
  ): void => {
    setItemsSeleccionados(items => items.map(item => String(item.id) === String(itemId)
      ? { ...item, [campo]: valor || null }
      : item))
  }

  const montoTotal = itemsSeleccionados.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (guardando) return
    if (cargandoFinanciera || !financieraCargada) {
      await dialogAlert({
        title: 'Configuración financiera pendiente',
        description: 'Espera a que se sincronice la configuración financiera de la clínica antes de crear el presupuesto.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }
    if (!pacienteId) {
      await dialogAlert({
        title: 'Paciente requerido',
        description: 'Por favor selecciona un paciente.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }
    if (itemsSeleccionados.length === 0 || itemsSeleccionados.some((item) => !Number.isFinite(Number(item.valor)) || Number(item.valor) < 0)) {
      await dialogAlert({
        title: 'Prestaciones requeridas',
      description: 'Agrega prestaciones o productos de inventario y revisa sus precios antes de guardar.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }
    if (itemsSeleccionados.some(item => item.esLaboratorio === true &&
      !catalogoLaboratorio.tiposTrabajo.some(tipo => tipo.id === item.tipoTrabajoLaboratorioId))) {
      await dialogAlert({
        title: 'Tipo de laboratorio requerido',
        description: 'Selecciona un tipo de trabajo activo para cada ítem marcado como laboratorio.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    const pac = pacientes.find((p) => String(p.id) === String(pacienteId))
    if (!pac) return

    const nuevoPresupuesto: PresupuestoLocal = {
      id: crypto.randomUUID(),
      folio: generarFolioPresupuesto(),
      pacienteId: pac?.id,
      pacienteNombre: pac?.nombre || 'Paciente',
      pacienteRut: pac?.rut || 'N/I',
      fechaEmision: obtenerFechaLocalISO(),
      vigenciaDias: financiera.validezPresupuestoDias,
      convenio,
      moneda,
      montoTotal,
      montoAbonado: 0,
      estado: 'borrador',
      fechaVencimiento: new Date(Date.now() + financiera.validezPresupuestoDias * 86400000).toISOString(),
      version: 1,
      items: itemsSeleccionados,
      observacion
    }

    setGuardando(true)
    let guardado = false
    try {
      guardado = await alGuardar(nuevoPresupuesto)
    } catch {
      guardado = false
    } finally {
      setGuardando(false)
    }
    if (!guardado) {
      await dialogAlert({
        title: 'No se pudo guardar',
        description: 'Revisa la clínica activa y el paciente antes de intentar de nuevo.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    await dialogAlert({
      title: 'Borrador guardado',
      description: `Presupuesto ${nuevoPresupuesto.folio} guardado como borrador para ${pac?.nombre || 'paciente'}. Si estás sin conexión, quedará pendiente de sincronización.`,
      variant: 'success',
      confirmText: 'Entendido'
    })

    alCerrar()
  }

  return (
    <Modal
      isOpen={true}
      onClose={alCerrar}
      title="Nuevo borrador de presupuesto"
      size="lg"
    >
      <p className="text-[11px] text-graphite-500 dark:text-graphite-400 mb-4">
        Selecciona prestaciones del arancel o productos de venta del inventario de esta clínica. La aprobación de un presupuesto con productos solicita ubicación y stock.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <CamposFormularioPresupuesto
          pacientes={pacientes}
          prestaciones={prestaciones}
          convenios={convenios}
          pacienteId={pacienteId}
          convenio={convenio}
          hallazgosOdontograma={hallazgosOdontograma}
          piezaDental={piezaDental}
          prestacionSelId={prestacionSelId}
          itemsSeleccionados={itemsSeleccionados}
          montoTotal={montoTotal}
          moneda={moneda}
          observacion={observacion}
          setPacienteId={setPacienteId}
          setConvenio={setConvenio}
          setPiezaDental={setPiezaDental}
          setPrestacionSelId={setPrestacionSelId}
          setObservacion={setObservacion}
          handleImportarHallazgo={handleImportarHallazgo}
          handleAgregarItem={handleAgregarItem}
          productosInventario={productosInventario}
          cargandoProductosInventario={cargandoProductosInventario}
          errorCatalogoInventario={errorCatalogoInventario}
          handleAgregarProducto={handleAgregarProducto}
          laboratoriosLaboratorio={catalogoLaboratorio.laboratorios}
          tiposTrabajoLaboratorio={catalogoLaboratorio.tiposTrabajo}
          cargandoCatalogoLaboratorio={cargandoCatalogoLaboratorio}
          errorCatalogoLaboratorio={errorCatalogoLaboratorio}
          onCambiarClasificacionLaboratorio={cambiarClasificacionLaboratorio}
          onCambiarCampoLaboratorio={cambiarCampoLaboratorio}
          handleEliminarItem={handleEliminarItem}
        />

        {/* Botones */}
        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={alCerrar} variant="ghost" fullWidth>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" fullWidth disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar borrador'}
          </Button>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevoPresupuesto.displayName = 'ModalNuevoPresupuesto'
