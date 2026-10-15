import React, { useState, useEffect } from 'react'
import { MessageCircle, Phone, Building2, X, Calendar, AlertCircle } from 'lucide-react'
import { Modal } from '../../../../shared/ui/ui/Modal'
import { Button } from '../../../../shared/ui/ui/Button'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { confirmacionWhatsAppService, PLANTILLA_WHATSAPP_OFICIAL, type RegistroConfirmacion } from '../services/confirmacionWhatsAppService'
import type { Cita } from '../schemas/citaSchema'

export interface ModalConfirmacionCitaProps {
  isOpen: boolean
  cita: Cita | null
  alCerrar: () => void
  alConfirmar: (citaId: string | number, tipo: 'telefono' | 'presencial' | 'whatsapp_enviado') => void
  alCancelar: (citaId: string | number, motivo: string) => void
  clinicaNombre?: string
}

const normalizarTelefono = (tel: string): string => {
  const digitos = tel.replace(/\D/g, '')
  if (!digitos) return ''
  return digitos.length <= 9 ? `56${digitos}` : digitos // +56 por defecto (Chile)
}

export const ModalConfirmacionCita: React.FC<ModalConfirmacionCitaProps> = ({
  isOpen, cita, alCerrar, alConfirmar, alCancelar, clinicaNombre = 'Studio Dental'
}) => {
  const { confirm: dialogConfirm, alert: dialogAlert } = useAppDialog()
  const [historial, setHistorial] = useState<RegistroConfirmacion[]>([])

  useEffect(() => {
    if (isOpen && cita) {
      confirmacionWhatsAppService.obtenerHistorialCita?.(cita.id)
        ?.then?.(setHistorial)
        ?.catch?.(() => setHistorial([]))
    }
  }, [isOpen, cita])

  if (!cita) return null

  const fechaFormateada = new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const handleEnviarWhatsApp = async () => {
    const mensaje = PLANTILLA_WHATSAPP_OFICIAL({
      nombrePaciente: cita.pacienteNombre || 'Paciente',
      fecha: fechaFormateada,
      hora: cita.horaInicio,
      profesional: cita.doctor || 'Profesional',
      clinica: clinicaNombre,
    })

    await confirmacionWhatsAppService.registrarConfirmacion({
      appointmentId: cita.id,
      tipo: 'whatsapp_enviado',
      mensajeEnviado: mensaje,
      metadata: { telefono: cita.pacienteTelefono },
    })

    const tel = normalizarTelefono(String(cita.pacienteTelefono || ''))
    if (tel) {
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (!win) {
        await dialogAlert({
          title: 'WhatsApp',
          description: 'El navegador bloqueó la ventana. Copiamos el mensaje al portapapeles.',
          variant: 'warning',
          confirmText: 'Entendido',
        })
        await navigator.clipboard.writeText(mensaje).catch(() => {})
      }
    } else {
      await navigator.clipboard.writeText(mensaje).catch(() => {})
      await dialogAlert({
        title: 'Paciente sin teléfono',
        description: 'El paciente no tiene teléfono registrado. El mensaje oficial fue copiado al portapapeles para enviarlo manualmente.',
        variant: 'warning',
        confirmText: 'Entendido',
      })
    }

    alConfirmar(cita.id, 'whatsapp_enviado')
    alCerrar()
  }

  const handleConfirmarTelefono = async () => {
    await confirmacionWhatsAppService.registrarConfirmacion({
      appointmentId: cita.id,
      tipo: 'telefono',
    })
    alConfirmar(cita.id, 'telefono')
    alCerrar()
  }

  const handleConfirmarPresencial = async () => {
    await confirmacionWhatsAppService.registrarConfirmacion({
      appointmentId: cita.id,
      tipo: 'presencial',
    })
    alConfirmar(cita.id, 'presencial')
    alCerrar()
  }

  const handleCancelarPaciente = async () => {
    const dialogResult = await dialogConfirm({
      title: 'Motivo de cancelación',
      description: 'Indique el motivo por el cual el paciente canceló la cita (opcional).',
      confirmText: 'Registrar cancelación',
      cancelText: 'Volver',
      variant: 'warning',
    } as any)

    const confirmed = typeof dialogResult === 'boolean' ? dialogResult : Boolean((dialogResult as any)?.confirmed ?? dialogResult)
    if (!confirmed) return

    const motivo = typeof dialogResult === 'object' && (dialogResult as any)?.inputValue
      ? (dialogResult as any).inputValue
      : 'Paciente solicitó cancelación'

    await confirmacionWhatsAppService.registrarConfirmacion({
      appointmentId: cita.id,
      tipo: 'cancelacion_paciente',
      motivoCancelacion: motivo,
    })
    alCancelar(cita.id, motivo)
    alCerrar()
  }

  const textoEstado = cita.confirmation_status === 'confirmado'
    ? 'Confirmada'
    : cita.confirmation_status === 'enviado'
    ? 'WhatsApp enviado'
    : 'Pendiente de confirmar'

  return (
    <Modal isOpen={isOpen} onClose={alCerrar} title="Confirmación de Cita">
      <div className="space-y-4 p-1">
        <div className="p-4 rounded-xl bg-surface-muted/50 border border-surface-border">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-[#B88E3A] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-[#0F172A] dark:text-white">
                {cita.pacienteNombre || 'Paciente'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 capitalize mt-0.5">
                {fechaFormateada} · {cita.horaInicio}{cita.horaFin ? ` - ${cita.horaFin}` : ''}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {cita.doctor || 'Sin profesional'} · {cita.boxAsignado || 'Sin box'}
              </p>
              {cita.trataMiento && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {cita.trataMiento}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Estado actual:</span>
          <span className={`px-2 py-0.5 rounded-full font-semibold ${
            cita.confirmation_status === 'confirmado' 
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : cita.confirmation_status === 'enviado'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
          }`}>
            {textoEstado}
          </span>
        </div>

        {historial.length > 0 && (
          <div className="border-t border-surface-border pt-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              Historial de confirmación
            </h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {historial.map((reg) => (
                <div key={reg.id} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="shrink-0 mt-0.5 text-slate-500">
                    {reg.tipo === 'whatsapp_enviado' && <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />}
                    {reg.tipo === 'telefono' && <Phone className="w-3.5 h-3.5 text-blue-600" />}
                    {reg.tipo === 'presencial' && <Building2 className="w-3.5 h-3.5 text-purple-600" />}
                    {reg.tipo === 'cancelacion_paciente' && <X className="w-3.5 h-3.5 text-rose-600" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">
                      {reg.tipo === 'whatsapp_enviado' && 'WhatsApp enviado'}
                      {reg.tipo === 'telefono' && 'Confirmó por teléfono'}
                      {reg.tipo === 'presencial' && 'Confirmó en persona'}
                      {reg.tipo === 'cancelacion_paciente' && `Canceló: ${reg.motivoCancelacion || 'Sin motivo'}`}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(reg.createdAt).toLocaleString('es-CL', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}
                      {reg.registradoPorNombre && ` · ${reg.registradoPorNombre}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-surface-border pt-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
            ¿Cómo confirmar esta cita?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={handleEnviarWhatsApp} className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300">
              <MessageCircle className="w-4 h-4" /><span className="text-xs font-bold">Enviar WhatsApp</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleConfirmarTelefono} className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-300">
              <Phone className="w-4 h-4" /><span className="text-xs font-bold">Confirmé por teléfono</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleConfirmarPresencial} className="flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300">
              <Building2 className="w-4 h-4" /><span className="text-xs font-bold">Confirmó en persona</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCancelarPaciente} className="flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300">
              <X className="w-4 h-4" /><span className="text-xs font-bold">Canceló</span>
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50">
          <AlertCircle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>Importante:</strong> Las confirmaciones automáticas (Add-On DentikOS Connect) están disponibles como funcionalidad premium post-MVP.
          </p>
        </div>
      </div>
    </Modal>
  )
}
