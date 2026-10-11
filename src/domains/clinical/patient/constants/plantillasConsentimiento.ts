/**
 * Plantillas de Consentimientos Informados (M4a)
 * Extraídas de ConsentimientosSection.jsx para cumplir límite constitucional.
 */

export interface PlantillaConsentimiento {
  id: string
  nombre: string
  texto: string
}

export const PLANTILLAS_CONSENTIMIENTO: readonly PlantillaConsentimiento[] = [
  {
    id: 'general',
    nombre: 'Consentimiento General de Tratamiento',
    texto: 'Autorizo la realización del examen clínico y plan de tratamiento odontológico de acuerdo con la Ley 20.584 de Derechos y Deberes del Paciente.'
  },
  {
    id: 'anestesia',
    nombre: 'Consentimiento de Anestesia Local',
    texto: 'Autorizo la administración de anestésicos locales habiendo sido informado sobre su necesidad y eventuales riesgos secundarios menores transitorios.'
  },
  {
    id: 'exodoncia',
    nombre: 'Consentimiento de Exodoncia Simple',
    texto: 'Autorizo la extracción de la pieza dentaria indicada y declaro haber recibido instrucciones de cuidados postoperatorios y riesgos de complicaciones.'
  },
  {
    id: 'radiografias',
    nombre: 'Consentimiento de Radiografías',
    texto: 'Autorizo la toma de exámenes radiográficos intraorales y extraorales bajo principios de radioprotección ALARA para fines diagnósticos.'
  },
  {
    id: 'menor',
    nombre: 'Consentimiento de Tratamiento en Menor',
    texto: 'Como padre, madre o tutor legal responsable, autorizo la atención odontológica y procedimientos clínicos en el paciente menor de 18 años.'
  }
]
