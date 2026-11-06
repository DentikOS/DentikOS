export const EQUIPAMIENTO_CLINICO = [
  { id: 'lampara_fotocurado', nombre: 'Lámpara de fotocurado' },
  { id: 'escaner_intraoral', nombre: 'Escáner intraoral' },
  { id: 'laser_dental', nombre: 'Láser dental' },
  { id: 'rayos_x_periapical', nombre: 'Rayos X periapical' },
  { id: 'rayos_x_panoramico', nombre: 'Rayos X panorámico' },
  { id: 'autoclave_box', nombre: 'Autoclave en box' },
  { id: 'monitor_signos_vitales', nombre: 'Monitor de signos vitales' },
  { id: 'sedacion_consciente', nombre: 'Sedación consciente (óxido nitroso)' },
  { id: 'microscopio_dental', nombre: 'Microscopio dental' },
] as const

export const EQUIPAMIENTO_CLINICO_IDS = EQUIPAMIENTO_CLINICO.map((equipo) => equipo.id) as [
  (typeof EQUIPAMIENTO_CLINICO)[number]['id'],
  ...(typeof EQUIPAMIENTO_CLINICO)[number]['id'][]
]

export type EquipamientoClinicoId = (typeof EQUIPAMIENTO_CLINICO)[number]['id']
