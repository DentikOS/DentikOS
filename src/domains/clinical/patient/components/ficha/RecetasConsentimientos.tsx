import React, { useState } from 'react'
import { Pill, Shield, Camera } from 'lucide-react'
import { Recetas } from './recetas/Recetas'
import { Consentimientos } from './consentimientos/Consentimientos'
import { AdjuntosSection } from './adjuntos/AdjuntosSection'
import type { Paciente } from '../../schemas/pacienteSchema'

interface RecetasConsentimientosProps {
  paciente: Paciente
}

export const RecetasConsentimientos: React.FC<RecetasConsentimientosProps> = ({ paciente }) => {
  const [subTab, setSubTab] = useState<'recetas' | 'consentimientos' | 'adjuntos'>('recetas')

  return (
    <div className="space-y-4" data-testid="recetas-consentimientos-modulo">
      {/* Selector de sub-sección */}
      <div className="flex items-center gap-2 border-b border-surface pb-2">
        <button
          type="button"
          onClick={() => setSubTab('recetas')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            subTab === 'recetas'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface text-graphite-600 dark:text-graphite-300 hover:bg-surface-hover'
          }`}
          data-testid="subtab-recetas"
        >
          <Pill className="w-3.5 h-3.5" />
          <span>Recetas Médicas</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('consentimientos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            subTab === 'consentimientos'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface text-graphite-600 dark:text-graphite-300 hover:bg-surface-hover'
          }`}
          data-testid="subtab-consentimientos"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Consentimientos Informados</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('adjuntos')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            subTab === 'adjuntos'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface text-graphite-600 dark:text-graphite-300 hover:bg-surface-hover'
          }`}
          data-testid="subtab-adjuntos"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Radiografías & Fotos</span>
        </button>
      </div>

      <div>
        {subTab === 'recetas' && <Recetas paciente={paciente} />}
        {subTab === 'consentimientos' && <Consentimientos paciente={paciente} />}
        {subTab === 'adjuntos' && (
          <AdjuntosSection paciente={paciente} pacienteId={String(paciente.id)} />
        )}
      </div>
    </div>
  )
}
