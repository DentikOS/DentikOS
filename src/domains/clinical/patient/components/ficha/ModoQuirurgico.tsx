import React, { useState, useEffect } from 'react'
import { Activity, Clock, AlertTriangle, ArrowLeft, ShieldAlert, Check } from 'lucide-react'
import { Button } from '../../../../../shared/ui/ui/Button'
import type { Paciente } from '../../schemas/pacienteSchema'

interface ModoQuirurgicoProps {
  paciente: Paciente
  onSalir: () => void
}

export const ModoQuirurgico: React.FC<ModoQuirurgicoProps> = ({ paciente, onSalir }) => {
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSegundos((s) => s + 1), 1000)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSalir()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onSalir])

  const minutos = Math.floor(segundos / 60)
  const segRestantes = segundos % 60
  const tiempoFormateado = `${String(minutos).padStart(2, '0')}:${String(segRestantes).padStart(2, '0')}`

  const tieneAlergiasSeveras =
    Array.isArray(paciente.alergiasSeveras) && paciente.alergiasSeveras.length > 0

  return (
    <div
      className="fixed inset-0 z-50 bg-[#CBD5E1] text-graphite-950 p-6 flex flex-col justify-between select-none overflow-y-auto"
      data-testid="modo-quirurgico-modulo"
    >
      {/* Barra superior de alto contraste */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-graphite-400">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-graphite-900 animate-pulse" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-graphite-950">
              MODO QUIRÚRGICO ACTIVO
            </h1>
            <p className="text-xs font-bold text-graphite-700 font-mono">
              INTERFAZ DE ALTO CONTRASTE (OPTIMIZADA PARA GUANTES QUIRÚRGICOS)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSalir}
          className="min-h-[48px] min-w-[48px] px-6 py-3 bg-graphite-900 hover:bg-black text-white font-extrabold text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
          data-testid="btn-salir-quirurgico"
        >
          <ArrowLeft className="w-5 h-5" /> Salir del Modo Quirúrgico
        </button>
      </div>

      {/* Contenido Central Quirúrgico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
        {/* Paciente y Timer */}
        <div className="p-6 bg-white rounded-2xl border-2 border-graphite-400 shadow-md flex flex-col justify-between">
          <div>
            <span className="text-xs font-black uppercase text-graphite-500 tracking-wider">
              Paciente en Pabellón / Box
            </span>
            <h2 className="text-3xl font-black text-graphite-950 mt-1">
              {paciente.nombreCompleto || paciente.nombre}
            </h2>
            <p className="text-base font-mono font-bold text-graphite-700 mt-1">
              RUT: {paciente.rut}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t-2 border-graphite-200 flex items-center justify-between">
            <span className="text-xs font-bold text-graphite-600 flex items-center gap-1">
              <Clock className="w-4 h-4" /> Tiempo Quirúrgico
            </span>
            <span className="text-3xl font-black font-mono text-graphite-950 tabular-nums">
              {tiempoFormateado}
            </span>
          </div>
        </div>

        {/* Alertas Críticas Máximas */}
        <div className="p-6 bg-white rounded-2xl border-2 border-graphite-400 shadow-md">
          <span className="text-xs font-black uppercase text-rose-600 tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> Alertas Médicas & Riesgo
          </span>

          <div className="space-y-3 mt-3">
            {tieneAlergiasSeveras ? (
              <div className="p-3 bg-rose-100 border-2 border-rose-500 rounded-xl text-rose-900 font-extrabold text-sm flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0 text-rose-700" />
                <span>ALERGIA SEVERA: {paciente.alergiasSeveras?.join(', ')}</span>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-emerald-900 font-bold text-sm flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                <span>Sin alergias severas reportadas</span>
              </div>
            )}

            {paciente.anticoagulantes && (
              <div className="p-3 bg-amber-100 border-2 border-amber-500 rounded-xl text-amber-900 font-black text-sm">
                USO ACTIVO DE ANTICOAGULANTES
              </div>
            )}
          </div>
        </div>

        {/* Protocolo de Control Quirúrgico */}
        <div className="p-6 bg-white rounded-2xl border-2 border-graphite-400 shadow-md flex flex-col justify-between">
          <div>
            <span className="text-xs font-black uppercase text-graphite-500 tracking-wider">
              Control Clínico
            </span>
            <div className="mt-3 space-y-2 text-xs font-bold text-graphite-800">
              <p>&bull; Lavado y antisepsia de campo operatorio verificados</p>
              <p>&bull; Aspiración quirúrgica de alta potencia operativa</p>
              <p>&bull; Instrumental estéril trazado con lote activo</p>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={() => window.alert('Control de Signos Vitales Registrado')}
              className="w-full min-h-[48px] py-3 bg-graphite-200 hover:bg-graphite-300 font-black rounded-xl text-graphite-900 text-xs uppercase cursor-pointer"
            >
              Registrar Signos Vitales
            </button>
          </div>
        </div>
      </div>

      {/* Footer Quirúrgico */}
      <div className="pt-4 border-t-2 border-graphite-400 flex items-center justify-between text-xs font-bold text-graphite-700">
        <span>Box Clínico Activo &bull; Studio Dental</span>
        <span>Presione ESC o el botón superior para retornar a la Ficha Completa</span>
      </div>
    </div>
  )
}
