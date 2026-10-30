import React, { useState, useMemo } from 'react'
import { X, Layers, List, DollarSign, Calendar } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import type { Presupuesto, ItemPresupuesto } from '../../schemas/presupuestoSchema'
import { finanzasStorageService } from '../../../cash-register/services/finanzasStorageService'
import { ModalConfigurarCuotas, type PlanCuotasConfig } from './ModalConfigurarCuotas'
import { ModalPresupuestoItemsView } from './ModalPresupuestoItemsView'

interface ModalNuevoPresupuestoProps {
  pacienteId: string | number
  pacienteNombre: string
  pacienteRut?: string
  itemsIniciales?: ItemPresupuesto[]
  planRevision?: string
  onGuardar: (presupuesto: Presupuesto) => boolean | void | Promise<boolean | void>
  onCerrar: () => void
}

export const ModalNuevoPresupuesto: React.FC<ModalNuevoPresupuestoProps> = ({
  pacienteId,
  pacienteNombre,
  pacienteRut,
  itemsIniciales = [],
  planRevision,
  onGuardar,
  onCerrar,
}) => {
  const [vista, setVista] = useState<'simplificada' | 'detallada'>('simplificada')
  const [prevision, setPrevision] = useState('particular')
  const [validezDias, setValidezDias] = useState(15)
  const [motivoDescuento, setMotivoDescuento] = useState('')
  const [autorizadoPor, setAutorizadoPor] = useState('')
  const [descuentoManualPct, setDescuentoManualPct] = useState(0)
  const [showConfigCuotas, setShowConfigCuotas] = useState(false)
  const [planCuotas, setPlanCuotas] = useState<PlanCuotasConfig | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [convenios] = useState(() => finanzasStorageService.obtenerConvenios([]))

  const [items, setItems] = useState<ItemPresupuesto[]>(itemsIniciales)

  const descuentoConvenioPct = convenios.find((convenio) => convenio.id === prevision)?.descuentoDefecto || 0
  const descuentoTotalPct = Math.min(100, descuentoConvenioPct + descuentoManualPct)

  const handleAgregarItem = (fase: ItemPresupuesto['faseClinica'] = 'estabilizacion') => {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), nombrePrestacion: '', cantidad: 1, precioUnitario: 0, descuento: 0, subtotal: 0, faseClinica: fase }])
  }

  const handleEliminarItem = (id: string | number) => setItems((prev) => prev.filter((it) => it.id !== id))

  const handleUpdateItem = (id: string | number, campo: keyof ItemPresupuesto, valor: unknown) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it
      const act = { ...it, [campo]: valor }
      act.subtotal = Math.max(0, (Number(act.cantidad) || 1) * (Number(act.precioUnitario) || 0) - (Number(act.descuento) || 0))
      return act
    }))
  }

  const { totalBruto, totalDescuento, totalPagar } = useMemo(() => {
    const bruto = items.reduce((sum, it) => sum + (it.subtotal || 0), 0)
    const desc = Math.round(bruto * (descuentoTotalPct / 100))
    return { totalBruto: bruto, totalDescuento: desc, totalPagar: Math.max(0, bruto - desc) }
  }, [items, descuentoTotalPct])

  const handleCancelar = () => {
    if (items.length > 2 && !window.confirm('¿Deseas descartar los cambios del presupuesto sin guardar?')) return
    onCerrar()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteId || !pacienteNombre.trim()) { setError('Debe seleccionar un paciente válido.'); return }
    if (items.length === 0 || items.some((item) => !item.nombrePrestacion.trim() || item.precioUnitario <= 0)) { setError('Cada prestación necesita nombre y precio revisado.'); return }
    if (totalPagar <= 0) { setError('El total a pagar debe ser mayor a $0.'); return }
    if (descuentoManualPct > 0 && (!motivoDescuento.trim() || !autorizadoPor.trim())) {
      setError('Motivo y profesional autorizador obligatorios para descuentos manuales.'); return
    }

    const folio = `PRE-${Date.now().toString().slice(-6)}`
    const nuevoPresupuesto: Presupuesto = {
      id: crypto.randomUUID(), folio, pacienteId: String(pacienteId), pacienteNombre, pacienteRut,
      items, totalBruto, totalDescuentos: totalDescuento, totalAPagar: totalPagar, total: totalPagar, montoTotal: totalPagar,
      estado: 'borrador', prevision, validezDias, fechaVencimiento: new Date(Date.now() + validezDias * 86400000).toISOString(),
      origenPlan: Boolean(planRevision), planRevision, versionGrupoId: planRevision ? crypto.randomUUID() : undefined,
      version: 1, requiereRevision: false, descuentoGlobalPct: descuentoTotalPct,
      motivoDescuento: motivoDescuento.trim() || undefined, autorizadoPor: autorizadoPor.trim() || undefined,
      planCuotas: planCuotas ? { cuotas: planCuotas.cuotas, valorCuota: planCuotas.valorCuota, modalidad: planCuotas.modalidad } : undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as unknown as Presupuesto

    setGuardando(true)
    setError('')
    try {
      const resultado = await onGuardar(nuevoPresupuesto)
      if (resultado === false) { setError('No se pudo guardar el presupuesto.'); return }
      onCerrar()
    } catch {
      setError('No se pudo guardar el presupuesto.')
    } finally {
      setGuardando(false)
    }
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
              <button type="button" onClick={() => setVista('simplificada')} className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold ${vista === 'simplificada' ? 'bg-primary text-white' : 'text-graphite-500'}`} data-testid="btn-vista-simplificada">
                <Layers className="w-3.5 h-3.5" /> Fases
              </button>
              <button type="button" onClick={() => setVista('detallada')} className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold ${vista === 'detallada' ? 'bg-primary text-white' : 'text-graphite-500'}`} data-testid="btn-vista-detallada">
                <List className="w-3.5 h-3.5" /> Items
              </button>
            </div>
            <button type="button" onClick={handleCancelar} className="text-graphite-400 hover:text-graphite-700" aria-label="Cerrar modal"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface/50 border border-surface rounded-xl text-xs">
            <div>
              <label className="block font-semibold mb-1">Convenio / Previsión del Paciente</label>
              <select value={prevision} onChange={(e) => setPrevision(e.target.value)} className="w-full p-2 bg-surface border border-surface rounded-lg">
                <option value="particular">Particular (sin descuento)</option>
                {convenios.filter((convenio) => convenio.id !== 'particular').map((convenio) => <option key={convenio.id} value={convenio.id}>{convenio.nombre} ({convenio.descuentoDefecto}%)</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Vigencia del Presupuesto (Días)</label>
              <input type="number" min="1" max="90" value={validezDias} onChange={(e) => setValidezDias(Number(e.target.value))} className="w-full p-2 bg-surface border border-surface rounded-lg font-mono" />
            </div>
          </div>

          <ModalPresupuestoItemsView vista={vista} items={items} onAgregarItem={handleAgregarItem} onEliminarItem={handleEliminarItem} onUpdateItem={handleUpdateItem} />
          {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}

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
              {planCuotas && <span className="block text-[11px] text-emerald-600 font-semibold mt-1">Plan: {planCuotas.cuotas}x ${planCuotas.valorCuota.toLocaleString('es-CL')} ({planCuotas.frecuencia})</span>}
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-graphite-500">Total Bruto: <span className="font-mono">${totalBruto.toLocaleString('es-CL')}</span></p>
              {totalDescuento > 0 && <p className="text-rose-600 font-semibold">Descuento: -<span className="font-mono">${totalDescuento.toLocaleString('es-CL')}</span></p>}
              <p className="text-sm font-bold text-graphite-900 dark:text-graphite-50">Total a Pagar: <span className="font-mono text-primary">${totalPagar.toLocaleString('es-CL')}</span></p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-surface">
            <Button type="button" variant="secondary" size="sm" icon={Calendar} onClick={() => setShowConfigCuotas(true)} data-testid="btn-configurar-cuota">
              Configurar cuota
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelar} data-testid="btn-cancelar-presupuesto">
                Cancelar
              </Button>
              <button
                type="submit"
                disabled={guardando}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#E5C378] to-[#B88E3A] text-[#070B14] hover:brightness-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                data-testid="btn-guardar-presupuesto"
              >
                <DollarSign className="w-4 h-4" /> Guardar presupuesto
              </button>
            </div>
          </div>
        </form>
      </div>

      {showConfigCuotas && (
        <ModalConfigurarCuotas montoTotal={totalPagar} onConfirmar={(plan) => setPlanCuotas(plan)} onCerrar={() => setShowConfigCuotas(false)} />
      )}
    </div>
  )
}
