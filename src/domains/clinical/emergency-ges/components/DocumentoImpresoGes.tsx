import React, { memo } from 'react'
import { Printer } from 'lucide-react'
import type { AtencionGes } from '../services/urgenciasGesStorageService'

export interface UserProfileGes {
  nombreCompleto?: string
  rut?: string
  [key: string]: unknown
}

export interface DocumentoImpresoGesProps {
  atencion: AtencionGes | null
  userProfile?: UserProfileGes | null
  alCerrar: () => void
}

/** Historical local-only records are preserved for consultation; they are not represented as verified GES notifications. */
export const DocumentoImpresoGes: React.FC<DocumentoImpresoGesProps> = memo(({ atencion, userProfile, alCerrar }) => {
  if (!atencion) return null

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/20">
        <div>
          <p className="text-xs font-bold text-amber-900 dark:text-amber-100">Registro histórico local legado</p>
          <p className="text-xs text-amber-800 dark:text-amber-200">No está sincronizado ni verificado en el servidor. Sus datos se conservan sin cambios.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white hover:bg-gray-800">
            <Printer size={14} /> Imprimir copia local
          </button>
          <button type="button" onClick={alCerrar} className="rounded-xl bg-gray-200 px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-300">Volver</button>
        </div>
      </div>

      <article className="space-y-5 rounded-2xl border border-gray-300 bg-white p-8 text-xs text-gray-900 print:border-0 print:p-0">
        <header className="border-b-2 border-black pb-4">
          <p className="font-bold uppercase tracking-wide">Copia de registro local legado · no verificado</p>
          <h1 className="mt-1 text-base font-black">Atención de urgencia registrada localmente</h1>
          <p className="mt-2 text-[10px] text-gray-600">Folio local: {atencion.folio || 'No disponible'} · Fecha registrada: {atencion.fechaCreacion || 'No disponible'}</p>
        </header>

        <section className="space-y-1">
          <h2 className="font-bold">Paciente</h2>
          <p>{atencion.pacienteNombre || 'No disponible'}{atencion.pacienteRut ? ` · RUT ${atencion.pacienteRut}` : ''}</p>
          {atencion.pacientePrevision && <p>Previsión registrada: {atencion.pacientePrevision}</p>}
        </section>

        <section className="space-y-1">
          <h2 className="font-bold">Atención registrada</h2>
          <p>Problema GES informado en el registro local: {atencion.patologiaNombre || atencion.patologiaGes || 'No disponible'}{atencion.patologiaCodigo ? ` · Código guardado: ${atencion.patologiaCodigo}` : ''}</p>
          <p>Diagnóstico: {atencion.diagnostico || 'No disponible'}</p>
          <p>Indicaciones o tratamiento guardado: {atencion.indicacionesTratamiento || 'No disponible'}</p>
          <p>Decisión guardada: {typeof atencion.aceptaAtencion === 'boolean' ? (atencion.aceptaAtencion ? 'Acepta' : 'Rechaza') : 'No disponible'}</p>
        </section>

        <section className="space-y-1">
          <h2 className="font-bold">Procedencia</h2>
          <p>Este dato proviene del almacenamiento local de una versión anterior de DentikOS. No se confirmó en Supabase ni representa una constancia oficial.</p>
          {userProfile?.nombreCompleto && <p>Perfil actual que consulta: {userProfile.nombreCompleto}</p>}
        </section>
      </article>
    </div>
  )
})

DocumentoImpresoGes.displayName = 'DocumentoImpresoGes'
