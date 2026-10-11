import React, { useState, useMemo } from 'react'
import { X, Plus, Trash2, Layers, List, DollarSign } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import { usePresupuestosStore } from '../../../../../app/stores/usePresupuestosStore'
import type { Presupuesto, ItemPresupuesto } from '../../schemas/presupuestoSchema'

interface ModalNuevoPresupuestoProps {
  pacienteId?: string | number
  pacienteNombre?: string
  pacienteRut?: string
  onGuardar?: (presupuesto: Presupuesto) => void
  onCerrar: () => void
}

const CONVENIOS: Record<string, { label: string; pct: number }> = {
  particular: { label: 'Particular (Sin convenio)', pct: 0 },
  fonasa: { label: 'FONASA (15% Bonificación)', pct: 15 },
  banmedica: { label: 'Banmédica (20%)', pct: 20 },
  consalud: { label: 'Consalud (20%)', pct: 20 },
  cruzblanca: { label: 'CruzBlanca (20%)', pct: 20 },
  colmena: { label: 'Colmena (20%)', pct: 20 },
}

export const ModalNuevoPresupuesto: React.FC<ModalNuevoPresupuestoProps> = ({
  pacienteId = 'pac-1',
  pacienteNombre = 'Paciente de Prueba',
  pacienteRut = '12.345.678-9',
  onGuardar,
  onCerrar,
}) => {
  const [vista, setVista] = useState<'simplificada' | 'detallada'>('simplificada')
  const [prevision, setPrevision] = useState('particular')
  const [validezDias, setValidezDias] = useState(15)
  const [motivoDescuento, setMotivoDescuento] = useState('')
  const [autorizadoPor, setAutorizadoPor] = useState('')
  const [descuentoManualPct, setDescuentoManualPct] = useState(0)

  const presupuestoActivo = usePresupuestosStore((s) => s.presupuestoActivo)
  const [items, setItems] = useState<ItemPresupuesto[]>(() => {
    if (presupuestoActivo?.items?.length) return presupuestoActivo.items as ItemPresupuesto[]
    return [
      { id: 'it-1', codigoPrestacion: 'PREST-01', nombrePrestacion: 'Evaluación y Diagnóstico Integral', cantidad: 1, precioUnitario: 35000, descuento: 0, subtotal: 35000, faseClinica: 'urgencias' },
      { id: 'it-2', codigoPrestacion: 'PREST-02', nombrePrestacion: 'Destartraje y Profilaxis Bimaxilar', cantidad: 1, precioUnitario: 45000, descuento: 0, subtotal: 45000, faseClinica: 'estabilizacion' },
    ]
  })

  const descuentoConvenioPct = CONVENIOS[prevision]?.pct || 0
  const descuentoTotalPct = Math.min(100, descuentoConvenioPct + descuentoManualPct)

  const handleAgregarItem = (fase: ItemPresupuesto['faseClinica'] = 'estabilizacion') => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nombrePrestacion: 'Nueva Prestación Clínica', cantidad: 1, precioUnitario: 30000, descuento: 0, subtotal: 30000, faseClinica: fase },
    ])
  }

  const handleEliminarItem = (id: string | number) => setItems((prev) => prev.filter((it) => it.id !== id))

  const handleUpdateItem = (id: string | number, campo: keyof ItemPresupuesto, valor: unknown) => {
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
    const desc = Math.round(bruto * (descuentoTotalPct / 100))
    return { totalBruto: bruto, totalDescuento: desc, totalPagar: Math.max(0, bruto - desc) }
  }, [items, descuentoTotalPct])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (descuentoManualPct > 0 && (!motivoDescuento.trim() || !autorizadoPor.trim())) {
      window.alert('Motivo y profesional autorizador obligatorios para descuentos manuales.')
      return
    }

    const nuevoPresupuesto: Presupuesto = {
      id: crypto.randomUUID(),
      folio: `PRE-${Date.now().toString().slice(-6)}`,
      pacienteId: String(pacienteId),
      pacienteNombre,
      pacienteRut,
      items,
      totalBruto,
      totalDescuentos: totalDescuento,
      totalAPagar: totalPagar,
      total: totalPagar,
      montoTotal: totalPagar,
      estado: 'borrador',
      prevision,
      validezDias,
      fechaVencimiento: new Date(Date.now() + validezDias * 86400000).toISOString(),
      motivoDescuento: motivoDescuento.trim() || undefined,
      autorizadoPor: autorizadoPor.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Presupuesto

    onGuardar?.(nuevoPresupuesto)
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" data-testid="modal-nuevo-presupuesto">
      <div className="bg-surface border border-surface rounded-2xl w-full max-w-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-surface">
          <div>
            <h3 className="text-base font-bold text-graphite-900 dark:text-graphite-50">Nuevo Presupuesto & Plan de Tratamiento (BP07)</h3>
            <p className="text-xs text-graphite-500">Paciente: {pacienteNombre} &bull; RUT: {pacienteRut}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-surface-hover rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setVista('simplificada')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold ${vista === 'simplificada' ? 'bg-primary text-white' : 'text-graphite-500'}`}
                data-testid="btn-vista-simplificada"
              >
                <Layers className="w-3.5 h-3.5" /> Fases
              </button>
              <button
                type="button"
                onClick={() => setVista('detallada')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold ${vista === 'detallada' ? 'bg-primary text-white' : 'text-graphite-500'}`}
                data-testid="btn-vista-detallada"
              >
                <List className="w-3.5 h-3.5" /> Items
              </button>
            </div>
            <button type="button" onClick={onCerrar} className="text-graphite-400 hover:text-graphite-700" aria-label="Cerrar modal">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface/50 border border-surface rounded-xl text-xs">
            <div>
              <label className="block font-semibold mb-1">Convenio / Previsión del Paciente</label>
              <select value={prevision} onChange={(e) => setPrevision(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-lg">
                {Object.entries(CONVENIOS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Vigencia del Presupuesto (Días)</label>
              <input type="number" min="1" max="90" value={validezDias} onChange={(e) => setValidezDias(Number(e.target.value))} className="w-full p-2 bg-surface border border-surface rounded-lg font-mono" />
            </div>
          </div>

          {vista === 'simplificada' ? (
            <div className="space-y-3" data-testid="presupuesto-vista-simplificada">
              {(['urgencias', 'estabilizacion', 'rehabilitacion', 'estetica'] as const).map((fase) => {
                const itemsFase = items.filter((it) => it.faseClinica === fase)
                const subtotalFase = itemsFase.reduce((s, it) => s + it.subtotal, 0)
                return (
                  <div key={fase} className="p-3.5 bg-surface-hover/50 border border-surface rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-graphite-700 dark:text-graphite-300">
                        Fase {fase} ({itemsFase.length} prestaciones)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-primary">${subtotalFase.toLocaleString('es-CL')}</span>
                        <button type="button" onClick={() => handleAgregarItem(fase)} className="text-xs text-primary hover:underline font-semibold">+ Agregar</button>
                      </div>
                    </div>
                    {itemsFase.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-xs py-1 text-graphite-600 dark:text-graphite-400">
                        <span>{it.nombrePrestacion}</span>
                        <span>${it.subtotal.toLocaleString('es-CL')}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2.5" data-testid="presupuesto-vista-detallada">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center p-2.5 bg-surface border border-surface rounded-xl text-xs">
                  <div className="col-span-5">
                    <input type="text" value={it.nombrePrestacion} onChange={(e) => handleUpdateItem(it.id, 'nombrePrestacion', e.target.value)} className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={it.precioUnitario} onChange={(e) => handleUpdateItem(it.id, 'precioUnitario', Number(e.target.value))} className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs font-mono" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={it.cantidad} onChange={(e) => handleUpdateItem(it.id, 'cantidad', Number(e.target.value))} className="w-full p-1.5 bg-surface border border-surface rounded-lg text-xs font-mono" />
                  </div>
                  <div className="col-span-2 text-right font-mono font-bold text-primary">${it.subtotal.toLocaleString('es-CL')}</div>
                  <div className="col-span-1 text-center">
                    <button type="button" onClick={() => handleEliminarItem(it.id)} className="text-graphite-400 hover:text-rose-500" aria-label="Eliminar item">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => handleAgregarItem()}>Agregar Item</Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface/50 border border-surface rounded-xl text-xs">
            <div>
              <label className="block font-semibold mb-1">Descuento Especial Manual (%)</label>
              <input type="number" min="0" max="100" value={descuentoManualPct} onChange={(e) => setDescuentoManualPct(Number(e.target.value))} className="w-full p-2 bg-surface border border-surface rounded-lg font-bold" />
            </div>
            {descuentoManualPct > 0 && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-2 pt-2 border-t border-surface">
                <div>
                  <label className="block text-[11px] font-semibold text-amber-600">Motivo de Descuento (Obligatorio)</label>
                  <input type="text" required value={motivoDescuento} onChange={(e) => setMotivoDescuento(e.target.value)} placeholder="Ej: Convenio empresa familiar" className="w-full p-1.5 bg-surface border border-surface rounded-lg" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-600">Autorizado Por (Obligatorio)</label>
                  <input type="text" required value={autorizadoPor} onChange={(e) => setAutorizadoPor(e.target.value)} placeholder="Ej: Dr. Director Clínico" className="w-full p-1.5 bg-surface border border-surface rounded-lg" />
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-surface flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3 text-xs">
            <div className="text-graphite-500">
              Descuento Convenio: <span className="font-bold text-primary">{descuentoConvenioPct}%</span> &bull; Total Desc: <span className="font-bold text-rose-600">{descuentoTotalPct}%</span>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-graphite-500">Total Bruto: <span className="font-mono">${totalBruto.toLocaleString('es-CL')}</span></p>
              {totalDescuento > 0 && <p className="text-rose-600 font-semibold">Descuento: -<span className="font-mono">${totalDescuento.toLocaleString('es-CL')}</span></p>}
              <p className="text-sm font-bold text-graphite-900 dark:text-graphite-50">Total a Pagar: <span className="font-mono text-primary">${totalPagar.toLocaleString('es-CL')}</span></p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface">
            <Button type="button" variant="ghost" size="sm" onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" variant="primary" size="sm" icon={DollarSign}>Crear Presupuesto</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
