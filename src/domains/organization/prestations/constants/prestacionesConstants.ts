/**
 * Constantes, Especialidades y Paquetes para el Arancel Avanzado
 */

export interface ArancelItemDefault {
  id: number
  nombre: string
  especialidad: string
  precioParticular: number
  precioFonasa: null
  codigoFonasa: string
}

export interface PaqueteClinicoDefault {
  id: number
  nombre: string
  descripcion: string
  precioCombo: number
  ahorroEstimado: string
}

export const ESPECIALIDADES_ODONTOLOGICAS: readonly string[] = [
  'Diagnóstico y Prevención',
  'Operatoria / Estética',
  'Endodoncia',
  'Periodoncia',
  'Cirugía Bucal y Maxilofacial',
  'Rehabilitación y Prótesis',
  'Implantología',
  'Ortodoncia y Ortopedia',
  'Odontopediatría',
  'Urgencias'
]

export const ARANCEL_DEFAULT: readonly ArancelItemDefault[] = [
  { id: 1, nombre: 'Evaluación Clínica y Diagnóstico Integral', especialidad: 'Diagnóstico y Prevención', precioParticular: 25000, precioFonasa: null, codigoFonasa: '01-01-001' },
  { id: 2, nombre: 'Limpieza Dental UDA + Destartraje Ultrasonido', especialidad: 'Diagnóstico y Prevención', precioParticular: 35000, precioFonasa: null, codigoFonasa: '01-01-005' },
  { id: 3, nombre: 'Obturación Resina Simple (1 Cara)', especialidad: 'Operatoria / Estética', precioParticular: 35000, precioFonasa: null, codigoFonasa: '01-02-010' },
  { id: 4, nombre: 'Obturación Resina Compuesta (2-3 Caras)', especialidad: 'Operatoria / Estética', precioParticular: 45000, precioFonasa: null, codigoFonasa: '01-02-012' },
  { id: 5, nombre: 'Incrustación Estética Cerámica / Composite', especialidad: 'Operatoria / Estética', precioParticular: 120000, precioFonasa: null, codigoFonasa: '01-02-025' },
  { id: 6, nombre: 'Tratamiento de Endodoncia Unirradicular', especialidad: 'Endodoncia', precioParticular: 110000, precioFonasa: null, codigoFonasa: '01-03-001' },
  { id: 7, nombre: 'Tratamiento de Endodoncia Multirradicular', especialidad: 'Endodoncia', precioParticular: 160000, precioFonasa: null, codigoFonasa: '01-03-003' },
  { id: 8, nombre: 'Exodoncia Pieza Permanente Simple', especialidad: 'Cirugía Bucal y Maxilofacial', precioParticular: 40000, precioFonasa: null, codigoFonasa: '01-04-001' },
  { id: 9, nombre: 'Corona de Zirconio Monolítico / E-Max', especialidad: 'Rehabilitación y Prótesis', precioParticular: 280000, precioFonasa: null, codigoFonasa: '01-05-015' },
  { id: 10, nombre: 'Instalación de Implante Óseo-Integrado', especialidad: 'Implantología', precioParticular: 480000, precioFonasa: null, codigoFonasa: '01-06-001' }
]

export const PAQUETES_CLINICOS_DEFAULT: readonly PaqueteClinicoDefault[] = [
  {
    id: 101,
    nombre: 'Pack Prevención & Profilaxis Completa',
    descripcion: 'Incluye evaluación clínica, destartraje ultrasónico, pulido coronario y aplicación tópica de flúor.',
    precioCombo: 50000,
    ahorroEstimado: '15%'
  },
  {
    id: 102,
    nombre: 'Pack Blanqueamiento Dental LED',
    descripcion: 'Incluye sesión clínica en sillón con lámpara LED + kit de mantenimiento ambulatorio.',
    precioCombo: 130000,
    ahorroEstimado: '20%'
  }
]
