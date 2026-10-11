import React, { memo } from 'react'
import { Printer, X } from 'lucide-react'
import { recetasStorageService, type RecetaLocal } from '../services/recetasStorageService'
import { FormularioNuevaReceta } from './FormularioNuevaReceta'
import { createLogger } from '../../../../infrastructure/logging/logger'
import type { Paciente } from '../schemas/pacienteSchema'

const log = createLogger('RecetasSection')

export interface RecetasSectionProps {
  paciente: Partial<Paciente> & { id: string | number; nombre: string; rut?: string; [key: string]: unknown }
  userProfile?: { nombreCompleto?: string; especialidad?: string; rut?: string; [key: string]: unknown } | null
  alergiasPaciente?: string | null
  recetas: RecetaLocal[]
  setRecetas: React.Dispatch<React.SetStateAction<RecetaLocal[]>> | ((recetas: RecetaLocal[]) => void)
}

/**
 * Sección de Recetas Médicas (F6-D-4 refactor)
 * 
 * Componente padre que renderiza:
 * - FormularioNuevaReceta (extraído para respetar límite de 217 líneas)
 * - Botón de impresión
 * - Documento imprimible con listado de recetas
 */
export const RecetasSection: React.FC<RecetasSectionProps> = memo(({ paciente, userProfile, alergiasPaciente, recetas, setRecetas }) => {
  const handleAgregarReceta = (recetaObj: RecetaLocal): void => {
    const actualizadas = [recetaObj, ...recetas]
    setRecetas(actualizadas)
    // F6-D-4: usar recetasStorageService (Supabase + localStorage)
    recetasStorageService.guardarRecetas(paciente.id, actualizadas).catch(err => {
      log.warn('Error guardando recetas:', err)
    })
  }

  const handleEliminarReceta = (id?: string | number): void => {
    if (id === undefined) return
    const actualizadas = recetas.filter(r => r.id !== id)
    setRecetas(actualizadas)
    // F6-D-4: usar recetasStorageService (Supabase + localStorage)
    recetasStorageService.guardarRecetas(paciente.id, actualizadas).catch(err => {
      log.warn('Error guardando recetas:', err)
    })
  }

  return (
    <div>
      <FormularioNuevaReceta 
        alergiasPaciente={alergiasPaciente} 
        onAgregarReceta={handleAgregarReceta} 
      />

      <div className="flex justify-end mb-4 print:hidden">
        <button onClick={() => window.print()} className="bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-800 shadow-sm transition-colors duration-150">
          <span className="flex items-center gap-1"><Printer size={14} />Imprimir Receta</span>
        </button>
      </div>

      <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-8 print:border-none print:p-0">
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-graphite-50">{userProfile?.nombreCompleto || 'Dr. Miguel Díaz Rodríguez'}</h1>
            <p className="text-xs text-gray-600 dark:text-graphite-400">{userProfile?.especialidad || 'Cirujano Dentista'} | RUT: {userProfile?.rut || 'N/I'}</p>
            <p className="text-xs text-gray-500 dark:text-graphite-400">Consulta Odontológica</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-gray-800 dark:text-graphite-100 uppercase">Receta Médica</h2>
            <p className="text-xs text-gray-500 dark:text-graphite-400">Fecha: {new Date().toLocaleDateString('es-CL')}</p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 dark:border-graphite-700 mb-6 text-xs grid grid-cols-2 gap-2 print:bg-white dark:bg-graphite-800 print:border">
          <p><span className="font-bold">Paciente:</span> {paciente.nombre}</p>
          <p><span className="font-bold">RUT:</span> {paciente.rut}</p>
        </div>

        <div className="space-y-4">
          {recetas.map((r, i) => (
            <div key={r.id ?? i} className="p-4 border rounded-xl bg-gray-50 print:bg-white dark:bg-graphite-800 print:border-b">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-sm text-gray-900 dark:text-graphite-50 block">{i + 1}. {r.medicamento}</span>
                  <p className="text-xs text-gray-700 dark:text-graphite-300 mt-1"><span className="font-semibold">Indicación:</span> {r.indicacion}</p>
                </div>
                <button onClick={() => handleEliminarReceta(r.id)} className="text-red-500 font-bold print:hidden"><X className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {recetas.length === 0 && <p className="text-xs text-gray-400 dark:text-graphite-500 text-center py-6">No hay recetas prescritas para este paciente.</p>}
        </div>

        <div className="hidden print:block mt-24 pt-10 border-t border-gray-300 dark:border-graphite-600 text-center">
          <div className="w-64 mx-auto border-t border-black pt-2">
            <p className="font-bold text-xs">{userProfile?.nombreCompleto}</p>
            <p className="text-[10px] text-gray-600 dark:text-graphite-400">Firma y Timbre Médico</p>
          </div>
        </div>
      </div>
    </div>
  )
})

RecetasSection.displayName = 'RecetasSection'
