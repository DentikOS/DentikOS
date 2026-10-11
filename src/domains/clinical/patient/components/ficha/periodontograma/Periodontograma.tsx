import React, { useState, useEffect } from 'react'
import { Activity, Save, Check, FileText } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'

export interface CodigoEPBDef {
  codigo: '0' | '1' | '2' | '3' | '4' | '*'
  titulo: string
  criterio: string
  color: string
}

export const CODIGOS_EPB: CodigoEPBDef[] = [
  { codigo: '0', titulo: 'Sano', criterio: 'Profundidad <3.5mm, sin cálculo ni sangrado', color: 'bg-emerald-500 text-white' },
  { codigo: '1', titulo: 'Sangrado', criterio: 'Profundidad <3.5mm, sin cálculo, CON sangrado', color: 'bg-yellow-500 text-slate-900' },
  { codigo: '2', titulo: 'Cálculo', criterio: 'Profundidad <3.5mm, CON cálculo / márgenes', color: 'bg-amber-500 text-white' },
  { codigo: '3', titulo: 'Bolsa Leve/Mod', criterio: 'Profundidad 3.5mm - 5.5mm', color: 'bg-orange-500 text-white' },
  { codigo: '4', titulo: 'Bolsa Severa', criterio: 'Profundidad >5.5mm', color: 'bg-rose-600 text-white' },
  { codigo: '*', titulo: 'Furcación', criterio: 'Compromiso furcación Grado 2-3 / Movilidad', color: 'bg-purple-600 text-white' },
]

export const SEXTANTES_CONFIG = [
  { id: 'S1', nombre: 'Sextante 1: Sup. Derecho', piezas: '18 - 14' },
  { id: 'S2', nombre: 'Sextante 2: Sup. Anterior', piezas: '13 - 23' },
  { id: 'S3', nombre: 'Sextante 3: Sup. Izquierdo', piezas: '24 - 28' },
  { id: 'S4', nombre: 'Sextante 4: Inf. Izquierdo', piezas: '38 - 34' },
  { id: 'S5', nombre: 'Sextante 5: Inf. Anterior', piezas: '33 - 43' },
  { id: 'S6', nombre: 'Sextante 6: Inf. Derecho', piezas: '44 - 48' },
]

interface PeriodontogramaProps {
  pacienteId?: string
  onGuardar?: (datos: { sextantes: Record<string, string>; observaciones: string }) => void
}

export const Periodontograma: React.FC<PeriodontogramaProps> = ({ pacienteId, onGuardar }) => {
  const [sextantes, setSextantes] = useState<Record<string, string>>({
    S1: '0', S2: '0', S3: '0', S4: '0', S5: '0', S6: '0',
  })
  const [observaciones, setObservaciones] = useState<string>('')
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    if (!pacienteId) return
    fichasClinicasStorageService.obtenerFichaClinica(pacienteId).then((ficha) => {
      if (ficha?.periodontograma && typeof ficha.periodontograma === 'object') {
        const p = ficha.periodontograma as { sextantes?: Record<string, string>; observaciones?: string }
        if (p.sextantes) setSextantes(p.sextantes)
        if (p.observaciones) setObservaciones(p.observaciones)
      }
    })
  }, [pacienteId])

  const handleSeleccionarCodigo = (sextanteId: string, codigo: string) => {
    setSextantes((prev) => ({ ...prev, [sextanteId]: codigo }))
  }

  const handleGuardar = async () => {
    const payload = { sextantes, observaciones, fecha: new Date().toISOString() }
    if (pacienteId) {
      await fichasClinicasStorageService.guardarSeccionFicha(pacienteId, 'periodontograma', payload)
    }
    onGuardar?.(payload)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  return (
    <div className="space-y-5" data-testid="periodontograma-bp06">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-surface/90 border border-surface rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Examen Periodontal Básico (EPB por 6 Sextantes)
            </h3>
            <p className="text-xs text-graphite-500">
              Evaluación estandarizada por sextantes: Códigos 0 a 4 y * para furcaciones.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="primary"
          icon={guardado ? Check : Save}
          onClick={handleGuardar}
          data-testid="btn-guardar-epb"
        >
          {guardado ? 'Guardado en Supabase' : 'Guardar EPB'}
        </Button>
      </div>

      {/* Grid de los 6 Sextantes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-sextantes-epb">
        {SEXTANTES_CONFIG.map((s) => {
          const codigoActual = sextantes[s.id] || '0'
          const codigoDef = CODIGOS_EPB.find((c) => c.codigo === codigoActual)

          return (
            <div
              key={s.id}
              className="p-4 bg-surface/90 border border-surface rounded-2xl space-y-3 shadow-xs"
              data-testid={`card-sextante-${s.id}`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-surface">
                <div>
                  <h4 className="text-xs font-bold text-graphite-900 dark:text-graphite-50">{s.nombre}</h4>
                  <p className="text-[11px] font-mono text-graphite-400">Piezas: {s.piezas}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${codigoDef?.color}`}>
                  Cód. {codigoActual}
                </span>
              </div>

              {/* Botonera de Códigos 0, 1, 2, 3, 4, * */}
              <div className="grid grid-cols-6 gap-1.5">
                {CODIGOS_EPB.map((c) => {
                  const isSeleccionado = codigoActual === c.codigo
                  return (
                    <button
                      key={c.codigo}
                      type="button"
                      onClick={() => handleSeleccionarCodigo(s.id, c.codigo)}
                      className={`h-9 rounded-xl font-mono text-xs font-bold transition-all border ${
                        isSeleccionado
                          ? `${c.color} border-transparent shadow-xs scale-105`
                          : 'bg-surface border-surface text-graphite-600 hover:bg-surface-hover dark:text-graphite-300'
                      }`}
                      title={c.criterio}
                      data-testid={`btn-codigo-${s.id}-${c.codigo}`}
                    >
                      {c.codigo}
                    </button>
                  )
                })}
              </div>

              <p className="text-[11px] text-graphite-500 truncate" title={codigoDef?.criterio}>
                {codigoDef?.titulo}: {codigoDef?.criterio}
              </p>
            </div>
          )
        })}
      </div>

      {/* Observaciones y Piezas Críticas */}
      <div className="p-4 bg-surface/90 border border-surface rounded-2xl space-y-2 shadow-xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-graphite-900 dark:text-graphite-50">
            Cuadro de Observaciones & Piezas Críticas
          </h4>
        </div>
        <textarea
          data-testid="textarea-epb-observaciones"
          rows={3}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Anote aquí piezas con furcación crítica, recesiones severas, supuración o necesidad de periodontograma completo..."
          className="w-full p-3 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      {/* Leyenda Clínica EPB */}
      <div className="p-4 bg-surface/60 border border-surface rounded-2xl text-xs space-y-2">
        <p className="font-bold text-graphite-700 dark:text-graphite-300">Criterios Oficiales EPB:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] text-graphite-500">
          {CODIGOS_EPB.map((c) => (
            <div key={c.codigo} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded text-center leading-4 font-mono font-bold text-[10px] ${c.color}`}>
                {c.codigo}
              </span>
              <span>{c.criterio}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
