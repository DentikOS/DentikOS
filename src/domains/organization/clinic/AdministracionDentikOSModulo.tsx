import React, { useState } from 'react'
import { Building2, MapPin, Users, Stethoscope, ShieldCheck, Plus, Pencil, ArchiveRestore, Clock3, AlertCircle } from 'lucide-react'
import { DatosClinicaForm } from './components/DatosClinicaForm'
import { GestionMiembrosModulo } from '../team/GestionMiembrosModulo'
import { PrestacionesModulo } from '../prestations/PrestacionesModulo'
import { RespaldoDatosSection } from '../../../infrastructure/persistence/components/RespaldoDatosSection'
import { useSedes } from './hooks/useSedes'
import { Button } from '../../../shared/ui/ui/Button'
import type { PerfilUsuario } from '../../../infrastructure/auth/authService'
import { useSesionStore } from '../../../app/stores/sesionStore'
import { sedeSchema, type HorarioSede, type Sede } from './schemas/sedeSchema'
import { clinicStorageService } from './services/clinicStorageService'
import { GestionBoxesClinicos } from './components/GestionBoxesClinicos'

export interface AdministracionDentikOSProps {
  userProfile?: PerfilUsuario | null
}

type TabAdmin = 'practica' | 'sedes' | 'equipo' | 'prestaciones' | 'avanzado'

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const IDS_DIA_SEMANA = [1, 2, 3, 4, 5, 6, 0]
const NOMBRE_DIA_POR_ID = Object.fromEntries(IDS_DIA_SEMANA.map((id, index) => [id, DIAS_SEMANA[index]])) as Record<number, string>

const horarioCerradoInicial = (): HorarioSede[] => IDS_DIA_SEMANA.map((diaSemana) => ({
  diaSemana,
  cerrado: true,
}))

const sedeVacia = (zonaHoraria = 'America/Santiago'): Omit<Sede, 'id'> => ({
  nombre: '', direccion: '', comuna: '', region: '', telefono: '', email: '',
  zonaHoraria, horariosAtencion: horarioCerradoInicial(),
  estado: 'activa', activa: true,
})

const resumenHorario = (horarios: HorarioSede[] = []): string => {
  const abiertos = horarios.filter((horario) => !horario.cerrado && horario.horaApertura && horario.horaCierre)
  if (abiertos.length === 0) return 'Horario sin configurar'
  return abiertos.map((horario) => `${NOMBRE_DIA_POR_ID[horario.diaSemana]?.slice(0, 3)} ${horario.horaApertura}-${horario.horaCierre}`).join(' · ')
}

export const AdministracionDentikOSModulo: React.FC<AdministracionDentikOSProps> = ({ userProfile }) => {
  const [tabActiva, setTabActiva] = useState<TabAdmin>('practica')
  const { sedes, sedeActiva, agregarSede, editarSede, eliminarSede, cargando, errorSincronizacion } = useSedes()
  const perfilSesion = useSesionStore((state) => state.userProfile)
  const rol = (userProfile?.rol || perfilSesion?.rol || '').toLowerCase()
  const puedeAdministrarSedes = rol === 'admin'
  const zonaHorariaClinica = clinicStorageService.obtenerClinica()?.zonaHoraria || 'America/Santiago'
  const [sedeEnEdicion, setSedeEnEdicion] = useState<string | null>(null)
  const [formSede, setFormSede] = useState<Omit<Sede, 'id'>>(() => sedeVacia(zonaHorariaClinica))
  const [guardandoSede, setGuardandoSede] = useState(false)
  const [errorSede, setErrorSede] = useState<string | null>(null)

  const abrirEdicion = (sede: Sede) => {
    setSedeEnEdicion(sede.id || null)
    const datos = {
      ...sede,
      zonaHoraria: sede.zonaHoraria || zonaHorariaClinica,
      horariosAtencion: sede.horariosAtencion?.length === 7 ? sede.horariosAtencion : horarioCerradoInicial(),
    }
    delete (datos as Partial<Sede>).id
    setFormSede(datos)
    setErrorSede(null)
  }

  const cancelarEdicion = () => {
    setSedeEnEdicion(null)
    setFormSede(sedeVacia(zonaHorariaClinica))
    setErrorSede(null)
  }

  const handleGuardarSede = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!puedeAdministrarSedes || guardandoSede) return
    const datos = {
      ...formSede,
      nombre: formSede.nombre.trim(),
      direccion: formSede.direccion.trim(),
      comuna: formSede.comuna.trim(),
      region: formSede.region.trim(),
      telefono: formSede.telefono?.trim() || '',
      email: formSede.email?.trim() || '',
      activa: formSede.estado === 'activa',
    }
    const validacion = sedeSchema.safeParse(datos)
    if (!validacion.success) {
      setErrorSede(validacion.error.issues[0]?.message || 'Revisa los datos de la sucursal.')
      return
    }
    setGuardandoSede(true)
    setErrorSede(null)
    try {
      if (sedeEnEdicion) await editarSede(sedeEnEdicion, validacion.data)
      else await agregarSede(validacion.data)
      cancelarEdicion()
    } catch (error: unknown) {
      setErrorSede(error instanceof Error ? error.message : 'No se pudo guardar la sucursal.')
    } finally {
      setGuardandoSede(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header del Módulo */}
      <div className="bg-surface border border-surface rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-graphite-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="text-[#D4AF37]" size={26} />
            <span>Administración DentikOS</span>
          </h1>
          <p className="text-xs text-graphite-500 dark:text-slate-400 mt-1">
            Control maestro de práctica clínica, sedes operativas, equipo humano, aranceles y respaldo avanzado.
          </p>
        </div>

        {/* Tabs de Navegación */}
        <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl border border-surface text-xs">
          <button
            type="button"
            onClick={() => setTabActiva('practica')}
            className={`py-1.5 px-3 rounded-lg font-medium transition flex items-center gap-1.5 ${
              tabActiva === 'practica' ? 'bg-white dark:bg-slate-800 text-[#D4AF37] font-semibold shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 size={13} /> <span>Mi Clínica</span>
          </button>
          <button
            type="button"
            onClick={() => setTabActiva('sedes')}
            className={`py-1.5 px-3 rounded-lg font-medium transition flex items-center gap-1.5 ${
              tabActiva === 'sedes' ? 'bg-white dark:bg-slate-800 text-[#D4AF37] font-semibold shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin size={13} /> <span>Sedes</span>
          </button>
          <button
            type="button"
            onClick={() => setTabActiva('equipo')}
            className={`py-1.5 px-3 rounded-lg font-medium transition flex items-center gap-1.5 ${
              tabActiva === 'equipo' ? 'bg-white dark:bg-slate-800 text-[#D4AF37] font-semibold shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={13} /> <span>Equipo</span>
          </button>
          <button
            type="button"
            onClick={() => setTabActiva('prestaciones')}
            className={`py-1.5 px-3 rounded-lg font-medium transition flex items-center gap-1.5 ${
              tabActiva === 'prestaciones' ? 'bg-white dark:bg-slate-800 text-[#D4AF37] font-semibold shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Stethoscope size={13} /> <span>Prestaciones</span>
          </button>
          <button
            type="button"
            onClick={() => setTabActiva('avanzado')}
            className={`py-1.5 px-3 rounded-lg font-medium transition flex items-center gap-1.5 ${
              tabActiva === 'avanzado' ? 'bg-white dark:bg-slate-800 text-[#D4AF37] font-semibold shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck size={13} /> <span>Avanzado</span>
          </button>
        </div>
      </div>

      {/* Contenido según Tab */}
      {tabActiva === 'practica' && (
        <DatosClinicaForm userProfile={userProfile} />
      )}

      {tabActiva === 'sedes' && (
        <div className="bg-surface border border-surface rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-surface pb-3">
            <h2 className="text-base font-bold text-graphite-900 dark:text-white">Gestión de Sedes DentikOS</h2>
            <p className="text-xs text-graphite-500 dark:text-slate-400">Datos, horarios y estado de cada sucursal. Los boxes se configuran en el siguiente módulo.</p>
          </div>

          {errorSincronizacion && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{errorSincronizacion}</span>
            </div>
          )}
          {cargando && <p className="text-xs text-graphite-500 dark:text-slate-400">Sincronizando sucursales…</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sedes.map((s) => (
              <article key={s.id || s.nombre} className="p-4 rounded-xl border border-surface bg-gray-50/50 dark:bg-slate-900/50 text-xs">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-graphite-900 dark:text-white flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#D4AF37]" /> {s.nombre}
                    </h3>
                    <p className="text-graphite-600 dark:text-slate-300 mt-1">{s.direccion}</p>
                    <p className="text-graphite-400 dark:text-slate-500 text-[11px]">{s.comuna}, {s.region}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${s.estado === 'activa' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : s.estado === 'remodelacion' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                    {s.estado === 'remodelacion' ? 'En remodelación' : s.estado === 'inactiva' ? 'Inactiva' : 'Activa'}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-[11px] text-graphite-500 dark:text-slate-400">
                  {s.telefono && <p>Teléfono: {s.telefono}</p>}
                  {s.email && <p>Email: {s.email}</p>}
                  <p className="flex items-start gap-1.5"><Clock3 size={12} className="mt-0.5 shrink-0" /> {resumenHorario(s.horariosAtencion)}</p>
                  <p>Zona horaria: {s.zonaHoraria || 'America/Santiago'}</p>
                </div>
                {puedeAdministrarSedes && s.id && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-surface pt-3">
                    <Button type="button" size="sm" variant="outline" className="text-[11px]" onClick={() => abrirEdicion(s)}>
                      <Pencil size={13} className="mr-1" /> Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-[11px]"
                      disabled={guardandoSede}
                      onClick={() => {
                        if (s.estado === 'activa') {
                          void eliminarSede(s.id!).then((ok) => {
                            if (!ok) setErrorSede(errorSincronizacion || 'No se pudo desactivar la sucursal.')
                          })
                        } else {
                          void editarSede(s.id!, { estado: 'activa', activa: true }).catch((error: unknown) => {
                            setErrorSede(error instanceof Error ? error.message : 'No se pudo activar la sucursal.')
                          })
                        }
                      }}
                    >
                      <ArchiveRestore size={13} className="mr-1" /> {s.estado === 'activa' ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                )}
              </article>
            ))}
            {sedes.length === 0 && !cargando && (
              <p className="col-span-full rounded-lg bg-gray-50 p-4 text-xs text-graphite-500 dark:bg-slate-900 dark:text-slate-400">Todavía no hay sucursales registradas.</p>
            )}
          </div>

          <GestionBoxesClinicos sede={sedeActiva} puedeAdministrar={puedeAdministrarSedes} />

          {puedeAdministrarSedes ? (
            <form onSubmit={handleGuardarSede} className="border border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-graphite-800 dark:text-slate-200">{sedeEnEdicion ? 'Editar sucursal' : 'Agregar nueva sucursal'}</h3>
                {sedeEnEdicion && <button type="button" onClick={cancelarEdicion} className="text-[11px] text-graphite-500 hover:text-graphite-900 dark:hover:text-white">Cancelar edición</button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <input type="text" required minLength={2} maxLength={100} placeholder="Nombre de sucursal" value={formSede.nombre} onChange={(e) => setFormSede((prev) => ({ ...prev, nombre: e.target.value }))} className="p-2 rounded-lg border border-surface bg-white dark:bg-slate-900" />
                <input type="text" required minLength={5} maxLength={240} placeholder="Dirección completa" value={formSede.direccion} onChange={(e) => setFormSede((prev) => ({ ...prev, direccion: e.target.value }))} className="p-2 rounded-lg border border-surface bg-white dark:bg-slate-900" />
                <input type="text" required minLength={2} maxLength={120} placeholder="Comuna" value={formSede.comuna} onChange={(e) => setFormSede((prev) => ({ ...prev, comuna: e.target.value }))} className="p-2 rounded-lg border border-surface bg-white dark:bg-slate-900" />
                <input type="text" required minLength={2} maxLength={120} placeholder="Región" value={formSede.region} onChange={(e) => setFormSede((prev) => ({ ...prev, region: e.target.value }))} className="p-2 rounded-lg border border-surface bg-white dark:bg-slate-900" />
                <input type="tel" required minLength={3} maxLength={40} placeholder="Teléfono de la sucursal" value={formSede.telefono || ''} onChange={(e) => setFormSede((prev) => ({ ...prev, telefono: e.target.value }))} className="p-2 rounded-lg border border-surface bg-white dark:bg-slate-900" />
                <input type="email" maxLength={254} placeholder="Email de la sucursal (opcional)" value={formSede.email || ''} onChange={(e) => setFormSede((prev) => ({ ...prev, email: e.target.value }))} className="p-2 rounded-lg border border-surface bg-white dark:bg-slate-900" />
                <input type="text" required placeholder="Zona horaria IANA (ej. America/Santiago)" value={formSede.zonaHoraria || zonaHorariaClinica} onChange={(e) => setFormSede((prev) => ({ ...prev, zonaHoraria: e.target.value }))} className="p-2 rounded-lg border border-surface bg-white dark:bg-slate-900" />
                <select value={formSede.estado || 'activa'} onChange={(e) => setFormSede((prev) => ({ ...prev, estado: e.target.value as Sede['estado'], activa: e.target.value === 'activa' }))} className="p-2 rounded-lg border border-surface bg-white dark:bg-slate-900">
                  <option value="activa">Activa</option>
                  <option value="inactiva">Inactiva</option>
                  <option value="remodelacion">En remodelación</option>
                </select>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-graphite-800 dark:text-slate-200">Horario de atención</legend>
                <div className="space-y-2">
                  {DIAS_SEMANA.map((dia, indiceDia) => {
                    const diaSemana = IDS_DIA_SEMANA[indiceDia]
                    const horario = formSede.horariosAtencion?.find((item) => item.diaSemana === diaSemana) || { diaSemana, cerrado: true }
                    const actualizarHorario = (cambios: Partial<HorarioSede>) => setFormSede((prev) => {
                      const horarios = prev.horariosAtencion || []
                      const otros = horarios.filter((item) => item.diaSemana !== diaSemana)
                      return { ...prev, horariosAtencion: [...otros, { ...horario, ...cambios }].sort((a, b) => a.diaSemana - b.diaSemana) }
                    })
                    return (
                      <div key={dia} className="grid grid-cols-[minmax(88px,1fr)_auto_1fr_1fr] items-center gap-2 text-[11px]">
                        <span>{dia}</span>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={!horario.cerrado} onChange={(e) => actualizarHorario({ cerrado: !e.target.checked })} />Abierto</label>
                        <input aria-label={`${dia} apertura`} type="time" disabled={horario.cerrado} value={horario.horaApertura || ''} onChange={(e) => actualizarHorario({ horaApertura: e.target.value })} className="min-w-0 p-1.5 rounded border border-surface bg-white disabled:opacity-50 dark:bg-slate-900" />
                        <input aria-label={`${dia} cierre`} type="time" disabled={horario.cerrado} value={horario.horaCierre || ''} onChange={(e) => actualizarHorario({ horaCierre: e.target.value })} className="min-w-0 p-1.5 rounded border border-surface bg-white disabled:opacity-50 dark:bg-slate-900" />
                      </div>
                    )
                  })}
                </div>
              </fieldset>

              {errorSede && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{errorSede}</p>}
              <Button type="submit" size="sm" variant="primary" disabled={guardandoSede} className="text-xs">
                {sedeEnEdicion ? <Pencil size={14} className="mr-1" /> : <Plus size={14} className="mr-1" />}
                {guardandoSede ? 'Guardando…' : sedeEnEdicion ? 'Guardar cambios' : 'Registrar sucursal'}
              </Button>
            </form>
          ) : (
            <p className="text-xs text-graphite-500 dark:text-slate-400">Solo administración clínica puede registrar o modificar sucursales.</p>
          )}
        </div>
      )}

      {tabActiva === 'equipo' && (
        <GestionMiembrosModulo />
      )}

      {tabActiva === 'prestaciones' && (
        <PrestacionesModulo />
      )}

      {tabActiva === 'avanzado' && (
        <div className="space-y-4">
          <RespaldoDatosSection />
          <div className="p-4 rounded-xl border border-surface bg-surface text-xs text-graphite-500 dark:text-slate-400">
            <h4 className="font-semibold text-graphite-900 dark:text-white mb-1">Auditoría y Seguridad</h4>
            <p>Todas las mutaciones críticas quedan registradas en el log criptográfico audit_log según Ley 19.628.</p>
          </div>
        </div>
      )}
    </div>
  )
}
