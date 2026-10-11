import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Presupuesto, Pago } from '../../domains/billing/budget/schemas/presupuestoSchema'
import { timelineService } from '../../domains/clinical/patient/services/timelineService'

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
  verificarVencidos: () => void
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

        if (presupuesto.pacienteId) {
          timelineService.agregarEvento(presupuesto.pacienteId, {
            id: `tl-trans-${Date.now()}`,
            fecha: new Date().toISOString(),
            tipo: 'presupuesto',
            titulo: `Presupuesto ${presupuesto.folio || presupuesto.id} cambió a ${estado.toUpperCase()}`,
            detalles: `Estado actualizado a ${estado}`,
          })
        }
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

        if (presupuesto.pacienteId) {
          timelineService.agregarEvento(presupuesto.pacienteId, {
            id: `tl-pago-${Date.now()}`,
            fecha: new Date().toISOString(),
            tipo: 'pago',
            titulo: `Pago de $${Number(pago.monto).toLocaleString('es-CL')} · ${(pago as any).medioPago || 'Efectivo'}`,
            profesional: (pago as any).recibidoPor || 'Clínica',
            detalles: `Saldo restante: $${Math.max(0, totalPagar - nuevoAbonado).toLocaleString('es-CL')} · Estado: ${nuevoEstado.toUpperCase()}`,
          })
        }
      },

      verificarVencidos: () => {
        const ahora = Date.now()
        get().presupuestos.forEach((p) => {
          if (p.estado === 'enviado' && p.fechaVencimiento) {
            if (new Date(p.fechaVencimiento).getTime() < ahora) {
              get().cambiarEstado(p.id, 'vencido')
            }
          }
        })
      },

      generarDesdePlanTratamiento: (pacienteId, pacienteNombre, items) => {
        const itemsNormalizados = (items as Array<Record<string, any>>).map((it, idx) => {
          const cantidad = Number(it.cantidad) || 1
          const precioUnitario = Number(it.precioUnitario || it.costo || it.valor || 0)
          const descuento = Number(it.descuento || 0)
          const subtotal = Number(it.subtotal) || Math.max(0, cantidad * precioUnitario - descuento)
          return {
            id: it.id || `it-plan-${idx}-${Date.now()}`,
            codigoPrestacion: it.codigoPrestacion || `PREST-${it.pieza || 'GEN'}`,
            nombrePrestacion: it.nombrePrestacion || it.descripcion || 'Procedimiento Clínico',
            cantidad,
            precioUnitario,
            descuento,
            subtotal,
            faseClinica: (it.faseClinica || 'estabilizacion').toLowerCase(),
          }
        })

        const total = itemsNormalizados.reduce((sum, it) => sum + (it.subtotal || 0), 0)
        const nuevo = get().crearPresupuesto({
          pacienteId,
          pacienteNombre,
          items: itemsNormalizados as Presupuesto['items'],
          totalBruto: total,
          totalAPagar: total,
          total,
          montoTotal: total,
          estado: 'borrador',
        })
        set({ presupuestoActivo: nuevo })
        return nuevo
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
