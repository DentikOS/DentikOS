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

const log = createLogger('ModalNuevoPresupuesto')

export interface ModalNuevoPresupuestoProps {
  pacientes?: PacienteFormRef[]
  prestaciones?: PrestacionFormRef[]
  alGuardar: (nuevoPresupuesto: PresupuestoLocal) => boolean | Promise<boolean>
  alCerrar: () => void
}

export const ModalNuevoPresupuesto: React.FC<ModalNuevoPresupuestoProps> = memo(({
  pacientes = [],
  prestaciones = [],
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
  const [observacion, setObservacion] = useState<string>('')
  const [guardando, setGuardando] = useState(false)

  const [itemsSeleccionados, setItemsSeleccionados] = useState<ItemSeleccionadoPresupuesto[]>([])
  const [prestacionSelId, setPrestacionSelId] = useState<string>('')
  const [piezaDental, setPiezaDental] = useState<string>('')

  const [hallazgosOdontograma, setHallazgosOdontograma] = useState<HallazgoOdontograma[]>([])

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
    const precioFonasaOriginal = prest.precioFonasa
    const precioFonasaRaw = Number(precioFonasaOriginal)
    const precioFonasa = precioFonasaOriginal !== undefined && precioFonasaOriginal !== null && precioFonasaOriginal !== '' && Number.isFinite(precioFonasaRaw) && precioFonasaRaw >= 0
      ? Math.round(precioFonasaRaw)
      : undefined
    const sucursalId = sedeActivaId
    const esFonasaCatalogo = convenio === '__fonasa_catalogo__'
    const convenioConfigurado = convenios.find((item) => item.id === convenio)
    const precio = resolverPrecioPrestacion(
      configuracion,
      {
        prestacionId: prest.id,
        convenioIdentificador: convenio === 'Particular' || esFonasaCatalogo ? null : convenio,
        tipoConvenio: esFonasaCatalogo ? 'fonasa' : convenioConfigurado?.tipo,
        especialidad: typeof prest.especialidad === 'string' ? prest.especialidad : null,
        sucursalId,
        precioParticular: Number.isFinite(precioParticular) && precioParticular >= 0 ? Math.round(precioParticular) : 0,
        precioFonasa: typeof precioFonasa === 'number' && Number.isFinite(precioFonasa) && precioFonasa >= 0 ? Math.round(precioFonasa) : undefined,
      }
    )

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

  const handleEliminarItem = (itemId: string | number): void => {
    setItemsSeleccionados(itemsSeleccionados.filter((i) => i.id !== itemId))
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
        description: 'Agrega prestaciones configuradas y revisa sus precios antes de guardar.',
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
        Selecciona prestaciones del arancel configurado para esta clínica. Los hallazgos requieren revisión clínica.
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
          observacion={observacion}
          setPacienteId={setPacienteId}
          setConvenio={setConvenio}
          setPiezaDental={setPiezaDental}
          setPrestacionSelId={setPrestacionSelId}
          setObservacion={setObservacion}
          handleImportarHallazgo={handleImportarHallazgo}
          handleAgregarItem={handleAgregarItem}
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
