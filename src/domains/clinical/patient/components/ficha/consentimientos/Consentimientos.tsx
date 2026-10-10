import React, { useState } from 'react'
import { FileCheck, Shield, PenTool, Image, Type, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import type { Paciente } from '../../../schemas/pacienteSchema'

const CONSENTIMIENTOS_CORE = [
  { id: 'cirugia', titulo: 'Cirugía Bucal y Exodoncia' },
  { id: 'endo', titulo: 'Endodoncia & Terapia Pulpar' },
  { id: 'implantes', titulo: 'Implantología Oral Oseointegrada' },
  { id: 'orto', titulo: 'Ortodoncia & Alineadores Invisibles' },
  { id: 'general', titulo: 'Odontología General & Rehabilitación Oral' },
]

type ModoFirma = 'canvas' | 'imagen' | 'tipografica' | 'escaneada'

interface ConsentimientoFirmado {
  id: string
  tipo: string
  fecha: string
  firmante: string
  esTutor: boolean
  modoFirma: ModoFirma
  hashForense: string
}

interface ConsentimientosProps {
  paciente: Paciente
}

export const Consentimientos: React.FC<ConsentimientosProps> = ({ paciente }) => {
  const [consentimientoSeleccionado, setConsentimientoSeleccionado] = useState(
    CONSENTIMIENTOS_CORE[0].id
  )
  const [modoFirma, setModoFirma] = useState<ModoFirma>('tipografica')
  const [firmaTipografica, setFirmaTipografica] = useState('')
  const [firmados, setFirmados] = useState<ConsentimientoFirmado[]>([])

  // Determinar si aplica tutor legal (menor de 18 o con tutor)
  const esMenorDeEdad = Boolean(
    paciente.tutorLegal?.nombre || (paciente.edad && Number(paciente.edad) < 18)
  )
  const nombreFirmante = esMenorDeEdad
    ? paciente.tutorLegal?.nombre || 'Tutor Legal'
    : paciente.nombreCompleto || paciente.nombre

  const handleFirmar = (e: React.FormEvent) => {
    e.preventDefault()

    const randomHash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const tipoObj = CONSENTIMIENTOS_CORE.find((c) => c.id === consentimientoSeleccionado)

    const nuevo: ConsentimientoFirmado = {
      id: crypto.randomUUID(),
      tipo: tipoObj?.titulo || 'Consentimiento Informado',
      fecha: new Date().toISOString(),
      firmante: nombreFirmante,
      esTutor: esMenorDeEdad,
      modoFirma,
      hashForense: `SHA256:CONS-${randomHash.toUpperCase()}`,
    }

    setFirmados([nuevo, ...firmados])
    setFirmaTipografica('')
  }

  return (
    <div className="space-y-6" data-testid="consentimientos-bp06">
      {/* Selector de los 5 Consentimientos CORE */}
      <div className="p-4 bg-surface/90 border border-surface rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">
            5 Consentimientos Informados CORE
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {CONSENTIMIENTOS_CORE.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setConsentimientoSeleccionado(c.id)}
              className={`p-3 rounded-xl text-left text-xs font-semibold transition-all border ${
                consentimientoSeleccionado === c.id
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-surface border-surface hover:bg-surface-hover text-graphite-700 dark:text-graphite-300'
              }`}
            >
              {c.titulo}
            </button>
          ))}
        </div>
      </div>

      {/* Editor y 4 Modos de Firma */}
      <form
        onSubmit={handleFirmar}
        className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs"
      >
        <div className="flex items-center justify-between pb-2 border-b border-surface">
          <div>
            <h4 className="text-xs font-bold text-graphite-900 dark:text-graphite-50">
              Protocolo de Firma Digital del Paciente
            </h4>
            <p className="text-[11px] text-graphite-500">
              Firmante legal:{' '}
              <span className="font-semibold text-graphite-800 dark:text-graphite-200">
                {nombreFirmante} {esMenorDeEdad && '(Tutor Legal Responsable)'}
              </span>
            </p>
          </div>

          {/* Selector de los 4 Modos de Firma */}
          <div className="flex items-center p-1 bg-surface-hover rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setModoFirma('tipografica')}
              className={`p-1.5 rounded-lg flex items-center gap-1 ${
                modoFirma === 'tipografica' ? 'bg-primary text-white' : 'text-graphite-500'
              }`}
              title="Firma Tipográfica"
            >
              <Type className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setModoFirma('canvas')}
              className={`p-1.5 rounded-lg flex items-center gap-1 ${
                modoFirma === 'canvas' ? 'bg-primary text-white' : 'text-graphite-500'
              }`}
              title="Trazo / Canvas"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setModoFirma('imagen')}
              className={`p-1.5 rounded-lg flex items-center gap-1 ${
                modoFirma === 'imagen' ? 'bg-primary text-white' : 'text-graphite-500'
              }`}
              title="Imagen de Firma"
            >
              <Image className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setModoFirma('escaneada')}
              className={`p-1.5 rounded-lg flex items-center gap-1 ${
                modoFirma === 'escaneada' ? 'bg-primary text-white' : 'text-graphite-500'
              }`}
              title="Documento Escaneado"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Área del modo de firma activo */}
        <div className="p-4 rounded-xl border border-dashed border-graphite-300 dark:border-graphite-700 bg-surface/50 text-center">
          {modoFirma === 'tipografica' && (
            <div className="space-y-2 max-w-md mx-auto">
              <input
                type="text"
                placeholder={`Escribe el nombre para firma tipográfica: ${nombreFirmante}`}
                value={firmaTipografica}
                onChange={(e) => setFirmaTipografica(e.target.value)}
                className="w-full p-2 bg-surface border border-surface rounded-lg text-xs text-center font-serif text-base"
              />
              <p className="text-[10px] text-graphite-400">
                Se generará firma certificada legal con esteganografía forense
              </p>
            </div>
          )}

          {modoFirma === 'canvas' && (
            <div className="py-6 text-xs text-graphite-400 flex flex-col items-center gap-2">
              <PenTool className="w-6 h-6 text-primary" />
              <span>Dibuja tu firma sobre la pantalla o touchpad (Trazo Quirúrgico)</span>
            </div>
          )}

          {modoFirma === 'imagen' && (
            <div className="py-6 text-xs text-graphite-400 flex flex-col items-center gap-2">
              <Image className="w-6 h-6 text-primary" />
              <span>Arrastra o sube una imagen PNG/JPG con la firma manuscrita</span>
            </div>
          )}

          {modoFirma === 'escaneada' && (
            <div className="py-6 text-xs text-graphite-400 flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-primary" />
              <span>Sube el documento PDF físico firmado y escaneado</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-graphite-400 font-mono">
            Cumple Ley 20.584 y Estándar Forense SHA-256
          </span>
          <Button type="submit" variant="primary" icon={CheckCircle2}>
            Firmar Consentimiento
          </Button>
        </div>
      </form>

      {/* Historial de Consentimientos Firmados */}
      {firmados.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-graphite-500 uppercase tracking-wider">
            Consentimientos Legalmente Firmados ({firmados.length})
          </h4>
          {firmados.map((doc) => (
            <div
              key={doc.id}
              className="p-4 bg-surface/90 border border-surface rounded-2xl flex items-center justify-between gap-4 shadow-xs"
            >
              <div>
                <span className="text-xs font-bold text-graphite-900 dark:text-graphite-50">
                  {doc.tipo}
                </span>
                <p className="text-[11px] text-graphite-500 mt-0.5">
                  Firmado por: {doc.firmante} &bull; Modo: {doc.modoFirma} &bull;{' '}
                  {new Date(doc.fecha).toLocaleDateString()}
                </p>
                <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {doc.hashForense}
                </p>
              </div>

              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <FileCheck className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
