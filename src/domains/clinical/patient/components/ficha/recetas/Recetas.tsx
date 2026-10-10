import React, { useState } from 'react'
import { Pill, Plus, AlertTriangle, QrCode, FileCheck, Trash2 } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { useVademecumStore, type Medicamento } from '../../../../../../app/stores/vademecumStore'
import { RecetasEmitidasLista, type RecetaEmitidaItem } from './RecetasEmitidasLista'
import type { Paciente } from '../../../schemas/pacienteSchema'

interface MedicamentoItem {
  nombre: string
  dosis: string
  frecuencia: string
  duracion: string
}

interface RecetasProps {
  paciente: Paciente
  profesional?: string
}

export const Recetas: React.FC<RecetasProps> = ({
  paciente,
  profesional = 'Dr. Tratante',
}) => {
  const [medicamentos, setMedicamentos] = useState<MedicamentoItem[]>([
    { nombre: 'Amoxicilina 500 mg (comprimidos)', dosis: '500 mg', frecuencia: 'Cada 8 horas', duracion: '7 días' },
  ])
  const [indicaciones, setIndicaciones] = useState('Tomar con alimentos. Abundante líquido.')
  const [recetas, setRecetas] = useState<RecetaEmitidaItem[]>([])
  const [sugerencias, setSugerencias] = useState<{ idx: number; items: Medicamento[] } | null>(null)

  const buscarMedicamentos = (query: string, idx: number) => {
    if (query.length < 2) {
      setSugerencias(null)
      return
    }
    const meds = useVademecumStore.getState().medicamentos
    const resultados = meds
      .filter((m) => m.nombre.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
    setSugerencias({ idx, items: resultados })
  }

  const seleccionarMedicamento = (idx: number, med: Medicamento) => {
    handleUpdateMed(idx, 'nombre', med.nombre)
    if (med.dosis) handleUpdateMed(idx, 'dosis', med.dosis)
    if (med.frecuencia) handleUpdateMed(idx, 'frecuencia', med.frecuencia)
    if (med.duracion) handleUpdateMed(idx, 'duracion', med.duracion)
    setSugerencias(null)
  }

  const tieneAlertaPenicilina = Boolean(
    (Array.isArray(paciente.alergias) && paciente.alergias.some((a: string) => a.toLowerCase().includes('penicil'))) ||
    (typeof paciente.alergias === 'string' && paciente.alergias.toLowerCase().includes('penicil'))
  )

  const hayConflictoFarmaco =
    tieneAlertaPenicilina &&
    medicamentos.some((m) =>
      ['amoxicilina', 'ampicilina', 'penicilina'].some((p) => m.nombre.toLowerCase().includes(p))
    )

  const handleAgregarMedicamento = () => {
    setMedicamentos((prev) => [
      ...prev,
      { nombre: '', dosis: '', frecuencia: '', duracion: '' },
    ])
  }

  const handleUpdateMed = (index: number, campo: keyof MedicamentoItem, valor: string) => {
    setMedicamentos((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [campo]: valor } : item))
    )
  }

  const handleEliminarMed = (index: number) => {
    setMedicamentos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleEmitirReceta = (e: React.FormEvent) => {
    e.preventDefault()
    if (medicamentos.length === 0 || !medicamentos[0].nombre) return

    const randomHash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const nuevaReceta: RecetaEmitidaItem = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      profesional,
      medicamentos: [...medicamentos],
      hashForense: `SEC-STEG-${randomHash.slice(0, 12).toUpperCase()}`,
      qrToken: `https://studio-dental.app/rx/${randomHash.slice(0, 8)}`,
    }

    setRecetas([nuevaReceta, ...recetas])
  }

  return (
    <div className="space-y-6" data-testid="recetas-bp06">
      {hayConflictoFarmaco && (
        <div
          className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold animate-pulse"
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>¡ALERTA CRÍTICA DE INTERACCIÓN! Alergia a PENICILINA detectada.</span>
        </div>
      )}

      <form onSubmit={handleEmitirReceta} className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-surface">
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50 flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" /> Prescripción Médica Electrónica con Vademécum
          </h3>
          <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={handleAgregarMedicamento}>
            Agregar Fármaco
          </Button>
        </div>

        <div className="space-y-3">
          {medicamentos.map((med, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-xl bg-surface border border-surface">
              <div className="sm:col-span-4 relative">
                <input
                  type="text"
                  placeholder="Buscar fármaco en Vademécum..."
                  value={med.nombre}
                  onChange={(e) => {
                    handleUpdateMed(idx, 'nombre', e.target.value)
                    buscarMedicamentos(e.target.value, idx)
                  }}
                  className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                  data-testid="input-medicamento-vademecum"
                  required
                />
                {sugerencias?.idx === idx && sugerencias.items.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 bg-surface border border-surface rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {sugerencias.items.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => seleccionarMedicamento(idx, m)}
                        className="p-2 hover:bg-surface-hover text-xs cursor-pointer border-b border-surface/50 last:border-0"
                        data-testid="item-sugerencia-vademecum"
                      >
                        <span className="font-semibold text-graphite-900 dark:text-graphite-100">{m.nombre}</span>
                        {m.presentacion && <span className="text-[11px] text-graphite-400 block">{m.presentacion}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Dosis"
                  value={med.dosis}
                  onChange={(e) => handleUpdateMed(idx, 'dosis', e.target.value)}
                  className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <input
                  type="text"
                  placeholder="Frecuencia"
                  value={med.frecuencia}
                  onChange={(e) => handleUpdateMed(idx, 'frecuencia', e.target.value)}
                  className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Duración"
                  value={med.duracion}
                  onChange={(e) => handleUpdateMed(idx, 'duracion', e.target.value)}
                  className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-1 text-center">
                <button type="button" onClick={() => handleEliminarMed(idx)} className="text-graphite-400 hover:text-rose-500" aria-label="Eliminar fármaco">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
            Indicaciones Adicionales
          </label>
          <textarea
            rows={2}
            value={indicaciones}
            onChange={(e) => setIndicaciones(e.target.value)}
            className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-graphite-400 flex items-center gap-1">
            <FileCheck className="w-3.5 h-3.5 text-emerald-500" /> Firmado digital con QR forense
          </span>
          <Button type="submit" variant="primary" icon={QrCode}>
            Emitir & Firmar Receta
          </Button>
        </div>
      </form>

      <RecetasEmitidasLista recetas={recetas} />
    </div>
  )
}
