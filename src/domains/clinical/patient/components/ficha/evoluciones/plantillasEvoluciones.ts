export interface PlantillaEvolucion {
  id: string
  titulo: string
  texto: string
}

export const PLANTILLAS_INTELIGENTES: PlantillaEvolucion[] = [
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
]
