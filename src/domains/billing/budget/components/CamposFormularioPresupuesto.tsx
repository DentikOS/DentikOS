/**
 * CamposFormularioPresupuesto — Campos del formulario de presupuesto formal
 * Extraído de ModalNuevoPresupuesto.jsx para cumplir límites de allowlist (F7-25)
 */
import React from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { Tooth } from '../../../../shared/ui/icons/Tooth'
import { Input } from '../../../../shared/ui/ui/Input'
import { X } from 'lucide-react'

import type { PresupuestoItemLocal } from '../services/presupuestosStorageService'

export interface HallazgoOdontograma {
  pieza: string
  diagnostico: string
}

export type ItemSeleccionadoPresupuesto = PresupuestoItemLocal

export interface PacienteFormRef {
  id: string | number
  nombre?: string
  rut?: string
  prevision?: string | null
  [key: string]: unknown
}

export interface PrestacionFormRef {
  id: string | number
  nombre: string
  precio?: number | string
  precioParticular?: number | string
  [key: string]: unknown
}

export interface CamposFormularioPresupuestoProps {
  pacientes: PacienteFormRef[]
  prestaciones: PrestacionFormRef[]
  pacienteId: string | number
  convenio: string
  hallazgosOdontograma: HallazgoOdontograma[]
  piezaDental: string
  prestacionSelId: string
  itemsSeleccionados: ItemSeleccionadoPresupuesto[]
  montoTotal: number
  observacion: string
  setPacienteId: (val: string) => void
  setConvenio: (val: string) => void
  setPiezaDental: (val: string) => void
  setPrestacionSelId: (val: string) => void
  setObservacion: (val: string) => void
  handleImportarHallazgo: (hallazgo: HallazgoOdontograma) => void
  handleAgregarItem: () => void
  handleEliminarItem: (itemId: string | number) => void
}

export const CamposFormularioPresupuesto: React.FC<CamposFormularioPresupuestoProps> = ({
  pacientes,
  prestaciones,
  pacienteId,
  convenio,
  hallazgosOdontograma,
  piezaDental,
  prestacionSelId,
  itemsSeleccionados,
  montoTotal,
  observacion,
  setPacienteId,
  setConvenio,
  setPiezaDental,
  setPrestacionSelId,
  setObservacion,
  handleImportarHallazgo,
  handleAgregarItem,
  handleEliminarItem
}) => {
  return (
    <>
      {/* Selects: Paciente + Convenio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Paciente *
          </label>
          <select
            value={pacienteId}
            onChange={(e) => {
              setPacienteId(e.target.value)
              const pac = pacientes.find((p) => String(p.id) === String(e.target.value))
              if (pac?.prevision) setConvenio(pac.prevision)
            }}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-900 font-bold cursor-pointer dark:text-graphite-100"
          >
            <option value="">-- Seleccionar Paciente --</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.rut})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Convenio / Previsión
          </label>
          <select
            value={convenio}
            onChange={(e) => setConvenio(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-900 font-semibold cursor-pointer dark:text-graphite-100"
          >
            <option value="Particular">Particular</option>
            <option value="Fonasa">Fonasa (-15%)</option>
            <option value="Isapre">Isapre (-20%)</option>
            <option value="Empresa">Convenio Empresa (-25%)</option>
          </select>
        </div>
      </div>

      {/* Precarga rápida desde el Odontograma del paciente */}
      {hallazgosOdontograma.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-xl space-y-1.5">
          <span className="font-bold text-blue-900 dark:text-blue-200 text-[11px] block">
            <span className="flex items-center gap-1.5">
              <Icon icon={Tooth} size="sm" />Hallazgos detectados en Odontograma
            </span>{' '}
            ({hallazgosOdontograma.length}):
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {hallazgosOdontograma.map((h, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleImportarHallazgo(h)}
                className="bg-white dark:bg-graphite-800 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-900 dark:text-blue-200 font-bold px-2 py-1 rounded-lg text-[10px] cursor-pointer transition-colors shadow-2xs"
              >
                + Pieza {h.pieza}: {h.diagnostico}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agregar prestaciones dinámicamente */}
      <div className="bg-gray-50 dark:bg-graphite-800 p-3 rounded-xl border dark:border-graphite-700 space-y-2">
        <label className="block font-bold text-gray-800 dark:text-graphite-100 uppercase text-[10px]">
          Añadir Tratamientos del Arancel
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <div className="sm:col-span-3">
            <Input
              type="text"
              placeholder="Pieza (1.6)"
              value={piezaDental}
              onChange={(e) => setPiezaDental(e.target.value)}
            />
          </div>

          <div className="sm:col-span-6 min-w-0">
            <select
              value={prestacionSelId}
              onChange={(e) => setPrestacionSelId(e.target.value)}
              className="w-full p-2 rounded-lg border dark:border-graphite-600 bg-white dark:bg-graphite-900 font-medium truncate text-xs cursor-pointer dark:text-graphite-100"
            >
              <option value="">-- Seleccionar Prestación --</option>
              {prestaciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ($
                  {(
                    parseFloat(String(p.precioParticular ?? p.precio ?? 0)) || 0
                  ).toLocaleString('es-CL')}
                  )
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={handleAgregarItem}
              className="w-full bg-graphite-900 dark:bg-graphite-100 text-white dark:text-graphite-900 p-2 rounded-lg font-bold hover:bg-graphite-800 dark:hover:bg-graphite-200 transition-colors shadow-xs cursor-pointer"
            >
              + Añadir
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-36 overflow-y-auto pt-1">
          {itemsSeleccionados.map((it) => (
            <div
              key={String(it.id)}
              className="flex justify-between items-center p-2 bg-white dark:bg-graphite-900 border dark:border-graphite-700 rounded-lg"
            >
              <span className="truncate max-w-[280px] dark:text-graphite-100">
                <strong>[{it.pieza ? String(it.pieza) : ''}]</strong> {it.prestacion ? String(it.prestacion) : ''}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-gray-900 dark:text-graphite-100">
                  ${Number(it.valor || 0).toLocaleString('es-CL')}
                </span>
                <button
                  type="button"
                  onClick={() => it.id != null && handleEliminarItem(it.id)}
                  className="text-red-500 font-bold hover:text-red-700 cursor-pointer"
                  aria-label="Eliminar item"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monto Total */}
      <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
        <span className="font-bold text-emerald-900 dark:text-emerald-200 uppercase">
          Monto Total Cotizado:
        </span>
        <span className="text-base font-black text-emerald-900 dark:text-emerald-200">
          ${montoTotal.toLocaleString('es-CL')} CLP
        </span>
      </div>

      {/* Observaciones */}
      <div>
        <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
          Observaciones / Indicaciones Especiales
        </label>
        <textarea
          rows={2}
          placeholder="Ej: Cotización válida por 30 días. Incluye controles postoperatorios..."
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-900 dark:text-graphite-100"
        />
      </div>
    </>
  )
}
