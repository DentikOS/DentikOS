import React, { memo, useState } from 'react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'

export interface ReajusteMasivoModalProps {
  alAplicarReajuste: (porcentaje: number | string) => Promise<void>
  alCerrar: () => void
}

export const ReajusteMasivoModal: React.FC<ReajusteMasivoModalProps> = memo(({
  alAplicarReajuste,
  alCerrar
}) => {
  const [porcentaje, setPorcentaje] = useState<string>('5')
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState('')
  const { confirm, alert: dialogAlert } = useAppDialog()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (aplicando) return
    const pct = porcentaje.trim() ? Number(porcentaje) : NaN
    if (!Number.isFinite(pct) || pct < -100 || pct > 10000) {
      setError('El porcentaje debe estar entre -100% y 10000%.')
      return
    }
    setError('')
    setAplicando(true)
    try {
      const confirmado = await confirm({
        title: 'Reajustar arancel',
        description: `¿Estás seguro de reajustar todo el arancel en un ${pct}%? Esta acción actualizará los precios particulares y de convenio.`,
        variant: 'warning',
        confirmText: 'Reajustar'
      })
      if (!confirmado) return

      try {
        await alAplicarReajuste(pct)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo aplicar el reajuste.')
        return
      }
      try {
        await dialogAlert({
          title: 'Arancel reajustado',
          description: `Arancel reajustado exitosamente en un ${pct}%.`,
          variant: 'success',
          confirmText: 'Entendido'
        })
      } catch {
        // La actualización ya fue confirmada por Supabase; el diálogo es solo informativo.
      }
      alCerrar()
    } catch {
      setError('No se pudo confirmar el reajuste. Vuelve a intentarlo.')
    } finally {
      setAplicando(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={() => { if (!aplicando) alCerrar() }} title="Reajuste Masivo de Arancel" size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-gray-600 dark:text-graphite-400 text-[11px] leading-relaxed">
          Aplica un incremento o descuento porcentual global a todos los ítems del arancel de la
          clínica (Ej: IPC anual del 4.5%).
        </p>

        <Input
          label="Porcentaje de Reajuste (%)"
          type="number"
          step="0.1"
          min="-100"
          max="10000"
          required
          disabled={aplicando}
          value={porcentaje}
          onChange={(e) => { setPorcentaje(e.target.value); setError('') }}
        />
        {error && <p role="alert" className="text-xs text-clinical-error">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={alCerrar} variant="ghost" fullWidth disabled={aplicando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={aplicando}>
            {aplicando ? 'Aplicando…' : 'Aplicar Reajuste'}
          </Button>
        </div>
      </form>
    </Modal>
  )
})

ReajusteMasivoModal.displayName = 'ReajusteMasivoModal'
