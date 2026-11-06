import React, { useState } from 'react'
import { Users, Trash2, Plus } from 'lucide-react'
import type { MiembroInvitacionOnboarding } from '../types/bootstrapClinica'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

export interface PasoEquipoProps {
  equipo: MiembroInvitacionOnboarding[]
  agregarMiembro: (miembro: MiembroInvitacionOnboarding) => void
  eliminarMiembro: (index: number) => void
}

export const PasoEquipo: React.FC<PasoEquipoProps> = ({
  equipo,
  agregarMiembro,
  eliminarMiembro,
}) => {
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoRol, setNuevoRol] = useState('dentista')

  const handleCrearMiembroManual = () => {
    if (!nuevoEmail.trim()) return
    agregarMiembro({ email: nuevoEmail.trim().toLowerCase(), rol: nuevoRol, sedes: [] })
    setNuevoEmail('')
  }

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-graphite-900 dark:text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-champagne-50 text-champagne-700 dark:bg-gold-satin/10 dark:text-gold-satin"><Users size={16} aria-hidden="true" /></span>
        Invitar colaboradores <span className="text-xs font-normal text-graphite-500 dark:text-graphite-400">(opcional)</span>
      </h3>
      <div className="space-y-2">
        {equipo.map((m, idx) => (
          <div
            key={idx}
            className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-graphite-200 bg-graphite-50/70 p-3 dark:border-graphite-800 dark:bg-graphite-950/50"
          >
            <span className="min-w-0 break-all text-sm text-graphite-700 dark:text-graphite-200">{m.email} <strong className="ml-1 rounded-full bg-champagne-50 px-2 py-0.5 text-xs font-semibold capitalize text-champagne-700 dark:bg-gold-satin/10 dark:text-gold-satin">{m.rol}</strong></span>
            <button
              type="button"
              onClick={() => eliminarMiembro(idx)}
              aria-label={`Eliminar invitación para ${m.email}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-dashed border-graphite-300 bg-graphite-50/50 p-4 dark:border-graphite-700 dark:bg-graphite-950/40">
        <p className="text-sm font-semibold text-graphite-800 dark:text-graphite-200">Agregar invitación</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(140px,1fr)]">
          <Input
            type="email"
            label="Correo electrónico"
            id="bootstrap-equipo-email"
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            placeholder="colega@clinica.cl"
            size="sm"
          />
          <label className="block text-sm font-medium text-graphite-700 dark:text-graphite-300">
            Rol
            <select
              value={nuevoRol}
              onChange={(e) => setNuevoRol(e.target.value)}
              className="mt-1.5 min-h-9 w-full rounded-lg border border-surface bg-surface px-2.5 py-1.5 text-xs text-graphite-900 shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-graphite-50"
            >
              <option value="dentista">Dentista</option>
              <option value="asistente">Asistente</option>
              <option value="recepcion">Recepción</option>
            </select>
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCrearMiembroManual}
          disabled={!nuevoEmail.trim()}
          className="text-xs cursor-pointer"
        >
          <Plus size={14} aria-hidden="true" className="mr-1" /> Agregar invitación
        </Button>
      </div>
    </div>
  )
}
