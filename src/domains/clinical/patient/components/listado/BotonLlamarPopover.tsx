import React, { useState } from 'react'
import { Phone, Copy, Check } from 'lucide-react'
import { timelineService } from '../../services/timelineService'
import { notificationService } from '../../../../../infrastructure/notification/notificationService'
import type { Paciente } from '../../schemas/pacienteSchema'

interface BotonLlamarPopoverProps {
  paciente: Paciente
  telefono?: string | number | null
  esEnlaceTexto?: boolean
}

export const BotonLlamarPopover: React.FC<BotonLlamarPopoverProps> = ({
  paciente,
  telefono,
  esEnlaceTexto = false,
}) => {
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const telStr = telefono ? String(telefono).trim() : ''

  const registrarLlamada = () => {
    const ahora = new Date()
    const fecha = ahora.toLocaleDateString('es-CL')
    const hora = ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    const nombre = paciente.nombre || paciente.nombreCompleto || 'Paciente'

    timelineService.agregarEvento(paciente.id, {
      id: crypto.randomUUID(),
      fecha: ahora.toISOString(),
      tipo: 'llamada',
      titulo: `${fecha} ${hora} · Llamada saliente a ${nombre}`,
    })
    notificationService.mostrar(`Llamada registrada en timeline para ${nombre}`, { tipo: 'info' })
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!telStr) {
      notificationService.mostrar('Paciente sin teléfono registrado', { tipo: 'warning' })
      return
    }

    const esMovil = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
    if (esMovil) {
      registrarLlamada()
      window.location.href = `tel:${telStr.replace(/\s+/g, '')}`
    } else {
      setAbierto((prev) => !prev)
    }
  }

  const handleCopiar = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(telStr)
    }
    setCopiado(true)
    registrarLlamada()
    setTimeout(() => {
      setCopiado(false)
      setAbierto(false)
    }, 1200)
  }

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      {esEnlaceTexto ? (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 text-primary hover:underline font-mono text-xs cursor-pointer"
          title="Llamar paciente"
          data-testid={`tel-link-${paciente.id}`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>{telStr || 'Sin teléfono'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="p-1.5 rounded-lg text-graphite-500 hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          title="Llamar paciente"
          aria-label="Llamar"
          data-testid={`btn-llamar-${paciente.id}`}
        >
          <Phone className="w-4 h-4" />
        </button>
      )}

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div
            className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 z-50 p-3 bg-surface border border-surface rounded-2xl shadow-xl w-52 text-xs animate-in fade-in zoom-in-95 backdrop-blur-md"
            data-testid={`popover-llamada-${paciente.id}`}
          >
            <p className="font-semibold text-graphite-900 dark:text-graphite-50 mb-1">Click-to-call</p>
            <p className="font-mono text-graphite-600 dark:text-graphite-300 text-xs mb-2.5 p-1.5 bg-surface-hover rounded-lg">
              {telStr}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleCopiar}
                className="flex-1 py-1.5 px-2 bg-primary text-white rounded-lg font-bold flex items-center justify-center gap-1 text-[11px] cursor-pointer"
              >
                {copiado ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
              <a
                href={`tel:${telStr.replace(/\s+/g, '')}`}
                onClick={() => {
                  registrarLlamada()
                  setAbierto(false)
                }}
                className="py-1.5 px-2 bg-surface-hover border border-surface rounded-lg text-graphite-700 dark:text-graphite-200 font-bold flex items-center justify-center text-[11px]"
              >
                Marcar
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
