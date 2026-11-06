import React, { memo, useState, useEffect, useRef } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import {
  METODOS_PAGO_GOLD,
  TIPOS_DOCUMENTO_TRIBUTARIO,
  CONCEPTOS_PAGO
} from '../constants/pagosConstants'
import { generarFolioRecibo } from '../utils/pagosCalculations'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { usePrestacionesPaciente } from '../hooks/usePrestacionesPaciente'
import { SelectorPrestacionesImputadas } from './SelectorPrestacionesImputadas'
import type { Pago } from '../services/pagosStorageService'
import { clinicStorageService } from '../../../organization/clinic/services/clinicStorageService'
import { formatearImporteDocumento, resolverMonedaDocumento } from '../../../../shared/utils/formatoDocumento'

export interface PacienteRefPago {
  id: string | number
  nombre?: string
  rut?: string
  [key: string]: unknown
}

export interface UserProfileRefPago {
  nombreCompleto?: string
  [key: string]: unknown
}

export interface ModalNuevoPagoProps {
  pagoEditar?: Pago | null
  pacientes?: PacienteRefPago[]
  userProfile?: UserProfileRefPago | null
  alGuardar: (pago: Pago) => void | boolean | Promise<void | boolean>
  alCerrar: () => void
}

interface IdentidadPagoPendiente {
  huella: string
  id: string
  folio: string
  fecha: string
  hora: string
}

const crearIdPago = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const ModalNuevoPago: React.FC<ModalNuevoPagoProps> = memo(({
  pagoEditar,
  pacientes = [],
  userProfile,
  alGuardar,
  alCerrar
}) => {
  const moneda = resolverMonedaDocumento(pagoEditar?.moneda || clinicStorageService.obtenerClinica()?.moneda)
  const [pacienteId, setPacienteId] = useState<string>('')
  const { alert: dialogAlert } = useAppDialog()
  const [monto, setMonto] = useState<string>('')
  const [metodoPago, setMetodoPago] = useState<string>(METODOS_PAGO_GOLD[0].id)
  const [tipoDTE, setTipoDTE] = useState<string>(TIPOS_DOCUMENTO_TRIBUTARIO[0].id)
  const [folioDTE, setFolioDTE] = useState<string>('')
  const [concepto, setConcepto] = useState<string>(CONCEPTOS_PAGO[0])
  const [observacion, setObservacion] = useState<string>('')
  const identidadPendiente = useRef<IdentidadPagoPendiente | null>(null)

  const {
    prestacionesPaciente,
    prestacionesSeleccionadas,
    handleTogglePrestacion
  } = usePrestacionesPaciente(pacienteId, pagoEditar)

  // Carga inicial en modo edición
  useEffect(() => {
    if (pagoEditar) {
      setPacienteId(pagoEditar.pacienteId != null ? String(pagoEditar.pacienteId) : '')
      setMonto(pagoEditar.monto != null ? String(pagoEditar.monto) : '')
      setMetodoPago(pagoEditar.metodoPago || METODOS_PAGO_GOLD[0].id)
      setTipoDTE(pagoEditar.tipoDTE || TIPOS_DOCUMENTO_TRIBUTARIO[0].id)
      setFolioDTE(pagoEditar.folioDTE || '')
      setConcepto(pagoEditar.concepto || CONCEPTOS_PAGO[0])
      setObservacion(pagoEditar.observacion || '')
    }
  }, [pagoEditar])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const montoLimpio = parseFloat(String(monto).replace(/[^0-9]/g, '')) || 0

    if (!pacienteId || montoLimpio <= 0) {
      await dialogAlert({
        title: 'Datos incompletos',
        description: 'Selecciona un paciente e ingresa un monto mayor a $0.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    const pac = pacientes.find((p) => String(p.id) === String(pacienteId))

    const huellaPago = JSON.stringify({
      pacienteId: pac?.id ?? pacienteId,
      monto: montoLimpio,
      moneda: pagoEditar?.moneda || clinicStorageService.obtenerClinica()?.moneda || 'CLP',
      metodoPago,
      tipoDTE,
      folioDTE: folioDTE.trim(),
      concepto,
      observacion: observacion.trim(),
      prestacionesImputadas: prestacionesSeleccionadas
    })
    if (!pagoEditar && identidadPendiente.current?.huella !== huellaPago) {
      const ahora = new Date()
      identidadPendiente.current = {
        huella: huellaPago,
        id: crearIdPago(),
        folio: generarFolioRecibo(),
        fecha: ahora.toLocaleDateString('es-CL'),
        hora: ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      }
    }
    const identidad = identidadPendiente.current

    const pagoFinal: Pago = {
      id: pagoEditar
        ? pagoEditar.id
        : identidad!.id,
      folioComprobante: pagoEditar ? pagoEditar.folioComprobante : identidad!.folio,
      tipoDTE,
      folioDTE: folioDTE.trim(),
      pacienteId: pac?.id,
      pacienteNombre: pac?.nombre || 'Paciente',
      pacienteRut: pac?.rut || 'N/I',
      fecha: pagoEditar ? pagoEditar.fecha : identidad!.fecha,
      hora: pagoEditar ? pagoEditar.hora : identidad!.hora,
      monto: montoLimpio,
      moneda: pagoEditar?.moneda || clinicStorageService.obtenerClinica()?.moneda || 'CLP',
      metodoPago,
      concepto,
      estado: pagoEditar ? pagoEditar.estado : 'Emitido',
      prestacionesImputadas: prestacionesSeleccionadas,
      emitidoPor: userProfile?.nombreCompleto || 'Cajero de Turno',
      observacion: observacion.trim()
    }

    const guardado = await alGuardar(pagoFinal)
    if (guardado === false) return

    await dialogAlert({
      title: pagoEditar ? 'Pago actualizado' : 'Pago registrado',
      description: `Comprobante ${pagoFinal.folioComprobante} ${
        pagoEditar ? 'actualizado' : 'registrado'
      } exitosamente por ${formatearImporteDocumento(montoLimpio, moneda)}.`,
      variant: 'success',
      confirmText: 'Entendido'
    })

    alCerrar()
  }

  return (
    <Modal
      isOpen={true}
      onClose={alCerrar}
      title={pagoEditar ? 'Editar Recibo / Transacción de Pago' : 'Registrar Cobro e Imputación de Pago'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Paciente *
          </label>
          <select
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-bold"
          >
            <option value="">-- Seleccionar paciente --</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.rut})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Monto a Cobrar (${moneda})`}
            type="text"
            required
            placeholder="Ej: 50000"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="font-black text-emerald-900 bg-emerald-50/50"
          />

          <div>
            <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
              Método de Pago
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-bold"
            >
              {METODOS_PAGO_GOLD.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
              Tipo de Documento Tributario
            </label>
            <select
              value={tipoDTE}
              onChange={(e) => setTipoDTE(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-semibold"
            >
              {TIPOS_DOCUMENTO_TRIBUTARIO.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Folio DTE / N° Bono"
            type="text"
            placeholder="Ej: BH-104 o I-MED-88"
            value={folioDTE}
            onChange={(e) => setFolioDTE(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Concepto de Pago
          </label>
          <select
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-medium"
          >
            {CONCEPTOS_PAGO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <SelectorPrestacionesImputadas
          prestaciones={prestacionesPaciente}
          seleccionadas={prestacionesSeleccionadas}
          onToggle={handleTogglePrestacion}
          moneda={moneda}
        />

        <Input
          label="Observaciones Internas / N° Operación"
          type="text"
          placeholder="Ej: N° Voucher Transbank 48512..."
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
        />

        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={alCerrar} variant="ghost" fullWidth>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" fullWidth>
            {pagoEditar ? 'Guardar Cambios' : 'Emitir Pago'}
          </Button>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevoPago.displayName = 'ModalNuevoPago'
