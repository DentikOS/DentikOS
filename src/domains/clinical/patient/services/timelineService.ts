export interface EventoTimeline {
  id: string
  fecha: string
  tipo: 'evolucion' | 'pago' | 'consentimiento' | 'receta' | 'cita' | 'presupuesto' | 'llamada' | 'email' | 'admin' | string
  titulo: string
  profesional?: string
  detalles?: string
}

const eventosExtra: Record<string, EventoTimeline[]> = {}

export const timelineService = {
  agregarEvento: (pacienteId: string | number, evento: EventoTimeline) => {
    const key = String(pacienteId)
    eventosExtra[key] = [evento, ...(eventosExtra[key] || [])]
  },
  obtenerTimeline: (pacienteId: string | number): EventoTimeline[] => {
    const extra = eventosExtra[String(pacienteId)] || []
    return [
      ...extra,
      {
        id: `tl-1-${pacienteId}`,
        fecha: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        tipo: 'evolucion',
        titulo: 'Evolución Clínica — Control post operatorio',
        profesional: 'Dr. Roberto Gómez',
        detalles: 'Tejidos en franca cicatrización, asintomático.',
      },
      {
        id: `tl-2-${pacienteId}`,
        fecha: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
        tipo: 'pago',
        titulo: 'Abono Recibido — Plan de Rehabilitación',
        profesional: 'Recepción Central',
        detalles: 'Pago confirmado $45.000 vía transferencia bancaria.',
      },
      {
        id: `tl-3-${pacienteId}`,
        fecha: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        tipo: 'consentimiento',
        titulo: 'Consentimiento Firmado — Endodoncia Molar',
        profesional: 'Dr. Roberto Gómez',
        detalles: 'Documento digital firmado con verificación forense SHA-256.',
      },
    ]
  },
}
