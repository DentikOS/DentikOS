import React, { memo, useState } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { diasRestantes, obtenerPagosPurgados, vaciarPapelera } from '../services/papeleraPagosService'
import { Trash2 } from 'lucide-react'
import type { Pago } from '../services/pagosStorageService'
import { formatearImporteDocumento, resolverMonedaDocumento } from '../../../../shared/utils/formatoDocumento'

export interface ModalPapeleraPagosProps {
  alCerrar: () => void
  onRestaurar: (pagoId: string | number) => Promise<unknown>
  onAccionCompletada?: () => void
}

/**
 * Modal de Papelera de Pagos (Commit K)
 *
 * Commit K6: el modal es dueño TOTAL del flujo de vaciar (confirm +
 * vaciar + reload + alert). Garantiza secuencia atómica sin timing
 * conflicts con el padre.
 */
export const ModalPapeleraPagos: React.FC<ModalPapeleraPagosProps> = memo(({
  alCerrar,
  onRestaurar,
  onAccionCompletada
}) => {
  const { confirm, alert } = useAppDialog()
  const [pagos, setPagos] = useState<Pago[]>(() => obtenerPagosPurgados())

  const reload = (): void => setPagos(obtenerPagosPurgados())

  const handleRestaurar = async (pagoId: string | number): Promise<void> => {
    try {
      await onRestaurar(pagoId)
    } finally {
      // Defensivo (Commit K10): recargar SIEMPRE, aunque el padre falle,
      // para que el modal nunca quede con lista stale
      reload()
      if (onAccionCompletada) onAccionCompletada()
    }
  }

  const handleVaciar = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Vaciar papelera',
      description: `Esto eliminará definitivamente los ${pagos.length} pagos de la papelera. Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmText: 'Vaciar papelera'
    })
    if (!ok) return

    const eliminados = await vaciarPapelera()
    reload()
    if (onAccionCompletada) onAccionCompletada()

    if (eliminados > 0) {
      await alert({
        title: 'Papelera vaciada',
        description: `Se eliminaron ${eliminados} pagos definitivamente.`,
        variant: 'success',
        confirmText: 'Entendido'
      })
      reload()
    }
  }

  return (
    <Modal isOpen={true} onClose={alCerrar} title="Papelera de Pagos" size="lg">
      <div className="space-y-3">
        <div className="flex justify-between items-start gap-3">
          <p className="text-xs text-gray-600 dark:text-graphite-400 flex-1">
            Pagos purgados. Pueden restaurarse (volver a estado "Anulado") o serán eliminados
            automáticamente después de 730 días.
          </p>
          {pagos.length > 0 && (
            <Button
              onClick={handleVaciar}
              variant="danger"
              size="sm"
              className="shrink-0"
            >
              <span className="inline-flex items-center gap-1">
                <Trash2 size={12} />Vaciar papelera
              </span>
            </Button>
          )}
        </div>

        {pagos.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-graphite-500">
            <p className="text-sm">No hay pagos en la papelera</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pagos.map((pago) => {
              const dias = diasRestantes(pago.fechaPurga)
              return (
                <div
                  key={String(pago.id)}
                  className="bg-gray-50 dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-xl p-3 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900 dark:text-graphite-50">
                          {pago.folioComprobante}
                        </span>
                        <span className="text-xs bg-gray-200 dark:bg-graphite-700 text-gray-700 dark:text-graphite-300 px-2 py-0.5 rounded-full">
                          {dias !== null
                            ? `${dias} días restantes`
                            : 'Sin fecha registrada (no se auto-elimina)'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-graphite-300 font-semibold">
                        {pago.pacienteNombre || 'Paciente sin nombre'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-graphite-400">
                        <span className="font-bold">
                          {formatearImporteDocumento(pago.monto, resolverMonedaDocumento(pago.moneda))}
                        </span>{' '}
                        · {pago.metodoPago}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-graphite-400 mt-1">
                        Purgado: {pago.fechaPurga || 'sin fecha'} por{' '}
                        {pago.purgadoPor || 'sin registro'}
                      </p>
                      {pago.motivoPurga && (
                        <p className="text-xs text-gray-600 dark:text-graphite-400 mt-1 italic">
                          Motivo: &quot;{pago.motivoPurga}&quot;
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => handleRestaurar(pago.id)}
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:bg-blue-50 transition-colors duration-150 cursor-pointer"
                    >
                      Restaurar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t">
          <Button onClick={alCerrar} variant="ghost">
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  )
})

ModalPapeleraPagos.displayName = 'ModalPapeleraPagos'
