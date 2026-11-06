import React, { memo, useState } from 'react'
import { Printer, FileText } from 'lucide-react'
import { DentikOSMicroSeal } from '../../../../shared/ui/brand/DentikOSMicroSeal'
import { MembreteClinica } from '../../../organization/clinic/components/MembreteClinica'
import { useClinicaDocumento } from '../../../organization/clinic/hooks/useClinicaDocumento'
import type { Pago } from '../services/pagosStorageService'
import type { UserProfileRefPago } from './ModalNuevoPago'
import { formatearImporteDocumento, resolverIdiomaDocumento, resolverMonedaDocumento, traducirEtiquetaDocumento } from '../../../../shared/utils/formatoDocumento'

export interface ComprobantePagoImprimibleProps {
  pago: Pago | null
  userProfile?: UserProfileRefPago | null
  alCerrar: () => void
}

export const ComprobantePagoImprimible: React.FC<ComprobantePagoImprimibleProps> = memo(({
  pago,
  userProfile,
  alCerrar
}) => {
  const [formato, setFormato] = useState<'ticket' | 'carta'>('ticket')
  const clinicaDocumento = useClinicaDocumento()

  if (!pago) return null

  const montoVal = parseFloat(String(pago.monto ?? 0)) || 0
  const idioma = resolverIdiomaDocumento(clinicaDocumento.idiomaDocumentos)
  const moneda = resolverMonedaDocumento(pago.moneda)
  const etiqueta = (clave: Parameters<typeof traducirEtiquetaDocumento>[1]) => traducirEtiquetaDocumento(idioma, clave)

  return (
    <div className="space-y-4 text-xs">
      <div className="flex justify-between items-center no-print print:hidden bg-gray-50 p-4 border rounded-2xl flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-700">Formato de Impresión:</span>
          <button
            onClick={() => setFormato('ticket')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
              formato === 'ticket' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Printer size={12} />Ticket POS (80mm)
            </span>
          </button>
          <button
            onClick={() => setFormato('carta')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
              formato === 'carta' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <FileText size={12} />Carta Letter Oficial
            </span>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors duration-150 cursor-pointer"
          >
            <span className="inline-flex items-center gap-1">
              <Printer size={14} />Imprimir Comprobante
            </span>
          </button>
          <button
            onClick={alCerrar}
            className="bg-gray-200 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold hover:bg-gray-300 transition-colors duration-150 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* FORMATO TICKET TÉRMICO POS 80MM */}
      {formato === 'ticket' && (
        <div className="bg-white border-2 border-dashed border-black rounded-2xl p-6 w-[320px] mx-auto space-y-3 font-mono print:border-none print:w-full print:p-0 print:bg-white print:text-black">
          <div className="text-center border-b border-black pb-2">
            <h2 className="text-sm font-black uppercase">DENTIKOS</h2>
            <p className="text-[9px] font-bold uppercase">{etiqueta('paymentReceipt')}</p>
            <p className="text-[8px] text-gray-500">
              {clinicaDocumento.nombreClinica || userProfile?.nombreCompleto || 'Clínica Odontológica'}
            </p>
          </div>

          <div className="space-y-1 text-[10px] border-b border-black pb-2">
            <p>
              <strong>{etiqueta('receipt').toUpperCase()}:</strong> <span className="tabular-nums">{pago.folioComprobante}</span>
            </p>
            {pago.folioDTE && (
              <p>
                <strong>DTE / BONO:</strong> <span className="tabular-nums">{pago.folioDTE}</span>
              </p>
            )}
            <p>
              <strong>{etiqueta('date').toUpperCase()}:</strong>{' '}
              <span className="tabular-nums">
                {pago.fecha} {pago.hora}
              </span>{' '}
              hrs
            </p>
            <p>
              <strong>{etiqueta('patient').toUpperCase()}:</strong> {pago.pacienteNombre}
            </p>
            <p>
              <strong>RUT:</strong> <span className="tabular-nums">{pago.pacienteRut}</span>
            </p>
            <p>
              <strong>{etiqueta('method').toUpperCase()}:</strong> {pago.metodoPago}
            </p>
            <p>
              <strong>{etiqueta('concept').toUpperCase()}:</strong> {pago.concepto}
            </p>
          </div>

          {pago.prestacionesImputadas && pago.prestacionesImputadas.length > 0 && (
            <div className="border-b border-black pb-2 text-[9px]">
              <span className="font-bold block">{etiqueta('allocatedTo').toUpperCase()}:</span>
              <ul className="list-disc pl-3">
                {pago.prestacionesImputadas.map((it, idx) => (
                  <li key={idx}>{it}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-center py-2 bg-gray-100 border rounded-lg print:bg-white print:border-black">
            <span className="text-[9px] font-bold block uppercase">{etiqueta('totalPaid')}</span>
            <span className="text-xl font-black tabular-nums">
              {formatearImporteDocumento(montoVal, moneda, idioma)}
            </span>
          </div>

          <div className="pt-4 text-center text-[9px] space-y-1">
            <p className="font-bold">{etiqueta('thankYou')}</p>
            <p className="text-gray-500">{etiqueta('cashier')}: {pago.emitidoPor}</p>
            <p className="text-[8px] text-gray-400 pt-2 border-t border-gray-200 mt-2">
              DentikOS Clinical Gateway • Trazabilidad Ley 20.584
            </p>
          </div>
        </div>
      )}

      {/* FORMATO CARTA LETTER MEMBRETADA */}
      {formato === 'carta' && (
        <div className="bg-white border border-gray-300 rounded-2xl p-8 max-w-xl mx-auto space-y-6 text-gray-900 print:border-none print:max-w-none print:p-0 print:bg-white print:text-black">
          <div className="space-y-3">
            <MembreteClinica clinica={clinicaDocumento} />
            <div className="border-b border-gray-300 pb-4 flex justify-between items-start gap-4">
              <div>
                <h1 className="text-base font-black uppercase tracking-wider">
                  {etiqueta('paymentReceipt')}
                </h1>
                <p className="text-[10px] text-gray-600 font-bold">
                  {etiqueta('receivedBy')} {userProfile?.nombreCompleto || 'Equipo de recepción'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black bg-gray-100 px-3 py-1 rounded-lg border block tabular-nums">
                  {pago.folioComprobante}
                </span>
                <span className="text-[10px] text-gray-500 block mt-1 tabular-nums">
                  {pago.fecha} — {pago.hora} hrs
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 print:bg-white print:border">
            <div>
              <p>
                  <span className="font-bold">{etiqueta('patient')}:</span> {pago.pacienteNombre}
              </p>
              <p>
                <span className="font-bold">RUT:</span>{' '}
                <span className="tabular-nums">{pago.pacienteRut}</span>
              </p>
            </div>
            <div>
              <p>
                  <span className="font-bold">{etiqueta('method')}:</span> {pago.metodoPago}
              </p>
              <p>
                <span className="font-bold">DTE / Folio:</span>{' '}
                <span className="tabular-nums">{pago.folioDTE || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase border-b pb-1">{etiqueta('detailPayment')}</h4>
            <p>
              <span className="font-semibold text-gray-700">{etiqueta('concept')}:</span> {pago.concepto}
            </p>
            {pago.observacion && (
              <p>
                <span className="font-semibold text-gray-700">{etiqueta('observation')}:</span> {pago.observacion}
              </p>
            )}
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center print:bg-white print:border-black">
            <span className="font-extrabold text-emerald-900 uppercase print:text-black">
              {etiqueta('totalPaid')}:
            </span>
            <span className="text-2xl font-black text-emerald-900 tabular-nums print:text-black">
              {formatearImporteDocumento(montoVal, moneda, idioma)}
            </span>
          </div>

          <div className="pt-16 grid grid-cols-2 gap-8 text-center print:pt-24">
            <div className="border-t border-black pt-2">
              <p className="font-bold">{pago.pacienteNombre}</p>
              <p className="text-[10px] text-gray-500">{etiqueta('patientSignature')}</p>
            </div>

            <div className="border-t border-black pt-2">
              <p className="font-bold">{pago.emitidoPor}</p>
              <p className="text-[10px] text-gray-500">{etiqueta('cashSignature')}</p>
            </div>
          </div>

          {/* Micro-Sello DentikOS Normativo */}
          <DentikOSMicroSeal className="mt-8" />
        </div>
      )}
    </div>
  )
})

ComprobantePagoImprimible.displayName = 'ComprobantePagoImprimible'
