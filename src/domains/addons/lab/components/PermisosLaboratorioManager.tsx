import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, RefreshCw, Save } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { laboratorioCoreService, type MiembroPermisosLaboratorio } from '../services/laboratorioCoreService'

const OPCIONES = [
  { id: 'ver_costos_laboratorio', titulo: 'Ver costos y márgenes', detalle: 'Consultar los costos del laboratorio y saldos.' },
  { id: 'pagar_laboratorios', titulo: 'Pagar laboratorios', detalle: 'Registrar pagos vinculados a Finanzas.' },
  { id: 'gestionar_laboratorios', titulo: 'Gestionar laboratorios', detalle: 'Editar directorio y tarifario de costos.' },
  { id: 'aprobar_garantias', titulo: 'Aprobar garantías', detalle: 'Resolver reclamos y autorizar reposiciones.' },
  { id: 'configurar_plantillas', titulo: 'Configurar plantillas', detalle: 'Crear y versionar plantillas de trabajo.' }
] as const

const ROL: Record<string, string> = {
  admin: 'Administración', dentista: 'Dentista', asistente: 'Asistente', recepcion: 'Recepción'
}

export interface PermisosLaboratorioManagerProps {
  clinicaId: string | null
  puedeConfigurar: boolean
}

export const PermisosLaboratorioManager: React.FC<PermisosLaboratorioManagerProps> = ({ clinicaId, puedeConfigurar }) => {
  const [miembros, setMiembros] = useState<MiembroPermisosLaboratorio[]>([])
  const [userId, setUserId] = useState('')
  const [permisos, setPermisos] = useState<string[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const miembroActual = useMemo(() => miembros.find(member => member.userId === userId) || null, [miembros, userId])

  const cargar = useCallback(async (): Promise<void> => {
    if (!clinicaId || !puedeConfigurar) return
    setCargando(true)
    setError(null)
    try {
      const lista = await laboratorioCoreService.listarPermisos()
      setMiembros(lista)
      setUserId(current => lista.some(member => member.userId === current) ? current : lista[0]?.userId || '')
    } catch {
      setError('No se pudieron cargar los miembros activos de esta clínica.')
    } finally {
      setCargando(false)
    }
  }, [clinicaId, puedeConfigurar])

  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => { setPermisos(miembroActual?.permisos || []) }, [miembroActual])

  const guardar = async (): Promise<void> => {
    if (!miembroActual) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      await laboratorioCoreService.reemplazarPermisos(miembroActual.userId, permisos)
      setMensaje('Permisos adicionales guardados para esta clínica.')
      await cargar()
    } catch {
      setError('No se pudieron guardar los permisos. El servidor conserva las asignaciones anteriores.')
    } finally {
      setGuardando(false)
    }
  }

  if (!puedeConfigurar) return null

  return (
    <section className="rounded-2xl border border-surface bg-surface p-5 space-y-4" aria-label="Permisos adicionales de laboratorio">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Permisos adicionales de laboratorio</h3>
          <p className="mt-1 text-xs text-muted-foreground">Se suman a los permisos del rol base y solo aplican en la clínica activa.</p>
        </div>
        <Button type="button" variant="outline" size="sm" icon={RefreshCw} loading={cargando} onClick={() => void cargar()}>Actualizar</Button>
      </div>

      {error && <p role="alert" className="text-xs text-clinical-error">{error}</p>}
      {miembros.length === 0 ? <p className="text-sm text-muted-foreground">{cargando ? 'Cargando miembros…' : 'No hay miembros activos disponibles.'}</p> : (
        <>
          <label className="block max-w-xl space-y-1 text-xs font-medium">
            <span>Miembro de la clínica</span>
            <select value={userId} onChange={event => setUserId(event.target.value)} className="w-full min-h-10 rounded-lg border border-surface bg-background px-3">
              {miembros.map(member => <option key={member.userId} value={member.userId}>{ROL[member.rol] || member.rol} · {member.userId.slice(0, 8)}…</option>)}
            </select>
          </label>
          <div className="divide-y divide-surface rounded-xl border border-surface">
            {OPCIONES.map(option => (
              <label key={option.id} className="flex items-start gap-3 p-3 text-xs">
                <input
                  type="checkbox"
                  checked={permisos.includes(option.id)}
                  onChange={event => setPermisos(current => event.target.checked
                    ? [...new Set([...current, option.id])]
                    : current.filter(permission => permission !== option.id))}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{option.titulo}</span>
                  <span className="mt-0.5 block text-muted-foreground">{option.detalle}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">Miembro seleccionado: {miembroActual ? `${ROL[miembroActual.rol] || miembroActual.rol} · ${miembroActual.userId}` : '—'}</p>
            <Button type="button" icon={Save} loading={guardando} disabled={!miembroActual || cargando} onClick={() => void guardar()}>Guardar permisos</Button>
          </div>
          {mensaje && <p role="status" className="text-xs text-clinical-success">{mensaje}</p>}
        </>
      )}
    </section>
  )
}
