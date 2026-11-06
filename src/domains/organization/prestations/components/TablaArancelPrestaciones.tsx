import React, { memo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { formatearImporteDocumento, type IdiomaDocumento, type MonedaDocumento } from '../../../../shared/utils/formatoDocumento'
import type { Prestacion } from '../services/prestacionesStorageService'

export interface TablaArancelPrestacionesProps {
  prestaciones: Prestacion[]
  moneda?: MonedaDocumento
  idioma?: IdiomaDocumento
  onEditar: (prestacion: Prestacion) => void
  onEliminar: (id: string | number) => void
}

export const TablaArancelPrestaciones: React.FC<TablaArancelPrestacionesProps> = memo(({
  prestaciones,
  moneda = 'CLP',
  idioma = 'es-CL',
  onEditar,
  onEliminar
}) => {
  if (prestaciones.length === 0) {
    return (
      <div className="p-10 text-center text-xs text-gray-400 dark:text-graphite-500 bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl">
        No se encontraron procedimientos en el arancel para los filtros seleccionados.
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl overflow-hidden shadow-xs text-xs">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-graphite-800 border-b border-gray-200 dark:border-graphite-700 text-gray-700 dark:text-graphite-300 font-bold uppercase text-[10px]">
            <th className="p-3">Código interno</th>
            <th className="p-3">Código Fonasa</th>
            <th className="p-3">Nombre del Procedimiento / Prestación</th>
            <th className="p-3">Categoría</th>
            <th className="p-3">Especialidad Clínica</th>
            <th className="p-3 text-right">Precio base ({moneda})</th>
            <th className="p-3 text-right print:hidden">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-graphite-800">
          {prestaciones.map((p) => (
            <tr
              key={String(p.id)}
              className="hover:bg-gray-50 dark:hover:bg-graphite-700 transition-colors"
            >
              <td className="p-3 font-mono font-bold text-gray-500 dark:text-graphite-400">{p.codigoInterno || <span className="text-gray-300">—</span>}</td>
              <td className="p-3 font-mono font-bold text-gray-500 dark:text-graphite-400">
                {p.codigoFonasa ? (
                  <span className="bg-gray-100 dark:bg-graphite-800 px-2 py-0.5 rounded border border-gray-300 dark:border-graphite-600">
                    {p.codigoFonasa}
                  </span>
                ) : (
                  <span className="text-gray-300">N/A</span>
                )}
              </td>

              <td className="p-3 font-extrabold text-gray-900 dark:text-graphite-50">{p.nombre}</td>

              <td className="p-3 text-gray-600 dark:text-graphite-300">{p.categoria || <span className="text-gray-300">—</span>}</td>

              <td className="p-3 font-semibold text-purple-900">
                <span className="bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                  {p.especialidad || 'General'}
                </span>
              </td>

              <td className="p-3 text-right font-black text-emerald-900 text-sm">
                {formatearImporteDocumento(Number(p.precioParticular ?? p.precio ?? 0), moneda, idioma)}
              </td>

              <td className="p-3 text-right print:hidden space-x-1">
                <button
                  onClick={() => onEditar(p)}
                  className="p-1.5 text-gray-600 dark:text-graphite-400 hover:text-black font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-graphite-700 cursor-pointer"
                  title="Editar prestación"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => onEliminar(p.id)}
                  className="p-1.5 text-red-500 hover:text-red-700 font-semibold rounded-lg hover:bg-red-50 cursor-pointer"
                  title="Eliminar prestación"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

TablaArancelPrestaciones.displayName = 'TablaArancelPrestaciones'
