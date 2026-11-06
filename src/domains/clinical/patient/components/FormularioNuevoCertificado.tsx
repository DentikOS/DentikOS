import React, { memo, useState } from 'react'
import { ClipboardList, FileText, Bed } from 'lucide-react'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import { obtenerFechaLocalISO } from '../../../../shared/utils/dateUtils'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import type { CertificadoPapelera } from '../services/papeleraCertificadosService'

export interface FormularioNuevoCertificadoProps {
  userProfile?: {
    nombreCompleto?: string
    rut?: string
    especialidad?: string
    [key: string]: unknown
  } | null
  onGenerarCertificado: (nuevoCertificado: CertificadoPapelera) => void
}

/**
 * Formulario para emitir nuevo certificado médico (F6-D-6 refactor)
 * 
 * Componente extraído de CertificadosSection.jsx para respetar el límite
 * arquitectónico de 285 líneas. Encapsula:
 * - Estado del formulario
 * - Lógica de generación de certificados
 * - Renderizado del formulario
 */
export const FormularioNuevoCertificado: React.FC<FormularioNuevoCertificadoProps> = memo(({ userProfile, onGenerarCertificado }) => {
  const [tipoCertificado, setTipoCertificado] = useState('asistencia')
  const { alert: dialogAlert } = useAppDialog()
  const [fechaAtencion, setFechaAtencion] = useState(obtenerFechaLocalISO())
  const [horaInicio, setHoraInicio] = useState('10:00')
  const [horaFin, setHoraFin] = useState('11:00')
  const [diasReposo, setDiasReposo] = useState('1')
  const [diagnosticoMotivo, setDiagnosticoMotivo] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!diagnosticoMotivo) {
      await dialogAlert({
        title: 'Motivo requerido',
        description: 'Por favor ingresa el motivo o diagnóstico de la atención.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    const nuevoCertificado: CertificadoPapelera = {
      id: Date.now(),
      fechaEmision: new Date().toLocaleDateString('es-CL'),
      tipo: tipoCertificado,
      fechaAtencion,
      horaInicio,
      horaFin,
      diasReposo: tipoCertificado === 'reposo' ? diasReposo : undefined,
      diagnosticoMotivo,
      observaciones,
      profesional: userProfile?.nombreCompleto || 'Dr. Miguel Díaz Rodríguez',
      rutProfesional: userProfile?.rut || 'N/I',
      especialidad: userProfile?.especialidad || 'Cirujano Dentista'
    }

    onGenerarCertificado(nuevoCertificado)
    setDiagnosticoMotivo('')
    setObservaciones('')
  }

  return (
    <div className="bg-gray-50 dark:bg-graphite-800 p-5 border border-gray-200 dark:border-graphite-700 rounded-2xl print:hidden">
      <h4 className="font-bold text-xs text-gray-800 dark:text-graphite-100 mb-4 uppercase tracking-wider">Emitir Nuevo Certificado / Constancia Médica</h4>
      
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="flex gap-4">
          <Input
            type="radio"
            name="tipoCert"
            value="asistencia"
            checked={tipoCertificado === 'asistencia'}
            onChange={() => setTipoCertificado('asistencia')}
            className="accent-black"
          />
          <span className="font-bold inline-flex items-center gap-1"><ClipboardList size={12} />Certificado de Asistencia</span>
          <Input
            type="radio"
            name="tipoCert"
            value="reposo"
            checked={tipoCertificado === 'reposo'}
            onChange={() => setTipoCertificado('reposo')}
            className="accent-black"
          />
          <span className="font-bold"><span className="inline-flex items-center gap-1"><Bed size={14} />Certificado de Reposo / Licencia Médica</span></span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-gray-600 dark:text-graphite-400 mb-1 font-semibold">Fecha de Atención</label>
            <Input
              type="date"
              value={fechaAtencion}
              onChange={(e) => setFechaAtencion(e.target.value)}
            />
          </div>

          {tipoCertificado === 'asistencia' ? (
            <>
              <div>
                <label className="block text-gray-600 dark:text-graphite-400 mb-1 font-semibold">Hora Inicio</label>
                <Input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-gray-600 dark:text-graphite-400 mb-1 font-semibold">Hora Término</label>
                <Input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-gray-600 dark:text-graphite-400 mb-1 font-semibold">Días de Reposo Indicados</label>
              <Input
                type="number"
                min="1"
                max="30"
                value={diasReposo}
                onChange={(e) => setDiasReposo(e.target.value)}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-gray-600 dark:text-graphite-400 mb-1 font-semibold">
            {tipoCertificado === 'asistencia' ? 'Procedimiento / Atención Realizada' : 'Diagnóstico Clínico / Causa del Reposo'}
          </label>
          <Input
            type="text"
            placeholder={tipoCertificado === 'asistencia' ? 'Ej: Exodoncia de pieza 3.8 y sutura' : 'Ej: Cirugía de terceros molares e inflamación moderada'}
            value={diagnosticoMotivo}
            onChange={(e) => setDiagnosticoMotivo(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-gray-600 dark:text-graphite-400 mb-1 font-semibold">Observaciones o Indicaciones Adicionales (Opcional)</label>
          <Input
            type="text"
            placeholder="Ej: Se sugiere no realizar actividad física intensa por 48 hrs."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary">
            <span className="inline-flex items-center gap-1"><FileText size={14} />Generar y Guardar Certificado</span>
          </Button>
        </div>
      </form>
    </div>
  )
})

FormularioNuevoCertificado.displayName = 'FormularioNuevoCertificado'
