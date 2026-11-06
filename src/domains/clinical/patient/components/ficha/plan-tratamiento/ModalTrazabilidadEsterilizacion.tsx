import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, PackageCheck, ShieldAlert } from 'lucide-react'
import { Modal } from '../../../../../../shared/ui/ui/Modal'
import { Button } from '../../../../../../shared/ui/ui/Button'
import {
  esterilizacionCloudService,
  type InstrumentalDisponibleCloud,
  type UsoTratamientoEsterilizacionCloud,
} from '../../../../../operations/sterilization/services/esterilizacionCloudService'

interface ModalTrazabilidadEsterilizacionProps {
  pacienteId: string
  clinicaId: string
  tratamientoRef: string
  descripcionTratamiento: string
  guardando: boolean
  onCerrar: () => void
  onConfirmar: (datos: {
    instrumentoCicloIds: string[]
    idempotencyKey: string
    trazaExistente: boolean
  }) => Promise<void>
}

const crearIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  throw new Error('Este navegador no permite crear una llave segura para la trazabilidad.')
}

export const ModalTrazabilidadEsterilizacion: React.FC<ModalTrazabilidadEsterilizacionProps> = ({
  pacienteId,
  clinicaId,
  tratamientoRef,
  descripcionTratamiento,
  guardando,
  onCerrar,
  onConfirmar,
}) => {
  const idempotencyKeyRef = useRef<string>(crearIdempotencyKey())
  const [cargando, setCargando] = useState(true)
  const [instrumentos, setInstrumentos] = useState<InstrumentalDisponibleCloud[]>([])
  const [usosExistentes, setUsosExistentes] = useState<UsoTratamientoEsterilizacionCloud[]>([])
  const [usuarioId, setUsuarioId] = useState('')
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError('')
    void (async () => {
      try {
        const [usos, actualId] = await Promise.all([
          esterilizacionCloudService.listarUsosTratamiento(pacienteId, tratamientoRef, clinicaId),
          esterilizacionCloudService.usuarioActualId(),
        ])
        if (!vigente) return
        setUsuarioId(actualId)
        setUsosExistentes(usos)
        if (usos.some((uso) => uso.profesional_id !== actualId)) {
          setError('La trazabilidad fue iniciada por otro profesional. Esa misma sesión debe completar el cierre clínico.')
          return
        }
        if (usos.length === 0) {
          setInstrumentos(await esterilizacionCloudService.listarInstrumentalDisponible())
        }
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudo consultar la trazabilidad sincronizada.')
      } finally {
        if (vigente) setCargando(false)
      }
    })()
    return () => { vigente = false }
  }, [pacienteId, tratamientoRef, clinicaId])

  const trazaExistente = usosExistentes.length > 0
  const puedeConfirmar = !cargando && !guardando && !error && Boolean(usuarioId) && (trazaExistente || seleccionados.length > 0)

  const alternarInstrumento = (id: string) => {
    setSeleccionados((actuales) => actuales.includes(id)
      ? actuales.filter((actual) => actual !== id)
      : [...actuales, id])
  }

  return (
    <Modal
      isOpen
      onClose={guardando ? () => {} : onCerrar}
      title="Trazabilidad de instrumental esterilizado"
      size="lg"
      closeOnEscape={!guardando}
      closeOnOverlayClick={!guardando}
      showCloseButton={!guardando}
      aria-label="Registrar la trazabilidad de instrumental para realizar un tratamiento"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-surface bg-surface-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-graphite-500">Tratamiento</p>
          <p className="mt-1 text-sm font-bold text-graphite-900 dark:text-graphite-100">{descripcionTratamiento}</p>
          <p className="mt-1 text-xs text-graphite-500">Paciente: {pacienteId}</p>
        </div>

        {cargando && <div className="flex items-center gap-2 py-6 text-sm text-graphite-600"><Loader2 size={16} className="animate-spin" />Consultando instrumental liberado en DentikOS…</div>}

        {!cargando && trazaExistente && !error && (
          <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">Trazabilidad ya registrada</p>
              <p className="mt-1 text-xs">{usosExistentes.length} instrumento(s) quedaron vinculados a este paciente y tratamiento. Puedes reintentar guardar el cierre sin consumir otro instrumental.</p>
            </div>
          </div>
        )}

        {!cargando && !trazaExistente && !error && (
          <div className="space-y-2">
            <div>
              <p className="text-sm font-bold">Selecciona instrumental liberado</p>
              <p className="text-xs text-graphite-500">Solo aparecen instrumentos de ciclos liberados y disponibles en esta clínica.</p>
            </div>
            {instrumentos.length === 0 ? (
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                <p className="text-sm">No hay instrumental liberado disponible. Registra y libera un ciclo antes de marcar este tratamiento como realizado.</p>
              </div>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {instrumentos.map((instrumento) => {
                  const seleccionado = seleccionados.includes(instrumento.ciclo_instrumento_id)
                  return (
                    <li key={instrumento.ciclo_instrumento_id}>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${seleccionado ? 'border-primary bg-primary/5' : 'border-surface bg-surface'}`}>
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={() => alternarInstrumento(instrumento.ciclo_instrumento_id)}
                          className="mt-1"
                        />
                        <PackageCheck size={17} className="mt-0.5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{instrumento.nombre}{instrumento.codigo ? ` · ${instrumento.codigo}` : ''}</span>
                          <span className="block text-xs text-graphite-500">Lote {instrumento.lote} · {instrumento.programa}</span>
                          {instrumento.numero_serie && <span className="block text-[11px] text-graphite-500">Serie {instrumento.numero_serie}</span>}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-surface pt-4">
          <Button type="button" variant="secondary" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button
            type="button"
            onClick={() => void onConfirmar({
              instrumentoCicloIds: seleccionados,
              idempotencyKey: idempotencyKeyRef.current,
              trazaExistente,
            })}
            disabled={!puedeConfirmar}
          >
            {guardando ? 'Registrando cierre…' : trazaExistente ? 'Completar cierre clínico' : 'Vincular y cerrar tratamiento'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
