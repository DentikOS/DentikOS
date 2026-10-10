import React, { useState, useMemo } from 'react'
import { X, Plus, Trash2, Layers, List, DollarSign } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { Input } from '../../../../../shared/ui/ui/Input'
import { usePresupuestosStore } from '../../../../../app/stores/presupuestosStore'
import type { Presupuesto, ItemPresupuesto } from '../../schemas/presupuestoSchema'

interface ModalNuevoPresupuestoProps {
  pacienteId?: string | number
  pacienteNombre?: string
  pacienteRut?: string
  onGuardar?: (presupuesto: Presupuesto) => void
  onCerrar: () => void
}

export const ModalNuevoPresupuesto: React.FC<ModalNuevoPresupuestoProps> = ({
  pacienteId = 'pac-1',
  pacienteNombre = 'Paciente de Prueba',
  pacienteRut = '12.345.678-9',
  onGuardar,
  onCerrar,
}) => {
  const [vista, setVista] = useState<'simplificada' | 'detallada'>('simplificada')
  const crearPresupuesto = usePresupuestosStore((s) => s.crearPresupuesto)

  const [items, setItems] = useState<ItemPresupuesto[]>([
    {
      id: 'it-1',
      codigoPrestacion: 'PREST-01',
      nombrePrestacion: 'Evaluación y Diagnóstico Integral',
      cantidad: 1,
      precioUnitario: 35000,
      descuento: 0,
      subtotal: 35000,
      faseClinica: 'urgencias',
    },
    {
      id: 'it-2',
      codigoPrestacion: 'PREST-02',
      nombrePrestacion: 'Destartraje y Profilaxis Bimaxilar',
      cantidad: 1,
      precioUnitario: 45000,
      descuento: 0,
      subtotal: 45000,
      faseClinica: 'estabilizacion',
    },
  ])

  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState<number>(0)

  const handleAgregarItem = (fase: ItemPresupuesto['faseClinica'] = 'estabilizacion') => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nombrePrestacion: 'Nueva Prestación Clínica',
        cantidad: 1,
        precioUnitario: 30000,
        descuento: 0,
        subtotal: 30000,
        faseClinica: fase,
      },
    ])
  }

  const handleEliminarItem = (id: string | number) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleUpdateItem = (
    id: string | number,
    campo: keyof ItemPresupuesto,
    valor: unknown
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const actualizado = { ...it, [campo]: valor }
        const cant = Number(actualizado.cantidad) || 1
        const precio = Number(actualizado.precioUnitario) || 0
        const desc = Number(actualizado.descuento) || 0
        actualizado.subtotal = Math.max(0, cant * precio - desc)
        return actualizado
      })
    )
  }

  const { totalBruto, totalDescuento, totalPagar } = useMemo(() => {
    const bruto = items.reduce((sum, it) => sum + (it.subtotal || 0), 0)
    const descGlobal = Math.round(bruto * (descuentoGlobalPct / 100))
    return {
      totalBruto: bruto,
      totalDescuento: descGlobal,
      totalPagar: Math.max(0, bruto - descGlobal),
    }
  }, [items, descuentoGlobalPct])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const nuevo = crearPresupuesto({
      pacienteId,
      pacienteNombre,
      pacienteRut,
      items,
      totalBruto,
      totalDescuentos: totalDescuento,
      totalAPagar: totalPagar,
      total: totalPagar,
      montoTotal: totalPagar,
      estado: 'borrador',
    })
    onGuardar?.(nuevo)
    onCerrar()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      data-testid="modal-nuevo-presupuesto"
    >
      <div className="bg-surface border border-surface rounded-2xl w-full max-w-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-surface">
          <div>
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">
              Nuevo Presupuesto & Plan de Tratamiento
            </h3>
            <p className="text-xs text-graphite-500">
              Paciente: {pacienteNombre} &bull; RUT: {pacienteRut}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Simplificada / Detallada */}
            <div className="flex items-center p-1 bg-surface-hover rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setVista('simplificada')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold ${
                  vista === 'simplificada' ? 'bg-primary text-white' : 'text-graphite-500'
                }`}
                data-testid="btn-vista-simplificada"
              >
                <Layers className="w-3.5 h-3.5" /> Fases
              </button>
              <button
                type="button"
                onClick={() => setVista('detallada')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold ${
                  vista === 'detallada' ? 'bg-primary text-white' : 'text-graphite-500'
                }`}
                data-testid="btn-vista-detallada"
              >
                <List className="w-3.5 h-3.5" /> Items
              </button>
            </div>

            <button
              type="button"
              onClick={onCerrar}
              className="text-graphite-400 hover:text-graphite-700"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Formulario e Items */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          {vista === 'simplificada' ? (
            <div className="space-y-3" data-testid="presupuesto-vista-simplificada">
              {(['urgencias', 'estabilizacion', 'rehabilitacion', 'estetica'] as const).map(
                (fase) => {
                  const itemsFase = items.filter((it) => it.faseClinica === fase)
                  const subtotalFase = itemsFase.reduce((s, it) => s + it.subtotal, 0)
                  return (
                    <div
                      key={fase}
                      className="p-3.5 bg-surface-hover/50 border border-surface rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-graphite-700 dark:text-graphite-300">
                          Fase {fase} ({itemsFase.length} prestaciones)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-primary">
                            ${subtotalFase.toLocaleString('es-CL')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAgregarItem(fase)}
                            className="text-xs text-primary hover:underline font-semibold"
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>

                      {itemsFase.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between text-xs py-1 text-graphite-600 dark:text-graphite-400"
                        >
                          <span>{it.nombrePrestacion}</span>
                          <span>${it.subtotal.toLocaleString('es-CL')}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              )}
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="presupuesto-vista-detallada">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-12 gap-2 items-center p-2.5 bg-surface border border-surface rounded-xl text-xs"
                >
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={it.nombrePrestacion}
                      onChange={(e) => handleUpdateItem(it.id, 'nombrePrestacion', e.target.value)}
                      className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={it.precioUnitario}
                      onChange={(e) => handleUpdateItem(it.id, 'precioUnitario', Number(e.target.value))}
                      className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={it.cantidad}
                      onChange={(e) => handleUpdateItem(it.id, 'cantidad', Number(e.target.value))}
                      className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-primary">
                    ${it.subtotal.toLocaleString('es-CL')}
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleEliminarItem(it.id)}
                      className="text-graphite-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => handleAgregarItem()}>
                Agregar Item
              </Button>
            </div>
          )}

          {/* Resumen Totales */}
          <div className="pt-3 border-t border-surface flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-graphite-600">Descuento Global (%):</span>
              <input
                type="number"
                min="0"
                max="100"
                value={descuentoGlobalPct}
                onChange={(e) => setDescuentoGlobalPct(Number(e.target.value))}
                className="w-16 p-1 bg-surface border border-surface rounded-lg text-center font-bold"
              />
            </div>

            <div className="text-right space-y-0.5">
              <p className="text-graphite-500">
                Total Bruto: <span className="font-mono">${totalBruto.toLocaleString('es-CL')}</span>
              </p>
              {totalDescuento > 0 && (
                <p className="text-rose-600 font-semibold">
                  Descuento: -<span className="font-mono">${totalDescuento.toLocaleString('es-CL')}</span>
                </p>
              )}
              <p className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
                Total a Pagar: <span className="font-mono text-primary">${totalPagar.toLocaleString('es-CL')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface">
            <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" icon={DollarSign}>
              Crear Presupuesto
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
