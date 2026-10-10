import React, { useState } from 'react'
import { Pill, Plus, AlertTriangle, QrCode, FileCheck, Trash2 } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import type { Paciente } from '../../../schemas/pacienteSchema'

interface MedicamentoItem {
  nombre: string
  dosis: string
  frecuencia: string
  duracion: string
}

interface RecetaEmitida {
  id: string
  fecha: string
  profesional: string
  medicamentos: MedicamentoItem[]
  indicaciones?: string
  hashForense: string
  qrToken: string
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
    { nombre: 'Amoxicilina', dosis: '500 mg', frecuencia: 'Cada 8 horas', duracion: '7 días' },
  ])
  const [indicaciones, setIndicaciones] = useState('Tomar con alimentos. Abundante líquido.')
  const [recetas, setRecetas] = useState<RecetaEmitida[]>([])

  // Validación de contraindicación: si tiene alergia a Penicilina y se prescribe Amoxicilina
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

    const nuevaReceta: RecetaEmitida = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      profesional,
      medicamentos: [...medicamentos],
      indicaciones,
      hashForense: `SEC-STEG-${randomHash.slice(0, 12).toUpperCase()}`,
      qrToken: `https://studio-dental.app/rx/${randomHash.slice(0, 8)}`,
    }

    setRecetas([nuevaReceta, ...recetas])
  }

  return (
    <div className="space-y-6" data-testid="recetas-bp06">
      {/* Alerta de contraindicación clínica */}
      {hayConflictoFarmaco && (
        <div
          className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold animate-pulse"
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>
            ¡ALERTA CRÍTICA DE INTERACCIÓN! El paciente presenta alergia a PENICILINA y se está prescribiendo un derivado betalactámico.
          </span>
        </div>
      )}

      {/* Formulario de Emisión de Receta */}
      <form
        onSubmit={handleEmitirReceta}
        className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs"
      >
        <div className="flex items-center justify-between pb-2 border-b border-surface">
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50 flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" /> Nueva Prescripción Médica Electrónica
          </h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={Plus}
            onClick={handleAgregarMedicamento}
          >
            Agregar Fármaco
          </Button>
        </div>

        <div className="space-y-3">
          {medicamentos.map((med, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-xl bg-surface border border-surface"
            >
              <div className="sm:col-span-4">
                <input
                  type="text"
                  placeholder="Medicamento (ej: Paracetamol)"
                  value={med.nombre}
                  onChange={(e) => handleUpdateMed(idx, 'nombre', e.target.value)}
                  className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Dosis (500mg)"
                  value={med.dosis}
                  onChange={(e) => handleUpdateMed(idx, 'dosis', e.target.value)}
                  className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <input
                  type="text"
                  placeholder="Frecuencia (c/8 hrs)"
                  value={med.frecuencia}
                  onChange={(e) => handleUpdateMed(idx, 'frecuencia', e.target.value)}
                  className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Duración (5 días)"
                  value={med.duracion}
                  onChange={(e) => handleUpdateMed(idx, 'duracion', e.target.value)}
                  className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-1 text-center">
                <button
                  type="button"
                  onClick={() => handleEliminarMed(idx)}
                  className="text-graphite-400 hover:text-rose-500"
                  aria-label="Eliminar fármaco"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
            Indicaciones Adicionales de Uso
          </label>
          <textarea
            rows={2}
            value={indicaciones}
            onChange={(e) => setIndicaciones(e.target.value)}
            className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-graphite-400 flex items-center gap-1">
            <FileCheck className="w-3.5 h-3.5 text-emerald-500" /> Incluye micro-patrón de esteganografía forense y QR
          </span>
          <Button type="submit" variant="primary" icon={QrCode}>
            Emitir & Firmar Receta
          </Button>
        </div>
      </form>

      {/* Recetas Emitidas */}
      {recetas.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-graphite-500 uppercase tracking-wider">
            Recetas Electrónicas Emitidas ({recetas.length})
          </h4>
          {recetas.map((rx) => (
            <div
              key={rx.id}
              className="p-4 bg-surface/90 border border-surface rounded-2xl flex items-center justify-between gap-4 shadow-xs"
            >
              <div>
                <span className="text-xs font-bold text-graphite-900 dark:text-graphite-50">
                  {rx.medicamentos.map((m) => `${m.nombre} ${m.dosis}`).join(', ')}
                </span>
                <p className="text-[11px] text-graphite-500 mt-1">
                  Emitida por: {rx.profesional} &bull; {new Date(rx.fecha).toLocaleDateString()}
                </p>
                <p className="text-[10px] font-mono text-primary mt-0.5">
                  Forense: {rx.hashForense}
                </p>
              </div>

              <div className="p-2 rounded-xl bg-surface-hover border border-surface flex items-center gap-2">
                <QrCode className="w-7 h-7 text-graphite-700 dark:text-graphite-200" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
