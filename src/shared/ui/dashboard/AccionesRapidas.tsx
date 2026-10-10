import React from 'react'
import {
  CalendarPlus,
  UserPlus,
  FileSpreadsheet,
  Search,
  Sparkles,
  Package,
  Plus
} from 'lucide-react'
import { ACCIONES_RAPIDAS_POR_ROL, type AccionRapida } from '../../../application/analytics/dashboard/constants/dashboardConstants'
import { playSound } from '../../utils/soundEffects'

export interface AccionesRapidasProps {
  userRole?: string
  onEjecutarAccion?: (accion: AccionRapida) => void
  onAbrirCommandPalette?: () => void
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  CalendarPlus,
  UserPlus,
  FileSpreadsheet,
  Search,
  Sparkles,
  Package
}

const reproducirMicroClic = () => {
  try {
    playSound('openPalette')
  } catch {
    // Silencioso en caso de bloqueo de audio
  }
}

export const AccionesRapidas: React.FC<AccionesRapidasProps> = ({
  userRole = 'admin',
  onEjecutarAccion,
  onAbrirCommandPalette
}) => {
  const acciones = ACCIONES_RAPIDAS_POR_ROL[userRole] || ACCIONES_RAPIDAS_POR_ROL.admin || []

  const handleClick = (accion: AccionRapida) => {
    reproducirMicroClic()
    if (accion.shortcut === '⌘K' || accion.accion === 'palette') {
      if (onAbrirCommandPalette) {
        onAbrirCommandPalette()
      } else {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
      }
      return
    }
    onEjecutarAccion?.(accion)
  }

  return (
    <div className="pt-4 border-t border-surface-border">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
          Acciones Rápidas
        </h3>
        <span className="hidden sm:inline-block text-[11px] text-slate-400">
          Atajos directos de un solo clic
        </span>
      </div>

      {/* Desktop & Tablet container */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {acciones.map((accion) => {
          const IconComp = ICON_MAP[accion.icono] || Plus
          const esCommand = accion.shortcut === '⌘K'

          return (
            <button
              key={accion.id}
              type="button"
              onClick={() => handleClick(accion)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold text-[#070B14] shadow-xs cursor-pointer select-none transition-all duration-100 hover:brightness-105 active:scale-98 ${
                esCommand ? 'hidden md:flex' : 'flex'
              }`}
              style={{
                background: 'linear-gradient(135deg, #E5C378 0%, #B88E3A 100%)'
              }}
            >
              <IconComp className="w-4 h-4 shrink-0 text-[#070B14]" />
              <span className="truncate">{accion.label}</span>
              {accion.shortcut && (
                <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-black/15 text-[#070B14] rounded font-mono font-bold">
                  {accion.shortcut}
                </kbd>
              )}
            </button>
          )
        })}
      </div>

      {/* Mobile FAB flotante para ⌘K */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => handleClick({ id: 'fab_palette', label: 'Buscar', icono: 'Search', shortcut: '⌘K', accion: 'palette' })}
          className="flex items-center justify-center w-12 h-12 rounded-full shadow-lg text-[#070B14] active:scale-95 transition-all cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #E5C378 0%, #B88E3A 100%)'
          }}
          title="Abrir Búsqueda Rápida (⌘K)"
          aria-label="Abrir Búsqueda Rápida (⌘K)"
        >
          <Search className="w-5 h-5 text-[#070B14]" />
        </button>
      </div>
    </div>
  )
}
