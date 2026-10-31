import React, { useEffect, useRef, useState } from 'react'
import { ModalRegistrarPago } from '../../../../../billing/budget/components/ModalRegistrarPago'
import { pagosService } from '../../../../../billing/budget/services/pagosService'
import { presupuestosStorageService, type PresupuestoLocal } from '../../../../../billing/budget/services/presupuestosStorageService'
import { presupuestoVersionesService, type VersionPresupuesto } from '../../../../../billing/budget/services/presupuestoVersionesService'
import { historialPagosPresupuestoService, type PagoPresupuesto } from '../../../../../billing/budget/services/historialPagosPresupuestoService'
import { HistorialVersiones } from '../../../../../billing/budget/components/vistas/HistorialVersiones'
import { esUuidValido } from '../../../../../../infrastructure/supabase/migrations/uuidUtils'
import { getClinicaActivaSync } from '../../../../../../infrastructure/auth/authService'
import { useSesionStore } from '../../../../../../app/stores/sesionStore'
import { useRBAC } from '../../../../../../shared/hooks/useRBAC'

export const PresupuestosPaciente: React.FC<{ pacienteId: string }> = ({ pacienteId }) => {
  const { rol } = useRBAC()
  const clinicaActual = useSesionStore((s) => s.clinicaActual)
  const puedeRegistrar = rol === 'admin' || rol === 'dentista' || rol === 'recepcion'
  const [presupuestos, setPresupuestos] = useState<PresupuestoLocal[]>([])
  const [seleccionado, setSeleccionado] = useState<PresupuestoLocal | null>(null)
  const [errorSync, setErrorSync] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState('')
  const [errorPagos, setErrorPagos] = useState('')
  const [pagos, setPagos] = useState<{ presupuestoId: string; pacienteId: string;
    clinicaId: string | null; folio: string; registros: PagoPresupuesto[] } | null>(null)
  const [historial, setHistorial] = useState<{ folio: string; versiones: VersionPresupuesto[];
    pacienteId: string; clinicaId: string | null } | null>(null)
  const pacienteActualRef = useRef(pacienteId)
  pacienteActualRef.current = pacienteId

  useEffect(() => {
    let vigente = true
    setHistorial(null)
    setErrorHistorial('')
    setPagos(null)
    setErrorPagos('')
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
  }, [pacienteId, clinicaActual])

  return (
    <section className="rounded-2xl border border-surface bg-surface/80 p-5 space-y-3" aria-label="Presupuestos del paciente">
      <h4 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">Presupuestos del paciente</h4>
      <p className="text-xs text-graphite-500">Los abonos reducen el saldo total. Ninguna prestación se marca pagada sin asignar el abono a esa prestación.</p>
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
              <p className="font-bold">{p.folio || 'Presupuesto'} · {p.estado === 'completado' ? 'Pago completado' : p.estado || 'borrador'}</p>
              <p className="text-graphite-500">Total ${total.toLocaleString('es-CL')} · Saldo ${saldo.toLocaleString('es-CL')}</p>
              {p.requiereRevision && <p className="text-amber-700 font-semibold">Pendiente de revisión clínica antes del envío</p>}
            </div>
            {puedeRegistrar && admitePago && saldo > 0 && (
              <button type="button" disabled={!sincronizado} title={sincronizado ? 'Registrar abono manual' : 'Espera la sincronización del presupuesto'}
                className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50"
                onClick={() => setSeleccionado(p)}>
                Registrar pago
              </button>
            )}
            {sincronizado && <button type="button" className="rounded-lg border border-surface px-3 py-2 font-semibold"
              onClick={async () => {
                setErrorHistorial('')
                const clinicaSolicitada = getClinicaActivaSync()
                try {
                  const versiones = await presupuestoVersionesService.listar(p, presupuestos)
                  if (pacienteActualRef.current === pacienteId && getClinicaActivaSync() === clinicaSolicitada) {
                    setHistorial({ folio: p.folio || 'Presupuesto', versiones, pacienteId, clinicaId: clinicaSolicitada })
                  }
                } catch (cause) {
                  if (pacienteActualRef.current === pacienteId && getClinicaActivaSync() === clinicaSolicitada) {
                    setErrorHistorial(cause instanceof Error ? cause.message : 'No se pudo abrir el historial.')
                  }
                }
              }}>Ver historial</button>}
            {puedeRegistrar && sincronizado && <button type="button" className="rounded-lg border border-surface px-3 py-2 font-semibold"
              onClick={async () => {
                setErrorPagos('')
                const clinicaSolicitada = getClinicaActivaSync()
                try {
                  const registros = await historialPagosPresupuestoService.listar(p.id, pacienteId)
                  if (pacienteActualRef.current === pacienteId && getClinicaActivaSync() === clinicaSolicitada) {
                    setPagos({ presupuestoId: String(p.id), pacienteId, clinicaId: clinicaSolicitada,
                      folio: p.folio || 'Presupuesto', registros })
                  }
                } catch {
                  if (pacienteActualRef.current === pacienteId && getClinicaActivaSync() === clinicaSolicitada) {
                    setErrorPagos('No se pudo consultar el historial de pagos.')
                  }
                }
              }}>Ver pagos</button>}
          </div>
        )
      })}
      {errorHistorial && <p role="alert" className="text-xs text-rose-700">{errorHistorial}</p>}
      {errorPagos && <p role="alert" className="text-xs text-rose-700">{errorPagos}</p>}
      {pagos && pagos.pacienteId === pacienteId && pagos.clinicaId === getClinicaActivaSync() && <section aria-label={`Pagos de ${pagos.folio}`} className="rounded-xl border border-surface p-3 text-xs space-y-2">
        <div className="flex justify-between gap-2"><strong>Pagos de {pagos.folio}</strong>
          <button type="button" className="underline" onClick={() => setPagos(null)}>Cerrar pagos</button></div>
        {pagos.registros.length === 0 && <p>No hay abonos registrados para este presupuesto.</p>}
        {pagos.registros.map((pago) => <p key={pago.id} className="border-t border-surface pt-2">
          {pago.fecha} · ${pago.monto.toLocaleString('es-CL')} · {pago.metodoPago}
          {pago.referencia && <span> · Ref. {pago.referencia}</span>}
        </p>)}
      </section>}
      {historial && historial.pacienteId === pacienteId && historial.clinicaId === getClinicaActivaSync() && <div>
        <button type="button" className="mb-2 text-xs underline" onClick={() => setHistorial(null)}>Cerrar historial</button>
        <HistorialVersiones folioPresupuesto={historial.folio} versiones={historial.versiones} />
      </div>}
      {seleccionado && <ModalRegistrarPago
        totalPresupuesto={Number(seleccionado.montoTotal || 0)}
        saldoPendiente={Math.max(0, Number(seleccionado.montoTotal || 0) - Number(seleccionado.montoAbonado || 0))}
        folioPresupuesto={seleccionado.folio}
        pacienteNombre={seleccionado.pacienteNombre}
        onRegistrarPago={async (pago) => {
          try {
            await pagosService.registrarPagoManual({ pagoId: pago.id, presupuestoId: seleccionado.id, monto: pago.monto, medioPago: pago.medioPago, referencia: pago.referencia })
            if (pagos?.presupuestoId === String(seleccionado.id)) {
              try {
                const registros = await historialPagosPresupuestoService.listar(seleccionado.id, pacienteId)
                setPagos({ ...pagos, registros })
              } catch {
                setErrorPagos('El abono se registró, pero no se pudo actualizar el historial de pagos.')
              }
            }
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
