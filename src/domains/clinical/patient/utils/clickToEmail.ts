import { timelineService } from '../services/timelineService'
import { notificationService } from '../../../../infrastructure/notification/notificationService'

export const ejecutarClickToEmail = (
  email: string | undefined | null,
  pacienteId: string | number,
  nombreClinica = 'Studio Dental'
): void => {
  if (!email) return
  const subject = encodeURIComponent(`Consulta dental - ${nombreClinica}`)
  timelineService.agregarEvento(pacienteId, {
    id: crypto.randomUUID(),
    fecha: new Date().toISOString(),
    tipo: 'email',
    titulo: 'Email enviado',
  })
  notificationService.mostrar('Email registrado en timeline', { tipo: 'info' })
  window.location.href = `mailto:${email}?subject=${subject}`
}
