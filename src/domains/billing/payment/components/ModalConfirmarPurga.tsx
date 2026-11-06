import React, { memo, useState } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { Trash2, AlertTriangle } from 'lucide-react'
import type { Pago } from '../services/pagosStorageService'
import { formatearImporteDocumento, resolverMonedaDocumento } from '../../../../shared/utils/formatoDocumento'

export interface ModalConfirmarPurgaProps {
  pago: Pago | null
  onConfirmar: (motivo: string) => void
  alCerrar: () => void
}

/**
 * ModalConfirmarPurga — Confirmación con textarea obligatoria (Decisión 1C).
 *
 * Se usa para purgar pagos anulados: acción destructiva que requiere
 * auditoría trazable. El motivo es obligatorio (mínimo 10 caracteres).
 */
export const ModalConfirmarPurga: React.FC<ModalConfirmarPurgaProps> = memo(({
  pago,
  onConfirmar,
  alCerrar
}) => {
  const [motivo, setMotivo] = useState<string>('')
  const [error, setError] = useState<string>('')

  const motivoValido = motivo.trim().length >= 10

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (!motivoValido) {
      setError('El motivo debe tener al menos 10 caracteres.')
      return
    }
    onConfirmar(motivo.trim())
  }

  return (
    <Modal isOpen={true} onClose={alCerrar} title="Purgar pago definitivamente" size="md">
      <div className="space-y-4 text-xs">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="font-bold text-red-900 text-sm">
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={12} />Acción destructiva irreversible
            </span>
          </p>
          <p className="text-red-800 mt-1">
            Vas a eliminar permanentemente este pago del sistema. Solo debe usarse
            cuando el registro fue un error administrativo y no debe quedar traza contable.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-xl p-3 space-y-1">
          <p>
            <span className="font-bold text-gray-700 dark:text-graphite-300">Folio:</span>{' '}
            {pago?.folioComprobante}
          </p>
          <p>
            <span className="font-bold text-gray-700 dark:text-graphite-300">Paciente:</span>{' '}
            {pago?.pacienteNombre} ({pago?.pacienteRut})
          </p>
          <p>
            <span className="font-bold text-gray-700 dark:text-graphite-300">Monto:</span>{' '}
            {formatearImporteDocumento(Number(pago?.monto || 0), resolverMonedaDocumento(pago?.moneda))}
          </p>
          <p>
            <span className="font-bold text-gray-700 dark:text-graphite-300">Fecha:</span>{' '}
            {pago?.fecha}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
              Motivo de la purga *{' '}
              <span className="text-gray-400 dark:text-graphite-500">(mínimo 10 caracteres)</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value)
                setError('')
              }}
              placeholder="Ej: Pago duplicado por error del cajero, anulado previamente pero requiere purga definitiva..."
              className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 text-xs font-medium min-h-[80px] resize-none"
              autoFocus
            />
            {error && <p className="text-red-600 text-[10px] font-semibold mt-1">{error}</p>}
            <p className="text-gray-400 dark:text-graphite-500 text-[10px] mt-1">
              {motivo.trim().length}/10 caracteres mínimo
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={alCerrar} variant="ghost" fullWidth>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              fullWidth
              className="bg-red-700 hover:bg-red-800 font-extrabold transition-colors duration-150"
            >
              <span className="inline-flex items-center gap-1">
                <Trash2 size={12} />Purgar definitivamente
              </span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
})

ModalConfirmarPurga.displayName = 'ModalConfirmarPurga'
