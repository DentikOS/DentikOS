import React from 'react'
import { CheckCircle2, Download, List, X } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'

interface ModalConfirmarDescargaPDFProps {
  isOpen: boolean
  titulo: string
  subtitulo?: string
  onDescargar: () => void
  onVerLista: () => void
  onCerrar: () => void
}

export const ModalConfirmarDescargaPDF: React.FC<ModalConfirmarDescargaPDFProps> = ({
  isOpen,
  titulo,
  subtitulo = '¿Deseas descargar el PDF ahora?',
  onDescargar,
  onVerLista,
  onCerrar,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" data-testid="modal-confirmar-descarga-pdf">
      <div className="bg-surface border border-surface rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">{titulo}</h3>
          <p className="text-xs text-graphite-500">{subtitulo}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full pt-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Download}
            onClick={onDescargar}
            data-testid="btn-descargar-pdf-confirmacion"
          >
            Descargar PDF
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={List}
            onClick={onVerLista}
            data-testid="btn-ver-en-lista-confirmacion"
          >
            Ver en lista
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={X}
            onClick={onCerrar}
            data-testid="btn-cerrar-confirmacion"
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
