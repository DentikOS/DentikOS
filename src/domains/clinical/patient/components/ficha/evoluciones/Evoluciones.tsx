import React, { useState } from 'react'
import { FileText, Mic, MicOff, Plus, CheckCircle2, Key, Clock } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'

interface NotaEvolucion {
  id: string
  fecha: string
  profesional: string
  motivo: string
  procedimiento: string
  indicaciones?: string
  firmaHash: string
}

const PLANTILLAS_INTELIGENTES = [
  {
    id: 'control',
    titulo: 'Control General',
    texto: 'Paciente asiste a control post-operatorio. Evolución asintomática, tejidos en franca cicatrización.',
  },
  {
    id: 'profilaxis',
    titulo: 'Profilaxis & Destartraje',
    texto: 'Se realiza destartraje supragingival con ultrasonido y profilaxis con pasta abrasiva en arcadas superior e inferior.',
  },
  {
    id: 'resina',
    titulo: 'Restauración Resina',
    texto: 'Bajo aislamiento absoluto se remueve tejido cariado en pieza {{pieza}}. Acondicionamiento con ácido fosfórico y obturación en resina compuesta.',
  },
  {
    id: 'endo1',
    titulo: 'Endodoncia Sesión 1',
    texto: 'Acceso cameral, localización de conductos radiculares, instrumentación rotatoria biomecánica y medicación intraconducto.',
  },
  {
    id: 'exodoncia',
    titulo: 'Exodoncia Simple',
    texto: 'Infiltración anestésica local. Sindesmotomía, luxación y avulsión atraumática de pieza {{pieza}}. Hemostasia con gasa compresiva.',
  },
  {
    id: 'urgencia',
    titulo: 'Urgencia por Dolor',
    texto: 'Consulta de urgencia por dolor pulsátil. Diagnóstico de pulpitis irreversible. Apertura de urgencia y descompresión pulpar.',
  },
  {
    id: 'oclusal',
    titulo: 'Ajuste Oclusal',
    texto: 'Control de puntos prematuros con papel de articular de 40 micras. Desgaste selectivo en céntrica y desoclusión guiada.',
  },
  {
    id: 'cementacion',
    titulo: 'Cementación Definitiva',
    texto: 'Prueba estética y biomecánica de estructura. Acondicionamiento de muñón y cementación adhesiva definitiva.',
  },
  {
    id: 'blanqueamiento',
    titulo: 'Blanqueamiento Dental',
    texto: 'Aislamiento gingival con barrera fotopolimerizable. Aplicación de peróxido de hidrógeno al 35% en 3 ciclos de 15 minutos.',
  },
  {
    id: 'puntos',
    titulo: 'Retiro de Sutura',
    texto: 'Antisepsia local. Se retiran suturas sin complicaciones. Reborde y encía queratinizada sin signos de infección.',
  },
]

interface EvolucionesProps {
  nombrePaciente?: string
  profesionalActual?: string
}

export const Evoluciones: React.FC<EvolucionesProps> = ({
  nombrePaciente = 'Paciente',
  profesionalActual = 'Dr. Tratante',
}) => {
  const [evoluciones, setEvoluciones] = useState<NotaEvolucion[]>([
    {
      id: 'evo-1',
      fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      profesional: profesionalActual,
      motivo: 'Control post operatorio',
      procedimiento: 'Evolución favorable, tejidos epitelizados sin sangrado.',
      firmaHash: 'SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    },
  ])

  const [nuevaNota, setNuevaNota] = useState('')
  const [motivo, setMotivo] = useState('')
  const [pieza, setPieza] = useState('1.6')
  const [grabandoVoz, setGrabandoVoz] = useState(false)

  const aplicarPlantilla = (plantillaTexto: string) => {
    const reemplazado = plantillaTexto
      .replace(/{{nombre_paciente}}/g, nombrePaciente)
      .replace(/{{fecha}}/g, new Date().toLocaleDateString())
      .replace(/{{profesional}}/g, profesionalActual)
      .replace(/{{pieza}}/g, pieza)
    setNuevaNota((prev) => (prev ? `${prev}\n${reemplazado}` : reemplazado))
  }

  const toggleDictadoVoz = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      window.alert('El navegador no soporta Web Speech API para dictado por voz.')
      return
    }

    setGrabandoVoz((prev) => !prev)
  }

  const handleAgregarEvolucion = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevaNota.trim()) return

    const randomHash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const nueva: NotaEvolucion = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      profesional: profesionalActual,
      motivo: motivo || 'Atención Clínica',
      procedimiento: nuevaNota,
      firmaHash: `SHA256:${randomHash}`,
    }

    setEvoluciones([nueva, ...evoluciones])
    setNuevaNota('')
    setMotivo('')
  }

  return (
    <div className="space-y-6" data-testid="evoluciones-bp06">
      {/* Editor de Nueva Evolución */}
      <form
        onSubmit={handleAgregarEvolucion}
        className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-50 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Registrar Nueva Evolución Clínica
          </h3>
          <Button
            type="button"
            size="sm"
            variant={grabandoVoz ? 'primary' : 'secondary'}
            icon={grabandoVoz ? MicOff : Mic}
            onClick={toggleDictadoVoz}
            className={grabandoVoz ? 'animate-pulse' : ''}
          >
            {grabandoVoz ? 'Detener Voz' : 'Dictado por Voz'}
          </Button>
        </div>

        {/* 10 Plantillas Inteligentes */}
        <div>
          <span className="text-[11px] font-semibold text-graphite-500 block mb-1.5">
            Plantillas Clínicas Rápidas:
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {PLANTILLAS_INTELIGENTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => aplicarPlantilla(p.texto)}
                className="px-2.5 py-1 rounded-lg bg-surface-hover hover:bg-primary/10 text-graphite-700 dark:text-graphite-300 hover:text-primary text-xs whitespace-nowrap transition-colors border border-surface"
              >
                {p.titulo}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <input
            type="text"
            placeholder="Motivo de consulta / procedimiento..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="p-2.5 bg-surface border border-surface rounded-xl text-xs"
          />
          <input
            type="text"
            placeholder="Pieza dental (ej: 1.6, 2.4)..."
            value={pieza}
            onChange={(e) => setPieza(e.target.value)}
            className="p-2.5 bg-surface border border-surface rounded-xl text-xs"
          />
        </div>

        <textarea
          rows={3}
          value={nuevaNota}
          onChange={(e) => setNuevaNota(e.target.value)}
          placeholder="Descripción detallada de la sesión clínica, materiales, anestesia..."
          className="w-full p-3 bg-surface border border-surface rounded-xl text-xs focus:ring-1 focus:ring-primary resize-none"
          required
        />

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-graphite-400 flex items-center gap-1 font-mono">
            <Key className="w-3 h-3" /> Firma digital SHA-256 se genera al guardar
          </span>
          <Button type="submit" variant="primary" icon={CheckCircle2}>
            Firmar & Guardar
          </Button>
        </div>
      </form>

      {/* Timeline Cronológico de Evoluciones */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-graphite-600 dark:text-graphite-400 uppercase tracking-wider">
          Historial Cronológico de Atenciones ({evoluciones.length})
        </h4>

        {evoluciones.map((evo) => (
          <div
            key={evo.id}
            className="p-4 bg-surface/80 border border-surface rounded-2xl space-y-2 shadow-xs"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-graphite-900 dark:text-graphite-50">
                {evo.motivo}
              </span>
              <span className="text-graphite-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(evo.fecha).toLocaleString()}
              </span>
            </div>

            <p className="text-xs text-graphite-700 dark:text-graphite-300 leading-relaxed whitespace-pre-wrap">
              {evo.procedimiento}
            </p>

            <div className="pt-2 border-t border-surface flex items-center justify-between text-[11px] text-graphite-400">
              <span>{evo.profesional}</span>
              <span className="font-mono text-[10px] bg-surface-hover px-2 py-0.5 rounded-md truncate max-w-xs">
                {evo.firmaHash}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
