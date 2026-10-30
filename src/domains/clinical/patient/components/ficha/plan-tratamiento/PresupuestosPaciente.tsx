import React, { useEffect, useState } from 'react'
import { ModalRegistrarPago } from '../../../../../billing/budget/components/ModalRegistrarPago'
import { pagosService } from '../../../../../billing/budget/services/pagosService'
import { presupuestosStorageService, type PresupuestoLocal } from '../../../../../billing/budget/services/presupuestosStorageService'
import { esUuidValido } from '../../../../../../infrastructure/supabase/migrations/uuidUtils'
import { getClinicaActivaSync } from '../../../../../../infrastructure/auth/authService'
import { useRBAC } from '../../../../../../shared/hooks/useRBAC'

export const PresupuestosPaciente: React.FC<{ pacienteId: string }> = ({ pacienteId }) => {
  const { rol } = useRBAC()
  const puedeRegistrar = rol === 'admin' || rol === 'dentista' || rol === 'recepcion'
  const [presupuestos, setPresupuestos] = useState<PresupuestoLocal[]>([])
  const [seleccionado, setSeleccionado] = useState<PresupuestoLocal | null>(null)
  const [errorSync, setErrorSync] = useState(false)

  useEffect(() => {
    let vigente = true
    const cargar = () => {
      if (!getClinicaActivaSync()) {
        if (vigente) setPresupuestos([])
        return
      }
      if (vigente) setPresupuestos(presupuestosStorageService.obtenerPresupuestos([]).filter((p) => String(p.pacienteId) === pacienteId && p.estado !== 'archivado'))
    }
    cargar()
    window.addEventListener('presupuestos_actualizados', cargar)
    if (getClinicaActivaSync()) {
      void presupuestosStorageService.sincronizarDesdeSupabase().then(() => {
        if (vigente) setErrorSync(false)
        cargar()
      }).catch(() => { if (vigente) setErrorSync(true) })
    }
    return () => {
      vigente = false
      window.removeEventListener('presupuestos_actualizados', cargar)
    }
  }, [pacienteId])

  return (
    <section className="rounded-2xl border border-surface bg-surface/80 p-5 space-y-3" aria-label="Presupuestos del paciente">
      <h4 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">Presupuestos del paciente</h4>
      {errorSync && <p role="alert" className="text-xs text-amber-700">No se pudo actualizar el listado. Comprueba la conexión antes de registrar un pago.</p>}
      {presupuestos.length === 0 && <p className="text-xs text-graphite-500">Aún no hay presupuestos formales para este paciente.</p>}
      {presupuestos.map((p) => {
        const total = Number(p.montoTotal || 0)
        const saldo = Math.max(0, total - Number(p.montoAbonado || 0))
        const admitePago = ['aprobado', 'en-curso', 'Aprobado', 'EnTratamiento'].includes(p.estado || '')
        const sincronizado = esUuidValido(p.id) && p.sincronizado !== false
        return (
          <div key={String(p.id)} className="flex items-center justify-between gap-3 rounded-xl border border-surface p-3 text-xs">
            <div>
              <p className="font-bold">{p.folio || 'Presupuesto'} · {p.estado || 'borrador'}</p>
              <p className="text-graphite-500">Total ${total.toLocaleString('es-CL')} · Saldo ${saldo.toLocaleString('es-CL')}</p>
            </div>
            {puedeRegistrar && admitePago && saldo > 0 && (
              <button type="button" disabled={!sincronizado} title={sincronizado ? 'Registrar abono manual' : 'Espera la sincronización del presupuesto'}
                className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50"
                onClick={() => setSeleccionado(p)}>
                Registrar pago
              </button>
            )}
          </div>
        )
      })}
      {seleccionado && <ModalRegistrarPago
        totalPresupuesto={Number(seleccionado.montoTotal || 0)}
        saldoPendiente={Math.max(0, Number(seleccionado.montoTotal || 0) - Number(seleccionado.montoAbonado || 0))}
        folioPresupuesto={seleccionado.folio}
        pacienteNombre={seleccionado.pacienteNombre}
        onRegistrarPago={async (pago) => {
          try {
            await pagosService.registrarPagoManual({ pagoId: pago.id, presupuestoId: seleccionado.id, monto: pago.monto, medioPago: pago.medioPago, referencia: pago.referencia })
            setSeleccionado(null)
            return true
          } catch {
            return false
          }
        }}
        onCerrar={() => setSeleccionado(null)}
      />}
    </section>
  )
}
