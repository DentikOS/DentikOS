import React, { useState } from 'react'
import { Activity, AlertCircle, Save, Info } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'

interface PuntoSondaje {
  mv: number
  v: number
  dv: number
  ml: number
  l: number
  dl: number
}

interface PuntoSangrado {
  mv: boolean
  v: boolean
  dv: boolean
  ml: boolean
  l: boolean
  dl: boolean
}

interface DatosPeriodontogramaPieza {
  sondaje: PuntoSondaje
  sangrado: PuntoSangrado
  movilidad: 'ninguna' | 'grado1' | 'grado2' | 'grado3'
  recesion: number
}

const PIEZAS_SEXTANTES = ['1.6', '1.1', '2.6', '3.6', '3.1', '4.6']

export const Periodontograma: React.FC = () => {
  const [datos, setDatos] = useState<Record<string, DatosPeriodontogramaPieza>>({
    '1.6': {
      sondaje: { mv: 2, v: 2, dv: 3, ml: 2, l: 3, dl: 2 },
      sangrado: { mv: false, v: false, dv: true, ml: false, l: false, dl: false },
      movilidad: 'ninguna',
      recesion: 0,
    },
    '1.1': {
      sondaje: { mv: 1, v: 2, dv: 2, ml: 2, l: 2, dl: 1 },
      sangrado: { mv: false, v: false, dv: false, ml: false, l: false, dl: false },
      movilidad: 'ninguna',
      recesion: 0,
    },
    '2.6': {
      sondaje: { mv: 4, v: 3, dv: 5, ml: 3, l: 4, dl: 4 },
      sangrado: { mv: true, v: false, dv: true, ml: false, l: true, dl: false },
      movilidad: 'grado1',
      recesion: 1,
    },
  })

  const [piezaActiva, setPiezaActiva] = useState<string>('2.6')

  const piezaActual = datos[piezaActiva] || {
    sondaje: { mv: 2, v: 2, dv: 2, ml: 2, l: 2, dl: 2 },
    sangrado: { mv: false, v: false, dv: false, ml: false, l: false, dl: false },
    movilidad: 'ninguna',
    recesion: 0,
  }

  const handleUpdateSondaje = (punto: keyof PuntoSondaje, valor: number) => {
    setDatos((prev) => ({
      ...prev,
      [piezaActiva]: {
        ...piezaActual,
        sondaje: { ...piezaActual.sondaje, [punto]: Math.max(0, Math.min(12, valor)) },
      },
    }))
  }

  const handleToggleSangrado = (punto: keyof PuntoSangrado) => {
    setDatos((prev) => ({
      ...prev,
      [piezaActiva]: {
        ...piezaActual,
        sangrado: { ...piezaActual.sangrado, [punto]: !piezaActual.sangrado[punto] },
      },
    }))
  }

  const getHeatmapColor = (profundidad: number) => {
    if (profundidad >= 5) return 'bg-rose-500 text-white font-bold'
    if (profundidad >= 4) return 'bg-amber-400 text-graphite-900 font-semibold'
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
  }

  return (
    <div className="space-y-4" data-testid="periodontograma-bp06">
      {/* Header EPB */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-surface/90 border border-surface rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Examen Periodontal Básico (EPB / Periodontograma)
            </h3>
            <p className="text-xs text-graphite-500">
              Sondaje en 6 sitios, sangrado BOP, recesión y movilidad dental.
            </p>
          </div>
        </div>

        <Button type="button" size="sm" variant="primary" icon={Save}>
          Guardar EPB
        </Button>
      </div>

      {/* Selector de piezas índice por sextante */}
      <div className="p-4 bg-surface/80 border border-surface rounded-2xl">
        <p className="text-xs font-semibold text-graphite-600 dark:text-graphite-400 mb-2">
          Piezas de Referencia por Sextante:
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {PIEZAS_SEXTANTES.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setPiezaActiva(num)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                piezaActiva === num
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface border border-surface hover:bg-surface-hover text-graphite-700 dark:text-graphite-300'
              }`}
            >
              Pieza {num}
            </button>
          ))}
        </div>
      </div>

      {/* Panel de registro de la pieza activa */}
      <div className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-surface">
          <span className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
            Registro Clínico — Pieza {piezaActiva}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-graphite-500">Movilidad:</span>
            <select
              value={piezaActual.movilidad}
              onChange={(e) =>
                setDatos((prev) => ({
                  ...prev,
                  [piezaActiva]: {
                    ...piezaActual,
                    movilidad: e.target.value as DatosPeriodontogramaPieza['movilidad'],
                  },
                }))
              }
              className="text-xs bg-surface border border-surface rounded-lg px-2 py-1"
            >
              <option value="ninguna">Grado 0 (Fisiológica)</option>
              <option value="grado1">Grado 1 (Horizontal &lt;1mm)</option>
              <option value="grado2">Grado 2 (Horizontal &gt;1mm)</option>
              <option value="grado3">Grado 3 (Vertical)</option>
            </select>
          </div>
        </div>

        {/* 6 Sitios de Sondaje (MV, V, DV, ML, L, DL) */}
        <div>
          <p className="text-xs font-bold text-graphite-700 dark:text-graphite-300 mb-2">
            Profundidad de Sondaje (mm) y Sangrado al Sondaje (BOP):
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(['mv', 'v', 'dv', 'ml', 'l', 'dl'] as (keyof PuntoSondaje)[]).map((sitio) => {
              const valor = piezaActual.sondaje[sitio]
              const sangra = piezaActual.sangrado[sitio]

              return (
                <div
                  key={sitio}
                  className={`p-3 rounded-xl border border-surface text-center flex flex-col justify-between items-center ${getHeatmapColor(
                    valor
                  )}`}
                >
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider opacity-80">
                    {sitio}
                  </span>

                  <div className="my-1">
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={valor}
                      onChange={(e) => handleUpdateSondaje(sitio, Number(e.target.value))}
                      className="w-12 text-center text-sm font-bold bg-white/40 dark:bg-black/30 rounded-lg p-1 border-0"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleSangrado(sitio)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${
                      sangra
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-black/10 dark:bg-white/10 text-graphite-700 dark:text-graphite-200'
                    }`}
                  >
                    {sangra ? 'BOP (+)' : 'BOP (-)'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Leyenda de Mapa de Calor */}
        <div className="flex items-center gap-4 text-xs text-graphite-500 pt-2 border-t border-surface flex-wrap">
          <span className="flex items-center gap-1 font-medium">
            <span className="w-3 h-3 rounded-full bg-emerald-500" /> &le; 3mm Normal
          </span>
          <span className="flex items-center gap-1 font-medium">
            <span className="w-3 h-3 rounded-full bg-amber-400" /> 4mm Bolsa Leve
          </span>
          <span className="flex items-center gap-1 font-medium">
            <span className="w-3 h-3 rounded-full bg-rose-500" /> &ge; 5mm Bolsa Severa
          </span>
        </div>
      </div>
    </div>
  )
}
