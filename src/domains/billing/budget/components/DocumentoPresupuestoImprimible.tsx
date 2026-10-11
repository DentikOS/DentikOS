import React, { memo, useEffect, useState } from 'react'
import { DienteSVG, type EstadosPiezaDental } from '../../../../shared/ui/DienteSVG'
import { odontogramaStorageService } from '../../../clinical/odontogram'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { Printer } from 'lucide-react'
import type { PresupuestoLocal } from '../services/presupuestosStorageService'

const log = createLogger('DocumentoPresupuestoImprimible')

const PERMANENTE_SUPERIOR = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8']
const PERMANENTE_INFERIOR = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8']

export interface UserProfilePresupuesto {
  nombreCompleto?: string; especialidad?: string; rut?: string; [key: string]: unknown
}

export interface DocumentoPresupuestoImprimibleProps {
  presupuesto: PresupuestoLocal | null
  userProfile?: UserProfilePresupuesto | null
  onCambiarEstado?: (nuevoEstado: string) => void
  onRegistrarPago?: () => void
  alCerrar: () => void
}

export const DocumentoPresupuestoImprimible: React.FC<DocumentoPresupuestoImprimibleProps> = memo(({
  presupuesto,
  userProfile,
  onCambiarEstado,
  onRegistrarPago,
  alCerrar
}) => {
  const [odontogramaInicial, setOdontogramaInicial] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (presupuesto?.pacienteId) {
      try {
        const odonto = odontogramaStorageService.obtenerOdontograma(
          `odonto_inicial_${presupuesto.pacienteId}`,
          {}
        )
        if (odonto && typeof odonto === 'object') {
          setOdontogramaInicial(odonto as Record<string, unknown>)
        } else {
          setOdontogramaInicial({})
        }
      } catch (e) {
        log.error('Error cargando odontograma para impresión:', e)
        setOdontogramaInicial({})
      }
    }
  }, [presupuesto])

  if (!presupuesto) return null

  const saldoPendiente =
    (parseFloat(String(presupuesto.montoTotal ?? 0)) || 0) -
    (parseFloat(String(presupuesto.montoAbonado ?? 0)) || 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center print:hidden bg-gray-50 dark:bg-graphite-900 p-4 border border-graphite-200 dark:border-graphite-800 rounded-2xl flex-wrap gap-2">
        <button
          onClick={alCerrar}
          className="text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-black bg-white dark:bg-graphite-800 px-3 py-2 rounded-xl border border-gray-300 dark:border-graphite-700 cursor-pointer"
        >
          ← Volver al Panel
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {presupuesto.estado === 'borrador' && (
            <button
              onClick={() => onCambiarEstado?.('enviado')}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Enviar al paciente
            </button>
          )}
          {presupuesto.estado === 'enviado' && (
            <>
              <button
                onClick={() => onCambiarEstado?.('aprobado')}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Aprobar verbal
              </button>
              <button
                onClick={() => onCambiarEstado?.('rechazado')}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Rechazar
              </button>
            </>
          )}
          {(presupuesto.estado === 'aprobado' || presupuesto.estado === 'en-curso') && saldoPendiente > 0 && (
            <button
              onClick={onRegistrarPago}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Registrar pago
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="bg-black text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors shadow-xs cursor-pointer flex items-center gap-1"
          >
            <Printer size={14} /> Imprimir (Letter)
          </button>
        </div>
      </div>

      {/* Hoja de Impresión Letter */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 print:border-none print:p-0 max-w-4xl mx-auto space-y-6">
        {/* Cabecera */}
        <div className="border-b-2 border-black pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {userProfile?.nombreCompleto || 'Dr. Miguel Díaz Rodríguez'}
            </h1>
            <p className="text-xs text-gray-600">
              {userProfile?.especialidad || 'Cirujano Dentista'} | RUT:{' '}
              {userProfile?.rut || 'N/I'}
            </p>
            <p className="text-xs text-gray-500">Consulta Odontológica DentikOS</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-gray-800 uppercase">Cotización de Presupuesto</h2>
            <p className="text-xs font-bold text-blue-800">Folio: {presupuesto.folio}</p>
            <p className="text-xs text-gray-500">Fecha Emisión: {presupuesto.fechaEmision}</p>
          </div>
        </div>

        {/* Datos Paciente */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs grid grid-cols-2 gap-2 print:bg-white print:border">
          <p>
            <span className="font-bold">Paciente:</span> {presupuesto.pacienteNombre}
          </p>
          <p>
            <span className="font-bold">RUT:</span> {presupuesto.pacienteRut}
          </p>
          <p>
            <span className="font-bold">Convenio / Previsión:</span> {presupuesto.convenio}
          </p>
          <p>
            <span className="font-bold">Vigencia:</span> {Number(presupuesto.vigenciaDias) || 30} días
          </p>
        </div>

        {/* Odontograma Integrado en Impresión */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 print:bg-white print:border">
          <h4 className="text-[10px] font-bold text-gray-600 uppercase mb-2 text-center">
            Estado de Dentición Registrado (Odontograma Clínico)
          </h4>
          <div className="flex flex-col gap-1 items-center scale-90 sm:scale-100 origin-center">
            <div className="flex gap-0.5 justify-center">
              {PERMANENTE_SUPERIOR.map((num) => (
                <DienteSVG
                  key={num}
                  numero={num}
                  estadosPieza={odontogramaInicial[num] as EstadosPiezaDental | null | undefined}
                />
              ))}
            </div>
            <div className="border-t border-gray-200 w-full my-1"></div>
            <div className="flex gap-0.5 justify-center">
              {PERMANENTE_INFERIOR.map((num) => (
                <DienteSVG
                  key={num}
                  numero={num}
                  estadosPieza={odontogramaInicial[num] as EstadosPiezaDental | null | undefined}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tabla de Prestaciones Cotizadas */}
        <div>
          <table className="w-full text-left text-xs mb-6 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-100 text-gray-800 print:bg-gray-50">
                <th className="p-3">Pieza</th>
                <th className="p-3">Tratamiento / Prestación</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(presupuesto.items || []).map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="p-3 font-bold text-gray-900">{item.pieza ? String(item.pieza) : 'General'}</td>
                  <td className="p-3 text-gray-700">{item.prestacion}</td>
                  <td className="p-3 text-center font-semibold text-gray-600">
                    {item.estado || 'Cotizado'}
                  </td>
                  <td className="p-3 text-right font-bold text-gray-900">
                    ${(parseFloat(String(item.valor ?? 0)) || 0).toLocaleString('es-CL')} CLP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Desglose de Totales */}
          <div className="border-t-2 border-black pt-4 space-y-1 text-right text-xs">
            <p>
              <span className="text-gray-600">Total Cotizado:</span>{' '}
              <span className="font-bold">
                ${(parseFloat(String(presupuesto.montoTotal ?? 0)) || 0).toLocaleString('es-CL')} CLP
              </span>
            </p>
            <p>
              <span className="text-green-700">Abonos Registrados:</span>{' '}
              <span className="font-bold text-green-700">
                -${(parseFloat(String(presupuesto.montoAbonado ?? 0)) || 0).toLocaleString('es-CL')} CLP
              </span>
            </p>
            <p className="text-sm pt-2">
              <span className="font-bold text-gray-900">Saldo Pendiente:</span>{' '}
              <span className="font-extrabold text-red-600">
                ${saldoPendiente.toLocaleString('es-CL')} CLP
              </span>
            </p>
          </div>

          {presupuesto.observacion && (
            <div className="mt-6 p-3 bg-gray-50 border rounded-xl text-xs text-gray-600 print:bg-white print:border">
              <strong>Notas / Condiciones:</strong> {presupuesto.observacion}
            </div>
          )}

          {/* Pie de Firma */}
          <div className="hidden print:block mt-16 pt-8 border-t border-gray-300 text-center">
            <div className="w-64 mx-auto border-t border-black pt-2">
              <p className="font-bold text-xs">
                {userProfile?.nombreCompleto || 'Dr. Miguel Díaz Rodríguez'}
              </p>
              <p className="text-[10px] text-gray-600">
                {userProfile?.especialidad || 'Cirujano Dentista'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

DocumentoPresupuestoImprimible.displayName = 'DocumentoPresupuestoImprimible'
