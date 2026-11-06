/** Patologías oficiales de Urgencia GES; no incluye programas de BP21. */
export interface PatologiaGes {
  id: string
  numero: number
  nombre: string
  categoria: 'dolor' | 'infeccion' | 'postquirurgico' | 'trauma'
  descripcion: string
}

export interface CategoriaTriage {
  id: 'leve' | 'moderada' | 'severa'
  nombre: string
}

export const PATOLOGIAS_GES_ODONTO: PatologiaGes[] = [
  {
    id: 'pulpitis', numero: 1, nombre: 'Pulpitis', categoria: 'dolor',
    descripcion: 'Inflamación pulpar con dolor agudo.'
  },
  {
    id: 'absceso_odontogenico_localizado', numero: 2,
    nombre: 'Absceso submucoso, subperióstico o apical de origen odontogénico',
    categoria: 'infeccion', descripcion: 'Absceso odontogénico localizado.'
  },
  {
    id: 'absceso_espacios_bucomaxilofaciales', numero: 3,
    nombre: 'Absceso de espacios anatómicos bucomaxilofaciales',
    categoria: 'infeccion', descripcion: 'Infección de espacios anatómicos bucomaxilofaciales.'
  },
  {
    id: 'pericoronaritis_aguda', numero: 4, nombre: 'Pericoronaritis aguda',
    categoria: 'infeccion', descripcion: 'Inflamación pericoronaria aguda.'
  },
  {
    id: 'flegmones_orofaringeos', numero: 5,
    nombre: 'Flegmones orofaríngeos de origen odontogénico',
    categoria: 'infeccion', descripcion: 'Flegmón orofaríngeo odontogénico.'
  },
  {
    id: 'gingivitis_ulcero_necrotizante', numero: 6,
    nombre: 'Gingivitis úlcero-necrotizante (GUN)',
    categoria: 'infeccion', descripcion: 'Gingivitis úlcero-necrotizante.'
  },
  {
    id: 'complicaciones_post_exodoncia', numero: 7,
    nombre: 'Complicaciones post-exodoncia', categoria: 'postquirurgico',
    descripcion: 'Incluye hemorragia, alveolitis e infección postoperatoria.'
  },
  {
    id: 'traumatismo_dentoalveolar', numero: 8, nombre: 'Traumatismo dentoalveolar',
    categoria: 'trauma', descripcion: 'Traumatismo dentoalveolar.'
  }
]

/** Severidad seleccionada por el profesional; no es un algoritmo de triage. */
export const CATEGORIAS_TRIAGE_URGENCIA: CategoriaTriage[] = [
  { id: 'leve', nombre: 'Leve' },
  { id: 'moderada', nombre: 'Moderada' },
  { id: 'severa', nombre: 'Severa' }
]
