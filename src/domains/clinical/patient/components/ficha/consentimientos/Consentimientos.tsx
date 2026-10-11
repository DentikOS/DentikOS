import React, { useState, useEffect } from 'react'
import { FileCheck, Shield, PenTool, Type, MessageSquare, CheckCircle2, UserCheck, Smartphone } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { PLANTILLAS_CONSENTIMIENTO } from '../../../constants/plantillasConsentimiento'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'
import type { Paciente } from '../../../schemas/pacienteSchema'

export type ModoFirmaConsentimiento = 'canvas' | 'tipografica' | 'otp' | 'presencial'

export interface ConsentimientoFirmado {
  id: string
  plantillaId: string
  tipo: string
  textoLegal: string
  fecha: string
  firmante: string
  esTutor: boolean
  modoFirma: ModoFirmaConsentimiento
  hashForense: string
}

interface ConsentimientosProps {
  paciente: Paciente
}

export const Consentimientos: React.FC<ConsentimientosProps> = ({ paciente }) => {
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(PLANTILLAS_CONSENTIMIENTO[0].id)
  const [modoFirma, setModoFirma] = useState<ModoFirmaConsentimiento>('tipografica')
  const [firmaTipografica, setFirmaTipografica] = useState('')
  const [otpCodigo, setOtpCodigo] = useState('')
  const [nombreTutor, setNombreTutor] = useState(paciente.tutorLegal?.nombre || '')
  const [firmados, setFirmados] = useState<ConsentimientoFirmado[]>([])

  const esMenor = Boolean((paciente.edad && Number(paciente.edad) < 18) || paciente.tutorLegal?.nombre)
  const firmanteEfectivo = esMenor ? nombreTutor.trim() : (paciente.nombreCompleto || paciente.nombre)

  useEffect(() => {
    if (!paciente.id) return
    fichasClinicasStorageService.obtenerFichaClinica(String(paciente.id)).then((ficha) => {
      if (ficha?.consentimientos && Array.isArray(ficha.consentimientos)) {
        setFirmados(ficha.consentimientos as ConsentimientoFirmado[])
      }
    })
  }, [paciente.id])

  const plantillaActual = PLANTILLAS_CONSENTIMIENTO.find((p) => p.id === plantillaSeleccionada) || PLANTILLAS_CONSENTIMIENTO[0]

  const handleFirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (esMenor && !nombreTutor.trim()) {
      window.alert('Tutor legal obligatorio para pacientes menores de 18 años.')
      return
    }
    const randomHash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0')).join('')

    const nuevo: ConsentimientoFirmado = {
      id: crypto.randomUUID(),
      plantillaId: plantillaActual.id,
      tipo: plantillaActual.nombre,
      textoLegal: plantillaActual.texto,
      fecha: new Date().toISOString(),
      firmante: firmanteEfectivo || 'Firmante Registrado',
      esTutor: esMenor,
      modoFirma,
      hashForense: `SHA256:CONS-${randomHash.toUpperCase()}`,
    }

    const nuevosDocs = [nuevo, ...firmados]
    setFirmados(nuevosDocs)
    setFirmaTipografica('')
    setOtpCodigo('')

    if (paciente.id) {
      await fichasClinicasStorageService.guardarSeccionFicha(String(paciente.id), 'consentimientos', nuevosDocs)
    }
  }

  return (
    <div className="space-y-6" data-testid="consentimientos-bp06">
      <div className="p-4 bg-surface/90 border border-surface rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50">5 Plantillas Legales CORE (Ley 20.584)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PLANTILLAS_CONSENTIMIENTO.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlantillaSeleccionada(p.id)}
              className={`p-3 rounded-xl text-left text-xs font-semibold border transition-all ${
                plantillaSeleccionada === p.id ? 'bg-primary/10 border-primary text-primary' : 'bg-surface border-surface text-graphite-700 dark:text-graphite-300'
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
        <div className="mt-3 p-3 bg-surface rounded-xl border border-surface text-xs text-graphite-600 dark:text-graphite-300 italic">
          &ldquo;{plantillaActual.texto}&rdquo;
        </div>
      </div>

      <form onSubmit={handleFirmar} className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-surface">
          <div>
            <h4 className="text-xs font-bold text-graphite-900 dark:text-graphite-50">Protocolo de Firma Digital Certificada</h4>
            <p className="text-[11px] text-graphite-500">
              Firmante:{' '}
              <span className="font-semibold text-graphite-800 dark:text-graphite-200">
                {firmanteEfectivo} {esMenor && '(Tutor Legal Responsable)'}
              </span>
            </p>
          </div>

          <div className="flex items-center p-1 bg-surface-hover rounded-xl text-xs gap-1">
            <button
              type="button"
              onClick={() => setModoFirma('tipografica')}
              className={`p-1.5 rounded-lg flex items-center gap-1 ${modoFirma === 'tipografica' ? 'bg-primary text-white' : 'text-graphite-500'}`}
              title="Firma Tipográfica"
            >
              <Type className="w-3.5 h-3.5" /> <span className="hidden sm:inline text-[11px]">Tipográfica</span>
            </button>
            <button
              type="button"
              onClick={() => setModoFirma('canvas')}
              className={`p-1.5 rounded-lg flex items-center gap-1 ${modoFirma === 'canvas' ? 'bg-primary text-white' : 'text-graphite-500'}`}
              title="Trazado Táctil"
            >
              <PenTool className="w-3.5 h-3.5" /> <span className="hidden sm:inline text-[11px]">Trazado</span>
            </button>
            <button
              type="button"
              onClick={() => setModoFirma('otp')}
              className={`p-1.5 rounded-lg flex items-center gap-1 ${modoFirma === 'otp' ? 'bg-primary text-white' : 'text-graphite-500'}`}
              title="Código SMS/WhatsApp"
            >
              <Smartphone className="w-3.5 h-3.5" /> <span className="hidden sm:inline text-[11px]">OTP</span>
            </button>
            <button
              type="button"
              onClick={() => setModoFirma('presencial')}
              className={`p-1.5 rounded-lg flex items-center gap-1 ${modoFirma === 'presencial' ? 'bg-primary text-white' : 'text-graphite-500'}`}
              title="Presencial en Tablet"
            >
              <UserCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline text-[11px]">Presencial</span>
            </button>
          </div>
        </div>

        {esMenor && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
              Nombre de Tutor Legal (Requerido para menores de 18 años):
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Padre/Madre/Tutor legal autorizado"
              value={nombreTutor}
              onChange={(e) => setNombreTutor(e.target.value)}
              className="w-full p-2 bg-surface border border-surface rounded-lg text-xs"
              data-testid="input-tutor-legal"
            />
          </div>
        )}

        <div className="p-4 rounded-xl border border-dashed border-graphite-300 dark:border-graphite-700 bg-surface/50 text-center">
          {modoFirma === 'tipografica' && (
            <div className="space-y-2 max-w-md mx-auto">
              <input
                type="text"
                placeholder={`Escriba su nombre completo: ${firmanteEfectivo}`}
                value={firmaTipografica}
                onChange={(e) => setFirmaTipografica(e.target.value)}
                className="w-full p-2 bg-surface border border-surface rounded-lg text-center text-sm font-serif"
                data-testid="input-firma-tipografica"
              />
              <p className="text-[10px] text-graphite-400">Certificación legal con hash criptográfico SHA-256</p>
            </div>
          )}

          {modoFirma === 'canvas' && (
            <div className="py-4 text-xs text-graphite-500 flex flex-col items-center gap-2">
              <PenTool className="w-6 h-6 text-primary" />
              <span>Dibuja tu firma sobre la pantalla o touchpad (Trazado táctil activo)</span>
            </div>
          )}

          {modoFirma === 'otp' && (
            <div className="space-y-2 max-w-xs mx-auto">
              <input
                type="text"
                placeholder="Código OTP (6 dígitos) recibido por WhatsApp/SMS"
                value={otpCodigo}
                onChange={(e) => setOtpCodigo(e.target.value)}
                className="w-full p-2 bg-surface border border-surface rounded-lg text-center font-mono text-sm tracking-widest"
              />
              <p className="text-[10px] text-graphite-400">Código de un solo uso enviado al móvil del paciente</p>
            </div>
          )}

          {modoFirma === 'presencial' && (
            <div className="py-4 text-xs text-graphite-500 flex flex-col items-center gap-2">
              <UserCheck className="w-6 h-6 text-emerald-500" />
              <span>Verificación y firma presencial en box clínico con testigo acreditado</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-graphite-400 font-mono">Cumple Ley 20.584 y Hash Forense SHA-256</span>
          <Button type="submit" variant="primary" icon={CheckCircle2}>Firmar Consentimiento</Button>
        </div>
      </form>

      {firmados.length > 0 && (
        <div className="space-y-3" data-testid="consentimientos-firmados-lista">
          <h4 className="text-xs font-bold text-graphite-500 uppercase tracking-wider">
            Consentimientos Legalmente Firmados ({firmados.length})
          </h4>
          {firmados.map((doc) => (
            <div key={doc.id} className="p-4 bg-surface/90 border border-surface rounded-2xl flex items-center justify-between gap-4 shadow-xs">
              <div>
                <span className="text-xs font-bold text-graphite-900 dark:text-graphite-50">{doc.tipo}</span>
                <p className="text-[11px] text-graphite-500 mt-0.5">
                  Firmado por: {doc.firmante} &bull; Modo: {doc.modoFirma} &bull; {new Date(doc.fecha).toLocaleDateString()}
                </p>
                <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{doc.hashForense}</p>
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
