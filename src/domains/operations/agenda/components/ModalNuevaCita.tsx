import React, { memo, useState, useMemo } from 'react'
import { Plus, User, Zap, ShieldAlert } from 'lucide-react'
import { Icon } from '../../../../shared/ui/Icon'
import { SILLONES_DENTALES } from '../constants/agendaConstants'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { CamposFormularioCita } from './CamposFormularioCita'
import { RecurrenciaForm } from './RecurrenciaForm'
import { generarCitasRecurrencia, validarConflictosRecurrencia } from '../../../../shared/utils/recurrenciaUtils'
import { confirmarConflictosRecurrencia } from '../utils/validarConflictosRecurrencia'
import { validarConflictoCitaUnica } from '../utils/validarConflictoCitaUnica'
import { usePacientesStore } from '../../../../app/stores/pacientesStore'
import type { Cita } from '../schemas/citaSchema'
import type { Paciente } from '../../../../domains/clinical/patient/schemas/pacienteSchema'

export interface ModalNuevaCitaProps {
  pacientes?: (Paciente & { apellido?: string; nombreCompleto?: string })[]
  fechaPredeterminada?: string
  alGuardar: (cita: Cita, autoCrearFicha?: boolean) => void
  alCerrar: () => void
  citasExistentes?: Cita[]
}

export const ModalNuevaCita: React.FC<ModalNuevaCitaProps> = memo(({
  pacientes = [],
  fechaPredeterminada,
  alGuardar,
  alCerrar,
  citasExistentes = []
}) => {
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

  // F7-27: Estados de recurrencia
  const [recurrencia, setRecurrencia] = useState<'ninguna' | 'semanal' | 'mensual' | 'anual'>('ninguna')
  const [frecuencia, setFrecuencia] = useState<number>(1)
  const [diaSemana, setDiaSemana] = useState<number>(1) // 0=Dom, 1=Lun, ..., 6=Sáb
  const [diaMes, setDiaMes] = useState<number>(1) // 1-31
  const [fechaFin, setFechaFin] = useState<string>('')
  const [numInstancias, setNumInstancias] = useState<number>(4)

  const { alert: dialogAlert, confirm: dialogConfirm } = useAppDialog()

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

    // F7-27: Si hay recurrencia, generar citas futuras
    if (recurrencia !== 'ninguna' && proximasCitas.length > 0) {
      const citaPadreId = Date.now()
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
        fecha,
        horaInicio,
        horaFin: horaFinCalculada,
        duracionMinutos: duracionNum,
        observaciones,
        estado: 'Agendado',
        recurrencia,
        frecuencia,
        diaSemana,
        diaMes,
        fechaFin: fechaFin || undefined,
        citaPadreId: null, // Es la cita original
      })

      // Citas recurrentes generadas
      proximasCitas.forEach((citaRec) => {
        citasAGuardar.push({
          id: Date.now() + Math.random() * 1000,
          pacienteId: pacienteSeleccionadoId || `express_${Date.now()}`,
          pacienteNombre,
          pacienteTelefono,
          pacienteRut,
          trataMiento: tratamiento,
          boxAsignado,
          fecha: citaRec.fecha,
          horaInicio,
          horaFin: horaFinCalculada,
          duracionMinutos: duracionNum,
          observaciones,
          estado: 'Agendado',
          recurrencia: 'ninguna', // Las instancias generadas no son recurrentes
          citaPadreId: citaPadreId,
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
      citasAGuardar.forEach((cita, index) => {
        alGuardar(cita, index === 0 && esPacienteExpress ? autoCrearFicha : false)
      })

      dialogAlert({
        title: 'Citas recurrentes agendadas',
        description: `Se agendaron ${citasAGuardar.length} citas (${recurrencia}). La primera es el ${fecha}.`,
        variant: 'success',
        confirmText: 'Entendido'
      })
    } else {
      // Cita única (sin recurrencia)
      const citaUnica: Cita = {
        id: Date.now(),
        pacienteId: pacienteSeleccionadoId || `express_${Date.now()}`,
        pacienteNombre,
        pacienteTelefono,
        pacienteRut,
        trataMiento: tratamiento,
        boxAsignado,
        fecha,
        horaInicio,
        horaFin: horaFinCalculada,
        duracionMinutos: duracionNum,
        observaciones,
        estado: 'Agendado'
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
      title="Agendar cita médica"
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
        <CamposFormularioCita
          pacientes={listaPacientes}
          sillonesDentales={SILLONES_DENTALES}
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

        {/* F7-27: Formulario de recurrencia */}
        <RecurrenciaForm
          recurrencia={recurrencia}
          setRecurrencia={(rec: string) => setRecurrencia(rec as 'ninguna' | 'semanal' | 'mensual' | 'anual')}
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

        {/* Botones */}
        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-graphite-700">
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
            Confirmar cita
          </Button>
        </div>
      </form>
    </Modal>
  )
})

ModalNuevaCita.displayName = 'ModalNuevaCita'
