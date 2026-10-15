import React, { memo, useState, useMemo, useEffect } from 'react'
import { Plus, User, Zap, ShieldAlert, AlertCircle, Trash2 } from 'lucide-react'
import { Icon } from '../../../../shared/ui/Icon'
import { SILLONES_DENTALES, calcularDuracionRecomendada } from '../constants/agendaConstants'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { CamposFormularioCita } from './CamposFormularioCita'
import { RecurrenciaForm } from './RecurrenciaForm'
import {
  generarCitasRecurrencia,
  validarConflictosRecurrencia,
  type TipoRecurrencia
} from '../../../../shared/utils/recurrenciaUtils'
import { generarRecurrenceGroupId } from '../services/recurrenciaService'
import { confirmarConflictosRecurrencia } from '../utils/validarConflictosRecurrencia'
import { validarConflictoCitaUnica } from '../utils/validarConflictoCitaUnica'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import { usePrestacionesStore } from '../../../../app/stores/prestacionesStore'
import { usePermisosAgenda } from '../utils/permisosAgenda'
import { clinicConfigService } from '../services/clinicConfigService'
import { agendaConfigService, type DoctorAgenda } from '../services/agendaConfigService'
import type { Cita } from '../schemas/citaSchema'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

export interface ModalNuevaCitaProps {
  pacientes?: (Paciente & { apellido?: string; nombreCompleto?: string })[]
  fechaPredeterminada?: string
  alGuardar: (cita: Cita, autoCrearFicha?: boolean) => void
  alCerrar: () => void
  citasExistentes?: Cita[]
  citaAEditar?: Cita | null
  onEliminar?: (cita: Cita) => void
}

export const ModalNuevaCita: React.FC<ModalNuevaCitaProps> = memo(({
  pacientes = [],
  fechaPredeterminada,
  alGuardar,
  alCerrar,
  citasExistentes = [],
  citaAEditar,
  onEliminar,
}) => {
  const permisos = usePermisosAgenda()

  // Validar permiso al montar (aunque el botón ya está condicionado, es doble check)
  useEffect(() => {
    if (!permisos.crearCitas) {
      console.warn('Usuario sin permiso de crear citas')
      alCerrar()
    }
  }, [permisos.crearCitas, alCerrar])

  const [esPacienteExpress, setEsPacienteExpress] = useState<boolean>(false)
  const [pacienteSeleccionadoId, setPacienteSeleccionadoId] = useState<string>('')
  
  const [pacienteNombre, setPacienteNombre] = useState<string>('')
  const [pacienteTelefono, setPacienteTelefono] = useState<string>('')
  const [pacienteRut, setPacienteRut] = useState<string>('')
  const [autoCrearFicha, setAutoCrearFicha] = useState<boolean>(true)

  const [tratamiento, setTratamiento] = useState<string>('Evaluación / Diagnóstico Inicial')
  const [boxAsignado, setBoxAsignado] = useState<string>(SILLONES_DENTALES[0]?.nombre || 'Sillón 1 - Odontología General')
  const [fecha, setFecha] = useState<string>(fechaPredeterminada || obtenerFechaLocalISO())
  const [horaInicio, setHoraInicio] = useState<string>('09:00')
  const [duracionMinutos, setDuracionMinutos] = useState<number | string>(30)
  const [observaciones, setObservaciones] = useState<string>('')
  const [esUrgencia, setEsUrgencia] = useState<boolean>(false)

  const [doctores, setDoctores] = useState<DoctorAgenda[]>([])
  const [doctorSeleccionadoId, setDoctorSeleccionadoId] = useState<string>('')
  const [doctorSeleccionadoNombre, setDoctorSeleccionadoNombre] = useState<string>('')

  useEffect(() => {
    let activo = true
    agendaConfigService.obtenerDoctoresAgenda()
      .then((docs) => {
        if (!activo) return
        setDoctores(docs || [])
        if (docs?.length === 1) {
          setDoctorSeleccionadoId(docs[0].userId)
          setDoctorSeleccionadoNombre(docs[0].nombreCompleto)
        }
      })
      .catch(() => {
        if (activo) setDoctores([])
      })
    return () => { activo = false }
  }, [])

  const [esDiaFestivo, setEsDiaFestivo] = useState(false)
  const [nombreFestivo, setNombreFestivo] = useState('')

  useEffect(() => {
    const validar = async () => {
      const resultado = await clinicConfigService.esDiaFestivo(fecha)
      setEsDiaFestivo(resultado.esFestivo)
      setNombreFestivo(resultado.nombre || '')
    }
    if (fecha) validar()
  }, [fecha])

  useEffect(() => {
    const handleUrgencia = () => {
      setEsUrgencia(true)
      setTratamiento('Atención de Urgencia Dental')
    }
    window.addEventListener('nueva_cita_urgencia', handleUrgencia)
    return () => window.removeEventListener('nueva_cita_urgencia', handleUrgencia)
  }, [])

  useEffect(() => {
    if (citaAEditar) {
      setPacienteNombre(citaAEditar.pacienteNombre || '')
      setPacienteTelefono(String(citaAEditar.pacienteTelefono || ''))
      setPacienteRut(citaAEditar.pacienteRut || '')
      setPacienteSeleccionadoId(citaAEditar.pacienteId ? String(citaAEditar.pacienteId) : '')
      setFecha(citaAEditar.fecha || obtenerFechaLocalISO())
      setHoraInicio(citaAEditar.horaInicio || '09:00')
      setDuracionMinutos(Number(citaAEditar.duracionMinutos) || 30)
      setTratamiento(citaAEditar.trataMiento || citaAEditar.motivo || 'Evaluación / Diagnóstico Inicial')
      if (citaAEditar.boxAsignado) setBoxAsignado(citaAEditar.boxAsignado)
      if (citaAEditar.observaciones) setObservaciones(citaAEditar.observaciones)
      if (citaAEditar.doctor) setDoctorSeleccionadoNombre(citaAEditar.doctor)
      if (citaAEditar.doctorId) setDoctorSeleccionadoId(String(citaAEditar.doctorId))
      if (citaAEditar.esUrgencia) setEsUrgencia(true)
    }
  }, [citaAEditar])

  // F7-27 & BP05 §07: Estados de recurrencia
  const [recurrencia, setRecurrencia] = useState<TipoRecurrencia>('ninguna')
  const [frecuencia, setFrecuencia] = useState<number>(1)
  const [diaSemana, setDiaSemana] = useState<number>(1) // 0=Dom, 1=Lun, ..., 6=Sáb
  const [diaMes, setDiaMes] = useState<number>(1) // 1-31
  const [fechaFin, setFechaFin] = useState<string>('')
  const [numInstancias, setNumInstancias] = useState<number>(4)

  const { alert: dialogAlert, confirm: dialogConfirm } = useAppDialog()

  const [prestacionSeleccionadaId, setPrestacionSeleccionadaId] = useState<string>('')
  const prestaciones = usePrestacionesStore((s) => s.prestaciones || s.prestacionesArancel || [])
  const pacientesStore = usePacientesStore((s) => s.pacientes)
  const listaPacientes = pacientes.length > 0 ? pacientes : pacientesStore
  const [alertaBloqueo, setAlertaBloqueo] = useState<{ mensaje: string; accion: string } | null>(null)

  const handleSelectPacienteChange = (e: { target: { value: string } }): void => {
    const pId = e.target.value
    setPacienteSeleccionadoId(pId)

    if (!pId) {
      setPacienteNombre('')
      setPacienteTelefono('')
      setPacienteRut('')
      setAlertaBloqueo(null)
      return
    }

    const pEncontrado = listaPacientes.find(p => String(p.id) === String(pId))
    if (pEncontrado) {
      if (pEncontrado.estado === 'bloqueado' || (pEncontrado as unknown as { bloqueado?: boolean }).bloqueado) {
        setAlertaBloqueo({
          mensaje: `Paciente bloqueado · Motivo: ${(pEncontrado as unknown as { motivoBloqueo?: string }).motivoBloqueo || 'No especificado'}`,
          accion: 'Contactar Admin',
        })
      } else {
        setAlertaBloqueo(null)
      }

      const nombreCompleto = `${pEncontrado.nombre || ''} ${pEncontrado.apellido || ''}`.trim() || pEncontrado.nombreCompleto || ''
      setPacienteNombre(nombreCompleto)
      setPacienteTelefono(pEncontrado.telefono ? String(pEncontrado.telefono) : '')
      setPacienteRut(pEncontrado.rut || '')
    }
  }

  const horaFinCalculada = useMemo(() => {
    if (!horaInicio) return '09:30'
    const [h, m] = horaInicio.split(':').map(Number)
    const inicioMin = h * 60 + m
    const finMin = inicioMin + (typeof duracionMinutos === 'number' ? duracionMinutos : parseInt(duracionMinutos, 10))
    const hFin = String(Math.floor(finMin / 60) % 24).padStart(2, '0')
    const mFin = String(finMin % 60).padStart(2, '0')
    return `${hFin}:${mFin}`
  }, [horaInicio, duracionMinutos])

  // BP05 §02: Precargar duración inteligente según prestación seleccionada
  useEffect(() => {
    if (!prestacionSeleccionadaId) return
    const prestacion = prestaciones.find(p => String(p.id) === String(prestacionSeleccionadaId))
    if (prestacion) {
      const duracionRecomendada = calcularDuracionRecomendada(prestacion)
      setDuracionMinutos(duracionRecomendada)
      // También actualizar tratamiento si no fue editado manualmente
      if (prestacion.nombre && (tratamiento === 'Evaluación / Diagnóstico Inicial' || !tratamiento)) {
        setTratamiento(prestacion.nombre)
      }
    }
  }, [prestacionSeleccionadaId, prestaciones, tratamiento])

  // F7-27: Calcular próximas citas de recurrencia (preview)
  const proximasCitas = useMemo(() => {
    if (recurrencia === 'ninguna') return []

    const citaBase = {
      id: 'preview',
      fecha,
      horaInicio,
      recurrencia,
      frecuencia,
      diaSemana,
      diaMes,
      fechaFin: fechaFin || undefined,
    }

    return generarCitasRecurrencia(citaBase, numInstancias)
  }, [recurrencia, fecha, horaInicio, frecuencia, diaSemana, diaMes, fechaFin, numInstancias])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()

    if (alertaBloqueo) return

    if (!pacienteNombre.trim()) {
      await dialogAlert({
        title: 'Paciente requerido',
        description: 'Por favor selecciona o ingresa un paciente.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    const duracionNum = typeof duracionMinutos === 'number' ? duracionMinutos : parseInt(duracionMinutos, 10)

    // F7-27 & BP05 §07: Si hay recurrencia, generar citas futuras
    if (recurrencia !== 'ninguna' && proximasCitas.length > 0) {
      const citaPadreId = Date.now()
      const recurrenceGroupId = generarRecurrenceGroupId()
      const citasAGuardar: Cita[] = []

      // Cita original (la primera)
      citasAGuardar.push({
        id: citaPadreId,
        pacienteId: pacienteSeleccionadoId || `express_${Date.now()}`,
        pacienteNombre,
        pacienteTelefono,
        pacienteRut,
        trataMiento: tratamiento,
        boxAsignado,
        doctor: doctorSeleccionadoNombre || undefined,
        doctorId: doctorSeleccionadoId || undefined,
        fecha,
        horaInicio,
        horaFin: horaFinCalculada,
        duracionMinutos: duracionNum,
        observaciones,
        estado: 'Pendiente',
        recurrencia,
        frecuencia,
        diaSemana,
        diaMes,
        fechaFin: fechaFin || undefined,
        recurrence_group_id: recurrenceGroupId,
        citaPadreId: null, // Es la cita original
      })

      // Citas recurrentes generadas
      proximasCitas.forEach((citaRec, index) => {
        citasAGuardar.push({
          id: Date.now() + index + 1,
          pacienteId: pacienteSeleccionadoId || `express_${Date.now()}`,
          pacienteNombre,
          pacienteTelefono,
          pacienteRut,
          trataMiento: tratamiento,
          boxAsignado,
          doctor: doctorSeleccionadoNombre || undefined,
          doctorId: doctorSeleccionadoId || undefined,
          fecha: citaRec.fecha,
          horaInicio,
          horaFin: horaFinCalculada,
          duracionMinutos: duracionNum,
          observaciones,
          estado: 'Pendiente',
          recurrencia: 'ninguna', // Las instancias generadas son independientes
          citaPadreId: citaPadreId,
          recurrence_group_id: recurrenceGroupId,
        })
      })

      const puedeContinuar = await confirmarConflictosRecurrencia(
        citasAGuardar,
        citasExistentes,
        (c, e) => validarConflictosRecurrencia(c, e as Record<string, unknown>[]),
        dialogConfirm
      )
      if (!puedeContinuar) {
        return
      }

      // Guardar todas las citas
      for (const cita of citasAGuardar) {
        await alGuardar(cita, citasAGuardar.indexOf(cita) === 0 && esPacienteExpress ? autoCrearFicha : false)
      }

      await dialogAlert({
        title: 'Serie de citas creada',
        description: `Se agendaron ${citasAGuardar.length} citas (${recurrencia}). La primera es el ${fecha}.`,
        variant: 'success',
        confirmText: 'Entendido'
      })

      alCerrar()
      return
    } else {
      // Cita única (sin recurrencia)
      const citaUnica: Cita = {
        id: citaAEditar ? citaAEditar.id : Date.now(),
        pacienteId: pacienteSeleccionadoId || citaAEditar?.pacienteId || `express_${Date.now()}`,
        pacienteNombre,
        pacienteTelefono,
        pacienteRut,
        trataMiento: tratamiento,
        motivo: esUrgencia ? 'Urgencia' : tratamiento,
        boxAsignado,
        doctor: doctorSeleccionadoNombre || undefined,
        doctorId: doctorSeleccionadoId || undefined,
        fecha,
        horaInicio,
        horaFin: horaFinCalculada,
        duracionMinutos: duracionNum,
        observaciones,
        estado: citaAEditar ? citaAEditar.estado : 'Pendiente',
        esUrgencia: esUrgencia || undefined,
      }

      // F7-27 fix: validar conflictos antes de guardar cita única
      const puedeContinuar = await validarConflictoCitaUnica(
        citaUnica,
        citasExistentes,
        (c, e) => validarConflictosRecurrencia(c, e as Record<string, unknown>[]),
        dialogConfirm
      )
      if (!puedeContinuar) {
        return
      }

      alGuardar(citaUnica, esPacienteExpress ? autoCrearFicha : false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={alCerrar}
      title={citaAEditar ? 'Editar cita' : 'Agendar cita médica'}
      size="lg"
    >
      <p className="text-[11px] text-graphite-500 dark:text-graphite-400 mb-4">
        Selección directa de paciente registrado o registro express.
      </p>

      {/* Toggle Modo Paciente */}
      <div className="flex bg-gray-100 dark:bg-graphite-800 p-1 rounded-xl gap-1 mb-4">
        <button
          type="button"
          onClick={() => {
            setEsPacienteExpress(false)
            setPacienteSeleccionadoId('')
            setPacienteNombre('')
            setAlertaBloqueo(null)
          }}
          className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            !esPacienteExpress ? 'bg-graphite-900 dark:bg-graphite-100 text-white dark:text-graphite-900 shadow-xs' : 'text-gray-600 dark:text-graphite-400 hover:text-graphite-900 dark:hover:text-graphite-100'
          }`}
        >
          <Icon icon={User} size="xs" /> Paciente Registrado ({listaPacientes.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setEsPacienteExpress(true)
            setPacienteSeleccionadoId('')
            setPacienteNombre('')
            setPacienteTelefono('')
            setAlertaBloqueo(null)
          }}
          className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            esPacienteExpress ? 'bg-graphite-900 dark:bg-graphite-100 text-white dark:text-graphite-900 shadow-xs' : 'text-gray-600 dark:text-graphite-400 hover:text-graphite-900 dark:hover:text-graphite-100'
          }`}
        >
          <Icon icon={Zap} size="xs" /> Paciente Nuevo / Express
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {/* Selector de Doctor (BP05 §03 - Multi-doctor) */}
        <div>
          <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300 mb-1">
            Profesional asignado {doctores.length > 0 && <span className="text-graphite-400">({doctores.length} disponibles)</span>}
          </label>
          {doctores.length === 0 ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
              ⚠️ No hay profesionales configurados. Ve a &quot;Horarios&quot; para agregar doctores.
            </p>
          ) : (
            <select
              value={doctorSeleccionadoId}
              onChange={(e) => {
                const id = e.target.value
                setDoctorSeleccionadoId(id)
                const doc = doctores.find(d => d.userId === id)
                setDoctorSeleccionadoNombre(doc?.nombreCompleto || '')
              }}
              className="w-full p-2.5 rounded-xl border border-graphite-300 dark:border-graphite-600 font-semibold bg-graphite-50 dark:bg-graphite-900 focus:bg-white dark:focus:bg-graphite-800 dark:text-graphite-100 text-xs"
              aria-label="Profesional asignado"
            >
              <option value="">Sin asignar</option>
              {doctores.map((doc) => (
                <option key={doc.userId} value={doc.userId}>
                  {doc.nombreCompleto} {doc.especialidad ? `— ${doc.especialidad}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <CamposFormularioCita
          pacientes={listaPacientes}
          sillonesDentales={SILLONES_DENTALES}
          prestaciones={prestaciones}
          prestacionSeleccionadaId={prestacionSeleccionadaId}
          setPrestacionSeleccionadaId={setPrestacionSeleccionadaId}
          esPacienteExpress={esPacienteExpress}
          pacienteSeleccionadoId={pacienteSeleccionadoId}
          pacienteNombre={pacienteNombre}
          pacienteTelefono={pacienteTelefono}
          pacienteRut={pacienteRut}
          autoCrearFicha={autoCrearFicha}
          tratamiento={tratamiento}
          boxAsignado={boxAsignado}
          fecha={fecha}
          horaInicio={horaInicio}
          horaFinCalculada={horaFinCalculada}
          duracionMinutos={duracionMinutos}
          observaciones={observaciones}
          setPacienteSeleccionadoId={setPacienteSeleccionadoId}
          setPacienteNombre={setPacienteNombre}
          setPacienteTelefono={setPacienteTelefono}
          setPacienteRut={setPacienteRut}
          setAutoCrearFicha={setAutoCrearFicha}
          setTratamiento={setTratamiento}
          setBoxAsignado={setBoxAsignado}
          setFecha={setFecha}
          setHoraInicio={setHoraInicio}
          setDuracionMinutos={setDuracionMinutos}
          setObservaciones={setObservaciones}
          handleSelectPacienteChange={handleSelectPacienteChange}
        />

        {alertaBloqueo && (
          <div className="flex items-center gap-3 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl" data-testid="alerta-paciente-bloqueado">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
                {alertaBloqueo.mensaje}
              </p>
            </div>
            <Button variant="secondary" size="sm" type="button" onClick={() => setAlertaBloqueo(null)}>
              {alertaBloqueo.accion}
            </Button>
          </div>
        )}

        {/* F7-27 & BP05 §07: Formulario de recurrencia */}
        <RecurrenciaForm
          recurrencia={recurrencia}
          setRecurrencia={(rec: string) => setRecurrencia(rec as TipoRecurrencia)}
          frecuencia={frecuencia}
          setFrecuencia={setFrecuencia}
          diaSemana={diaSemana}
          setDiaSemana={setDiaSemana}
          diaMes={diaMes}
          setDiaMes={setDiaMes}
          fechaFin={fechaFin}
          setFechaFin={setFechaFin}
          numInstancias={numInstancias}
          setNumInstancias={setNumInstancias}
          proximasCitas={proximasCitas}
          fechaMinima={fecha}
        />

        {esDiaFestivo && (
          <div className="p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-rose-900 dark:text-rose-200">
                Día festivo: {nombreFestivo}
              </p>
              <p className="text-[10px] text-rose-800 dark:text-rose-300 mt-0.5">
                ¿Confirmar agendar de todas formas?
              </p>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-graphite-700">
          <div>
            {citaAEditar && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => onEliminar?.(citaAEditar)}
              >
                Eliminar cita
              </Button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={alCerrar}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={Plus}
              disabled={Boolean(alertaBloqueo)}
              data-testid="btn-confirmar-cita"
            >
              {citaAEditar ? 'Guardar cambios' : 'Confirmar cita'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevaCita.displayName = 'ModalNuevaCita'
