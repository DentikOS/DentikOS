import React, { useState } from 'react'
import { GitCommit, History, ArrowRight, ShieldCheck, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'

export interface VersionPresupuesto {
  version: number
  fecha: string
  usuario: string
  tipoModificacion: string
  motivo: string
  totalAnterior: number
  totalNuevo: number
  hashSha256: string
  cambios?: string[]
}

interface HistorialVersionesProps {
  versiones?: VersionPresupuesto[]
  folioPresupuesto?: string
}

const VERSIONES_MOCK: VersionPresupuesto[] = [
  {
    version: 3,
    fecha: '2026-03-02T15:30:00.000Z',
    usuario: 'Dra. Valentina Ríos (Rehabilitadora)',
    tipoModificacion: 'Ajuste de convenio y piezas',
    motivo: 'Paciente solicitó cambio a implante guiado y convenio Isapre Colmena',
    totalAnterior: 780000,
    totalNuevo: 650000,
    hashSha256: 'SHA256:7F4B2A8D9E1C3F5A0B4D8E2F1A7C3B9E',
    cambios: ['Se aplicó 20% bonificación Isapre Colmena', 'Pieza 2.1 modificada a implante con carga inmediata'],
  },
  {
    version: 2,
    fecha: '2026-02-28T11:15:00.000Z',
    usuario: 'Dr. Matías Soto (Cirujano)',
    tipoModificacion: 'Adición de fase quirúrgica',
    motivo: 'Evaluación CBCT reveló necesidad de regeneración ósea guiada',
    totalAnterior: 520000,
    totalNuevo: 780000,
    hashSha256: 'SHA256:3A1B9C5D7E2F4A8B0C3D6E9F1A4B7C2D',
    cambios: ['Agregada regeneración ósea con biomaterial e injerto', 'Ajuste de tiempo quirúrgico a 90 minutos'],
  },
  {
    version: 1,
    fecha: '2026-02-25T09:00:00.000Z',
    usuario: 'Dra. Valentina Ríos (Rehabilitadora)',
    tipoModificacion: 'Creación de presupuesto inicial',
    motivo: 'Evaluación clínica diagnóstica inicial',
    totalAnterior: 0,
    totalNuevo: 520000,
    hashSha256: 'SHA256:1C2D3E4F5A6B7C8D9E0F1A2B3C4D5E6F',
    cambios: ['Presupuesto emitido en estado BORRADOR desde odontograma'],
  },
]

export const HistorialVersiones: React.FC<HistorialVersionesProps> = ({
  versiones = VERSIONES_MOCK,
  folioPresupuesto = 'PRE-2026-0042',
}) => {
  const [versionExpandida, setVersionExpandida] = useState<number | null>(3)

  return (
    <div className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs" data-testid="historial-versiones">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-surface">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
              Historial de Versiones & Trazabilidad Forense (BP07 §15)
            </h3>
            <p className="text-[11px] text-graphite-500">
              Folio: <span className="font-mono font-semibold text-graphite-700 dark:text-graphite-300">{folioPresupuesto}</span> &bull; {versiones.length} versiones auditadas
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" /> Hash Inmutable SHA-256
        </span>
      </div>

      <div className="space-y-3">
        {versiones.map((v) => {
          const isExpandida = versionExpandida === v.version
          const diferencia = v.totalNuevo - v.totalAnterior

          return (
            <div key={v.version} className="p-4 bg-surface rounded-xl border border-surface space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-xs font-mono">
                    v{v.version}.0
                  </span>
                  <span className="font-bold text-xs text-graphite-900 dark:text-graphite-100">{v.tipoModificacion}</span>
                  <span className="text-[11px] text-graphite-400">&bull; {new Date(v.fecha).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 font-mono text-xs">
                    {v.totalAnterior > 0 && (
                      <>
                        <span className="text-graphite-400 line-through">${v.totalAnterior.toLocaleString('es-CL')}</span>
                        <ArrowRight className="w-3 h-3 text-graphite-400" />
                      </>
                    )}
                    <span className="font-bold text-primary">${v.totalNuevo.toLocaleString('es-CL')}</span>
                  </div>

                  <button
                    onClick={() => setVersionExpandida(isExpandida ? null : v.version)}
                    className="p-1 text-graphite-400 hover:text-graphite-700 rounded-md"
                    title="Comparar cambios"
                    data-testid={`btn-expandir-version-${v.version}`}
                  >
                    {isExpandida ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-graphite-500">
                Responsable: <span className="font-semibold text-graphite-700 dark:text-graphite-300">{v.usuario}</span>
              </div>

              <div className="p-2.5 bg-surface-hover/60 rounded-lg text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-graphite-400 block">Motivo Obligatorio del Cambio:</span>
                <p className="text-graphite-700 dark:text-graphite-200 italic">&ldquo;{v.motivo}&rdquo;</p>
              </div>

              {isExpandida && v.cambios && (
                <div className="pt-2 border-t border-surface space-y-1.5" data-testid={`diff-version-${v.version}`}>
                  <span className="text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Detalle de Diferencias vs Versión Anterior:
                  </span>
                  <ul className="space-y-1 pl-3 text-xs text-graphite-600 dark:text-graphite-300 list-disc">
                    {v.cambios.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                    <li>
                      Variación neta:{' '}
                      <span className={diferencia >= 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                        {diferencia >= 0 ? '+' : ''}${diferencia.toLocaleString('es-CL')}
                      </span>
                    </li>
                  </ul>
                  <p className="text-[10px] font-mono text-graphite-400 truncate pt-1">{v.hashSha256}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
