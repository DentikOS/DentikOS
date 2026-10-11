import React from 'react'
import { X, Download, Printer, ShieldCheck, FileText, ExternalLink } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'

interface VisorPDFProps {
  titulo: string
  url?: string
  contenidoTexto?: string
  fecha?: string
  profesional?: string
  pacienteNombre?: string
  hashForense?: string
  onCerrar: () => void
  onDescargar?: () => void
}

export const VisorPDF: React.FC<VisorPDFProps> = ({
  titulo,
  url,
  contenidoTexto,
  fecha = new Date().toLocaleDateString('es-CL'),
  profesional = 'Dr. Miguel Díaz Rodríguez',
  pacienteNombre = 'Paciente',
  hashForense,
  onCerrar,
  onDescargar,
}) => {
  const handleImprimir = () => {
    window.print()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      data-testid="visor-pdf-modal"
    >
      <div className="bg-white dark:bg-graphite-900 border border-graphite-200 dark:border-graphite-800 rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Barra superior de herramientas */}
        <div className="p-4 border-b border-graphite-200 dark:border-graphite-800 bg-graphite-50 dark:bg-graphite-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50 truncate">
                {titulo}
              </h3>
              <p className="text-[11px] text-graphite-500 truncate">
                Paciente: {pacienteNombre} &bull; Emisión: {fecha} &bull; Profesional: {profesional}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onDescargar && (
              <Button type="button" size="sm" variant="secondary" icon={Download} onClick={onDescargar}>
                Descargar
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" icon={Printer} onClick={handleImprimir}>
              Imprimir
            </Button>
            <button
              type="button"
              onClick={onCerrar}
              className="p-1.5 rounded-lg hover:bg-graphite-200 dark:hover:bg-graphite-800 text-graphite-500 transition-colors cursor-pointer"
              aria-label="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panel de Hash Forense SHA-256 */}
        {hashForense && (
          <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" /> Integridad Forense Certificada (Ley 20.584)
            </span>
            <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
              {hashForense}
            </span>
          </div>
        )}

        {/* Contenido / Iframe Embebido (STOP Condition 5: sin librería pesada) */}
        <div className="flex-1 bg-graphite-100 dark:bg-graphite-950 p-4 overflow-y-auto">
          {url ? (
            <iframe
              src={url}
              title={titulo}
              className="w-full h-full rounded-xl border border-graphite-200 dark:border-graphite-800 bg-white"
            />
          ) : (
            <div className="max-w-2xl mx-auto bg-white dark:bg-graphite-900 p-8 rounded-2xl shadow-sm border border-graphite-200 dark:border-graphite-800 space-y-6 text-graphite-800 dark:text-graphite-100">
              <div className="text-center border-b pb-4 border-graphite-200 dark:border-graphite-800">
                <h2 className="text-lg font-black tracking-tight text-primary">STUDIO DENTAL</h2>
                <p className="text-xs text-graphite-500">Documento Oficial Clínico Electrónico</p>
                <p className="text-xs font-semibold mt-1">{titulo}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-graphite-50 dark:bg-graphite-800/50 p-4 rounded-xl">
                <div>
                  <span className="text-graphite-400 block text-[10px] uppercase font-bold">Paciente</span>
                  <span className="font-bold">{pacienteNombre}</span>
                </div>
                <div>
                  <span className="text-graphite-400 block text-[10px] uppercase font-bold">Fecha Emisión</span>
                  <span className="font-bold">{fecha}</span>
                </div>
                <div>
                  <span className="text-graphite-400 block text-[10px] uppercase font-bold">Profesional Tratante</span>
                  <span className="font-bold">{profesional}</span>
                </div>
                <div>
                  <span className="text-graphite-400 block text-[10px] uppercase font-bold">Estado</span>
                  <span className="text-emerald-600 font-bold">Emitido & Firmado Digitalmente</span>
                </div>
              </div>

              <div className="space-y-2 text-xs leading-relaxed">
                <h4 className="font-bold text-graphite-700 dark:text-graphite-300">Detalle del Documento:</h4>
                <div className="p-4 bg-graphite-50 dark:bg-graphite-800/30 rounded-xl whitespace-pre-wrap font-sans border border-graphite-200 dark:border-graphite-800">
                  {contenidoTexto || 'Documento clínico emitido conforme a la ley chilena 20.584 sobre derechos y deberes del paciente.'}
                </div>
              </div>

              {hashForense && (
                <div className="pt-4 border-t border-graphite-200 dark:border-graphite-800 text-[11px] text-graphite-500">
                  Firma Electrónica Avanzada: <span className="font-mono text-primary font-bold">{hashForense}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
