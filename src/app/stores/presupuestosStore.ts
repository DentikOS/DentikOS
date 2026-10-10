import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Presupuesto, Pago } from '../../domains/billing/budget/schemas/presupuestoSchema'

export interface PresupuestosState {
  presupuestos: Presupuesto[]
  presupuestoActivo: Presupuesto | null
  vistaActual: 'simplificada' | 'detallada'
  
  setPresupuestos: (presupuestos: Presupuesto[]) => void
  setPresupuestoActivo: (presupuesto: Presupuesto | null) => void
  setVista: (vista: 'simplificada' | 'detallada') => void
  
  crearPresupuesto: (datos: Partial<Presupuesto>) => Presupuesto
  actualizarPresupuesto: (id: string | number, datos: Partial<Presupuesto>) => void
  cambiarEstado: (id: string | number, estado: string) => void
  registrarPago: (presupuestoId: string | number, pago: Omit<Pago, 'id'>) => void
  generarDesdePlanTratamiento: (pacienteId: string | number, pacienteNombre: string, items: unknown[]) => Presupuesto
}

export const usePresupuestosStore = create<PresupuestosState>()(
  persist(
    (set, get) => ({
      presupuestos: [],
      presupuestoActivo: null,
      vistaActual: 'simplificada',

      setPresupuestos: (presupuestos) => set({ presupuestos }),
      setPresupuestoActivo: (presupuesto) => set({ presupuestoActivo: presupuesto }),
      setVista: (vista) => set({ vistaActual: vista }),

      crearPresupuesto: (datos) => {
        const id = datos.id || crypto.randomUUID()
        const count = get().presupuestos.length + 1
        const folio = datos.folio || `P-${String(count).padStart(3, '0')}`

        const nuevo: Presupuesto = {
          id,
          folio,
          pacienteNombre: datos.pacienteNombre || 'Paciente',
          estado: datos.estado || 'borrador',
          fechaCreacion: new Date().toISOString(),
          fechaVencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          items: [],
          totalBruto: 0,
          totalDescuentos: 0,
          totalAPagar: 0,
          montoTotal: 0,
          montoAbonado: 0,
          versiones: [],
          version: 1,
          ...datos,
        }

        set((state) => ({ presupuestos: [nuevo, ...state.presupuestos] }))
        return nuevo
      },

      actualizarPresupuesto: (id, datos) => {
        set((state) => ({
          presupuestos: state.presupuestos.map((p) =>
            String(p.id) === String(id) ? { ...p, ...datos } : p
          ),
          presupuestoActivo:
            state.presupuestoActivo && String(state.presupuestoActivo.id) === String(id)
              ? { ...state.presupuestoActivo, ...datos }
              : state.presupuestoActivo,
        }))
      },

      cambiarEstado: (id, estado) => {
        const presupuesto = get().presupuestos.find((p) => String(p.id) === String(id))
        if (!presupuesto) return

        const updates: Partial<Presupuesto> = { estado }
        if (estado === 'enviado' && !presupuesto.fechaEnvio) {
          updates.fechaEnvio = new Date().toISOString()
        } else if (estado === 'aprobado' && !presupuesto.fechaAprobacion) {
          updates.fechaAprobacion = new Date().toISOString()
        }

        get().actualizarPresupuesto(id, updates)
      },

      registrarPago: (presupuestoId, pago) => {
        const presupuesto = get().presupuestos.find((p) => String(p.id) === String(presupuestoId))
        if (!presupuesto) return

        const nuevoAbonado = (presupuesto.montoAbonado || 0) + Number(pago.monto)
        const totalPagar = presupuesto.totalAPagar || presupuesto.total || presupuesto.montoTotal || 0
        const nuevoEstado = nuevoAbonado >= totalPagar ? 'completado' : 'en-curso'

        get().actualizarPresupuesto(presupuestoId, {
          montoAbonado: nuevoAbonado,
          estado: nuevoEstado,
        })
      },

      generarDesdePlanTratamiento: (pacienteId, pacienteNombre, items) => {
        const total = (items as Array<{ costo?: number; valor?: number }>).reduce(
          (sum, it) => sum + (it.costo || it.valor || 0),
          0
        )
        return get().crearPresupuesto({
          pacienteId,
          pacienteNombre,
          items: items as Presupuesto['items'],
          totalBruto: total,
          totalAPagar: total,
          total,
          montoTotal: total,
          estado: 'borrador',
        })
      },
    }),
    {
      name: 'studio-dental-presupuestos-store',
      partialize: (state) => ({
        vistaActual: state.vistaActual,
      }),
    }
  )
)
