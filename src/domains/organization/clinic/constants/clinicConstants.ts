/**
 * Constantes y Configuración de Clínica (Branding / Membrete)
 */

export interface ClinicaConfig {
  nombreClinica: string
  razonSocial: string
  rutClinica: string
  direccion: string
  ciudad: string
  comuna?: string
  region?: string
  giroComercial?: string
  sitioWeb?: string
  instagram?: string
  facebook?: string
  registroSeremi?: string
  registroIsp?: string
  idiomaDocumentos?: string
  moneda?: string
  telefono: string
  emailContacto: string
  eslogan: string
  zonaHoraria: string
  logoUrl: string
}

export const CLINICA_DEFAULT: ClinicaConfig = {
  nombreClinica: 'DentikOS',
  razonSocial: 'Sociedad Odontológica DentikOS SpA',
  rutClinica: '77.854.320-K',
  direccion: "Av. Libertador Bernardo O'Higgins 1449, Oficina 602",
  ciudad: 'Santiago, Chile',
  telefono: '+56 9 8765 4321',
  emailContacto: 'contacto@dentikos.cl',
  giroComercial: 'Servicios odontológicos',
  idiomaDocumentos: 'es-CL',
  moneda: 'CLP',
  eslogan: 'Odontología de Alta Precisión & Estética Dental',
  zonaHoraria: 'America/Santiago',
  logoUrl: ''
}

// Re-exportar parámetros de agenda para compatibilidad de tests históricos
export { PARAMETROS_AGENDA_DEFAULT, TRAMOS_DURACION, type ParametrosAgendaConfig } from '../../../operations/agenda/constants/agendaConstants'
