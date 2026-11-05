import React, { useState } from 'react'
import { Percent, Check, AlertCircle } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import type { DescuentoPresupuesto } from '../../schemas/presupuestoSchema'

export const CONVENIOS_SALUD = [
  // Convenios y porcentajes se administran por clínica; este formulario no tiene categoría.
]

interface DescuentosPresupuestoProps {
  totalBruto: number
  onAplicarDescuento: (descuento: DescuentoPresupuesto, montoDescontado: number) => void
}

export const DescuentosPresupuesto: React.FC<DescuentosPresupuestoProps> = ({
  totalBruto,
  onAplicarDescuento,
}) => {
  const [tipo, setTipo] = useState<'convenio' | 'global' | 'por-item'>('convenio')
  const [porcentajeGlobal, setPorcentajeGlobal] = useState<number>(10)
  const [montoFijo, setMontoFijo] = useState<number>(20000)
  const [motivo, setMotivo] = useState('')
  const [autorizadoPor, setAutorizadoPor] = useState('')
  const [errorValidacion, setErrorValidacion] = useState('')

  const calcularMontoDescuento = () => {
    if (tipo === 'convenio') {
      return 0
    }
    if (tipo === 'global') {
      return Math.round((totalBruto * porcentajeGlobal) / 100)
    }
    return Math.min(totalBruto, montoFijo)
  }

  const handleAplicar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivo.trim()) {
      setErrorValidacion('El motivo del descuento es obligatorio según política de auditoría.')
      return
    }
    if (!autorizadoPor.trim()) {
      setErrorValidacion('Debe ingresar quién autoriza el descuento.')
      return
    }
    if (tipo === 'convenio') {
      setErrorValidacion('El descuento de convenio requiere la categoría de cada prestación. Aplícalo desde el plan clínico.')
      return
    }

    setErrorValidacion('')
    const monto = calcularMontoDescuento()

    onAplicarDescuento(
      {
        tipo,
        valor: tipo === 'global' ? porcentajeGlobal : montoFijo,
        motivo,
        autorizadoPor,
      },
      monto
    )
  }

  const montoCalculado = calcularMontoDescuento()

  return (
    <form
      onSubmit={handleAplicar}
      className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs"
      data-testid="descuentos-presupuesto-modulo"
    >
      <div className="flex items-center justify-between pb-2 border-b border-surface">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
            Descuentos Clínicos & Convenios ISAPRE / FONASA
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-primary">
          Ahorro estimado: ${montoCalculado.toLocaleString('es-CL')}
        </span>
      </div>

      {errorValidacion && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorValidacion}</span>
        </div>
      )}

      {/* Selector de Tipo de Descuento */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <button
          type="button"
          onClick={() => setTipo('convenio')}
          className={`p-2.5 rounded-xl border font-semibold transition-all ${
            tipo === 'convenio'
              ? 'bg-primary/10 border-primary text-primary'
              : 'bg-surface border-surface text-graphite-600'
          }`}
        >
          Convenio Salud
        </button>
        <button
          type="button"
          onClick={() => setTipo('global')}
          className={`p-2.5 rounded-xl border font-semibold transition-all ${
            tipo === 'global'
              ? 'bg-primary/10 border-primary text-primary'
              : 'bg-surface border-surface text-graphite-600'
          }`}
        >
          Porcentaje (%)
        </button>
        <button
          type="button"
          onClick={() => setTipo('por-item')}
          className={`p-2.5 rounded-xl border font-semibold transition-all ${
            tipo === 'por-item'
              ? 'bg-primary/10 border-primary text-primary'
              : 'bg-surface border-surface text-graphite-600'
          }`}
        >
          Monto Fijo ($)
        </button>
      </div>

      {/* Parámetros según Tipo */}
      {tipo === 'convenio' && (
        <p className="rounded-xl border border-surface bg-surface p-3 text-xs text-graphite-600 dark:text-graphite-300">
          El porcentaje depende de la categoría de cada prestación y se configura por clínica. Este formulario no tiene ese detalle; aplica el convenio al cotizar desde el plan clínico.
        </p>
      )}

      {tipo === 'global' && (
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300">
            Porcentaje de Descuento (%)
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={porcentajeGlobal}
            onChange={(e) => setPorcentajeGlobal(Number(e.target.value))}
            className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs font-bold font-mono"
          />
        </div>
      )}

      {tipo === 'por-item' && (
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300">
            Monto Fijo en Pesos ($ CLP)
          </label>
          <input
            type="number"
            min="1000"
            step="1000"
            value={montoFijo}
            onChange={(e) => setMontoFijo(Number(e.target.value))}
            className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs font-bold font-mono"
          />
        </div>
      )}

      {/* Motivo y Autorización (Obligatorios) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
            Motivo del Descuento *
          </label>
          <input
            type="text"
            placeholder="Ej: Plan familiar / Convenio empresa / Fidelización"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
            Autorizado Por *
          </label>
          <input
            type="text"
            placeholder="Director Médico / Gerencia"
            value={autorizadoPor}
            onChange={(e) => setAutorizadoPor(e.target.value)}
            className="w-full p-2 bg-surface border border-surface rounded-xl text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button type="submit" variant="primary" size="sm" icon={Check}>
          Aplicar Descuento (${montoCalculado.toLocaleString('es-CL')})
        </Button>
      </div>
    </form>
  )
}
