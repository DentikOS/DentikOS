import React, { useMemo } from 'react'
import { Users, UserCheck, Sparkles, AlertTriangle } from 'lucide-react'
import type { Paciente } from '../../schemas/pacienteSchema'

interface PacientesKPIsProps {
  pacientes: Paciente[]
}

export const PacientesKPIs: React.FC<PacientesKPIsProps> = ({ pacientes }) => {
  const kpis = useMemo(() => {
    const total = pacientes.length
    const activos = pacientes.filter(p => p.estado === 'activo' || !p.estado).length
    const nuevos = pacientes.filter(p => {
      if (p.estado === 'nuevo') return true
      if (!p.fechaCreacion) return false
      const dias = (Date.now() - new Date(p.fechaCreacion).getTime()) / (1000 * 60 * 60 * 24)
      return dias <= 30
    }).length
    const conAlertas = pacientes.filter(p => {
      const tieneAlergias = Array.isArray(p.alergias) ? p.alergias.length > 0 : Boolean(p.alergias)
      const tieneSeveras = Array.isArray(p.alergiasSeveras) && p.alergiasSeveras.length > 0
      const tieneCronicas = Array.isArray(p.enfermedadesCronicas) && p.enfermedadesCronicas.length > 0
      return tieneAlergias || tieneSeveras || tieneCronicas
    }).length

    return [
      {
        id: 'total',
        titulo: 'Total Pacientes',
        valor: total,
        icono: Users,
        color: 'text-primary bg-primary/10 border-primary/20',
      },
      {
        id: 'activos',
        titulo: 'Pacientes Activos',
        valor: activos,
        icono: UserCheck,
        color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      },
      {
        id: 'nuevos',
        titulo: 'Nuevos (Mes)',
        valor: nuevos,
        icono: Sparkles,
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      },
      {
        id: 'alertas',
        titulo: 'Con Alerta Médica',
        valor: conAlertas,
        icono: AlertTriangle,
        color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      },
    ]
  }, [pacientes])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" data-testid="pacientes-kpis">
      {kpis.map((kpi) => {
        const Icon = kpi.icono
        return (
          <div
            key={kpi.id}
            className="flex items-center gap-3 p-3.5 bg-surface/80 backdrop-blur-sm border border-surface rounded-xl shadow-xs"
          >
            <div className={`p-2 rounded-lg border ${kpi.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-graphite-500 dark:text-graphite-400">
                {kpi.titulo}
              </p>
              <p className="text-xl font-bold text-graphite-900 dark:text-graphite-50 tabular-nums">
                {kpi.valor}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
