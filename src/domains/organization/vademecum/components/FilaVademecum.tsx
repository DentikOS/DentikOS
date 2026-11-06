/**
 * Renderizado de una fila de la tabla de vademécum.
 * F4-03f-2 (refactorización)
 */
import React from 'react'
import type { Farmaco } from '../schemas/vademecumSchema'
import type { FarmacoVademecum } from '../../../../infrastructure/clinical-data/vademecumService'

const FAMILIA_COLORS: Record<string, string> = {
  anestesico_amida: 'bg-purple-100 text-purple-800 border-purple-300',
  anestesico_ester: 'bg-purple-100 text-purple-800 border-purple-300',
  anestesico_topico: 'bg-purple-100 text-purple-800 border-purple-300',
  penicilina: 'bg-blue-100 text-blue-800 border-blue-300',
  cefalosporina: 'bg-blue-100 text-blue-800 border-blue-300',
  lincosamida: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  macrolido: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  nitroimidazol: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  quinolona: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  tetraciclina: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  aine: 'bg-orange-100 text-orange-800 border-orange-300',
  cox2: 'bg-orange-100 text-orange-800 border-orange-300',
  paracetamol: 'bg-green-100 text-green-800 border-green-300',
  opioide: 'bg-red-100 text-red-800 border-red-300',
  corticoide: 'bg-pink-100 text-pink-800 border-pink-300',
  antiseptico: 'bg-teal-100 text-teal-800 border-teal-300',
  antifungico: 'bg-teal-100 text-teal-800 border-teal-300',
  antiviral: 'bg-teal-100 text-teal-800 border-teal-300',
  ansiolitico: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  antihistaminico: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  hemostatico: 'bg-amber-100 text-amber-800 border-amber-300',
  protector_gastrico: 'bg-amber-100 text-amber-800 border-amber-300',
  preventivo: 'bg-cyan-100 text-cyan-800 border-cyan-300'
}

export interface FilaVademecumProps {
  farmaco: Farmaco | FarmacoVademecum
  onEditar?: (farmaco: Farmaco | FarmacoVademecum) => void
  onDesactivar?: (farmaco: Farmaco | FarmacoVademecum) => void
  onReactivar?: (farmaco: Farmaco | FarmacoVademecum) => void
}

const PosologiaCelda: React.FC<{ texto?: string }> = ({ texto }) => {
  if (!texto) return <span>-</span>
  if (texto.length <= 110) {
    return <p className="max-w-[18rem] whitespace-normal leading-relaxed">{texto}</p>
  }

  return (
    <div className="max-w-[18rem]">
      <p className="line-clamp-3 whitespace-normal leading-relaxed">{texto}</p>
      <details className="mt-1.5">
        <summary className="cursor-pointer rounded text-xs font-semibold text-primary-foreground underline decoration-primary/50 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:text-gold-satin">
          Leer posología completa
        </summary>
        <p className="mt-2 whitespace-normal break-words text-xs leading-relaxed text-graphite-700 dark:text-graphite-200">
          {texto}
        </p>
      </details>
    </div>
  )
}

export const FilaVademecum: React.FC<FilaVademecumProps> = ({ farmaco, onEditar, onDesactivar, onReactivar }) => {
  return (
    <tr className={`hover:bg-gray-50 dark:hover:bg-graphite-700 ${farmaco.activo === false ? 'opacity-50' : ''}`}>
      <td className="px-3 py-3 text-sm text-gray-700 dark:text-graphite-300 font-mono">
        {farmaco.numero}
      </td>
      <td className="px-3 py-3 text-sm">
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${FAMILIA_COLORS[farmaco.familia] || 'bg-gray-100 dark:bg-graphite-800 text-gray-700 dark:text-graphite-300 border-gray-300 dark:border-graphite-600'}`}>
          {farmaco.familia?.replace(/_/g, ' ') || 'N/D'}
        </span>
      </td>
      <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-graphite-50 max-w-xs truncate" title={farmaco.nombre_generico}>
        {farmaco.nombre_generico}
      </td>
      <td className="px-3 py-3 text-sm text-gray-700 dark:text-graphite-300 max-w-[150px] truncate" title={farmaco.presentacion}>
        {farmaco.presentacion}
      </td>
      <td className="px-3 py-3 align-top text-sm text-gray-700 dark:text-graphite-300">
        <PosologiaCelda texto={farmaco.posologia_adulto} />
      </td>
      <td className="px-3 py-3 align-top text-sm text-gray-700 dark:text-graphite-300">
        <PosologiaCelda texto={farmaco.posologia_pediatrica} />
      </td>
      <td className="px-3 py-3 text-sm">
        {farmaco.activo === false ? (
          <span className="px-2 py-1 bg-gray-100 dark:bg-graphite-800 text-gray-600 dark:text-graphite-400 text-xs font-semibold rounded border border-gray-300 dark:border-graphite-600">
            Inactivo
          </span>
        ) : (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded border border-green-300">
            Activo
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="flex gap-1">
          {onEditar && (
            <button
              onClick={() => onEditar(farmaco)}
              className="min-h-8 rounded-lg border border-graphite-300 bg-white px-2 py-1 text-xs font-medium text-graphite-700 transition-colors duration-150 hover:border-primary hover:bg-gold-light/20 hover:text-graphite-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200 dark:hover:text-graphite-50"
            >
              Editar
            </button>
          )}
          {farmaco.activo !== false && onDesactivar && (
            <button
              onClick={() => onDesactivar(farmaco)}
              className="px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-xs font-medium hover:bg-yellow-100 transition-colors duration-150"
            >
              Desactivar
            </button>
          )}
          {farmaco.activo === false && onReactivar && (
            <button
              onClick={() => onReactivar(farmaco)}
              className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100 transition-colors duration-150"
            >
              Reactivar
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
