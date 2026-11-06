import React, { useState } from 'react'
import { CheckCircle2, Circle, ArrowRight, Video, BookOpen, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from './ui/Button'
import { DentikOSLogo } from './brand/DentikOSLogo'

export interface PantallaBienvenidaProps {
  nombreClinica: string
  tipoActividad: 'individual' | 'clinica'
  totalSedes?: number
  invitacionesCreadas?: number
  invitacionesPendientes?: number
  sucursalesSincronizadas?: boolean
  errorSincronizacionSedes?: string | null
  boxesCreados?: number
  catalogoPlantillaAplicado?: boolean
  advertenciasConfiguracion?: string[]
  alFinalizar: (conTour: boolean) => void
}

export const PantallaBienvenida: React.FC<PantallaBienvenidaProps> = ({
  nombreClinica,
  tipoActividad,
  totalSedes = 1,
  invitacionesCreadas = 0,
  invitacionesPendientes = 0,
  sucursalesSincronizadas = true,
  errorSincronizacionSedes = null,
  boxesCreados = 0,
  catalogoPlantillaAplicado = false,
  advertenciasConfiguracion = [],
  alFinalizar,
}) => {
  const [mostrarTour, setMostrarTour] = useState<boolean>(true)

  const items = [
    { id: 'espacio', label: tipoActividad === 'individual' ? 'Consulta configurada' : 'Espacio clínico creado', completado: true },
    { id: 'sedes', label: sucursalesSincronizadas
      ? `${totalSedes} sede${totalSedes > 1 ? 's' : ''} sincronizada${totalSedes > 1 ? 's' : ''}`
      : `${totalSedes} sede${totalSedes > 1 ? 's' : ''} guardada${totalSedes > 1 ? 's' : ''} localmente`, completado: sucursalesSincronizadas },
    { id: 'boxes', label: boxesCreados > 0 ? `${boxesCreados} boxes sincronizados` : 'Revisar boxes y equipamiento', completado: boxesCreados > 0 },
    { id: 'equipo', label: invitacionesCreadas > 0 ? `${invitacionesCreadas} invitación(es) creada(s)` : 'Invitar a tu equipo', completado: invitacionesCreadas > 0 && invitacionesPendientes === 0 },
    { id: 'aranceles', label: catalogoPlantillaAplicado ? 'Catálogo importado' : 'Revisar arancel y prestaciones', completado: catalogoPlantillaAplicado },
    { id: 'agenda', label: 'Configurar horarios de atención', completado: false },
    { id: 'paciente', label: 'Registrar primer paciente', completado: false },
  ]

  return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-4 text-white">
      <div className="max-w-xl w-full bg-[#0B132B] border border-[#24334A] rounded-3xl p-8 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#D4AF37]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-3 relative z-10">
          <div className="inline-flex justify-center mb-2">
            <DentikOSLogo variant="stacked" size="md" dark />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#E5C378] text-xs font-medium">
            <Sparkles size={13} />
            <span>Configuración inicial completada</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ¡Bienvenido a DentikOS!
          </h1>
          <p className="text-sm text-slate-300">
            Tu {tipoActividad === 'individual' ? 'consulta' : 'clínica'}{' '}
            <span className="font-semibold text-white">{nombreClinica}</span> ya fue creada. El checklist muestra qué quedó sincronizado y qué falta revisar.
          </p>
        </div>

        {/* Checklist */}
        <div className="bg-[#080E1E] border border-slate-800 rounded-2xl p-5 space-y-3 relative z-10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Checklist de activación
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs ${
                  item.completado
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400'
                }`}
              >
                {item.completado ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                ) : (
                  <Circle size={16} className="text-slate-500 shrink-0" />
                )}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          {invitacionesCreadas > 0 && (
            <p className="text-[11px] text-slate-400">Comparte los enlaces desde Administración &gt; Equipo; el asistente no envía correos automáticamente.</p>
          )}
          {invitacionesPendientes > 0 && (
            <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-[11px] text-amber-200">
              No se crearon {invitacionesPendientes} invitación(es). Puedes volver a intentarlo desde Administración &gt; Equipo.
            </p>
          )}
          {advertenciasConfiguracion.length > 0 && (
            <div role="status" className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-[11px] text-amber-200">
              {advertenciasConfiguracion.map((advertencia, index) => <p key={`${index}-${advertencia}`}>{advertencia}</p>)}
            </div>
          )}
          {!sucursalesSincronizadas && (
            <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-[11px] text-amber-200">
              La sucursal quedó guardada en este dispositivo, pero falta sincronizarla. {errorSincronizacionSedes || 'Reintenta en Administración > Sucursales antes de gestionar boxes.'}
            </p>
          )}
        </div>

        {/* Recursos de ayuda */}
        <div className="grid grid-cols-3 gap-3 text-center relative z-10">
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition cursor-not-allowed opacity-75">
            <Video size={18} className="mx-auto text-[#D4AF37] mb-1.5" />
            <span className="block text-[11px] font-medium text-slate-200">Video Tour</span>
            <span className="text-[10px] text-slate-500">Próximamente</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition cursor-not-allowed opacity-75">
            <BookOpen size={18} className="mx-auto text-[#D4AF37] mb-1.5" />
            <span className="block text-[11px] font-medium text-slate-200">Guía Clínica</span>
            <span className="text-[10px] text-slate-500">Próximamente</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition cursor-not-allowed opacity-75">
            <MessageSquare size={18} className="mx-auto text-[#D4AF37] mb-1.5" />
            <span className="block text-[11px] font-medium text-slate-200">Demo en Vivo</span>
            <span className="text-[10px] text-slate-500">Próximamente</span>
          </div>
        </div>

        {/* CTA final */}
        <div className="space-y-4 pt-2 relative z-10">
          <label className="flex items-center justify-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarTour}
              onChange={(e) => setMostrarTour(e.target.value === 'on' || e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-[#D4AF37] focus:ring-0"
            />
            <span>Mostrar tour guiado al ingresar al Dashboard</span>
          </label>

          <Button
            type="button"
            fullWidth
            onClick={() => alFinalizar(mostrarTour)}
            className="py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <span>Ir al Dashboard</span>
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
