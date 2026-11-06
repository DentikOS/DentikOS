import type React from 'react'
import { type BootstrapClinicaDatos } from '../../infrastructure/auth/authService'
import { type Sede } from '../../domains/organization/clinic/schemas/sedeSchema'
import type { PlantillaCatalogoId } from '../../domains/organization/prestations/constants/prestacionesPlantillas'
import type { TipoBox } from '../../domains/organization/clinic/schemas/boxSchema'

export type TipoActividad = 'individual' | 'clinica'

export interface MiembroInvitacionOnboarding {
  email: string
  rol: string
  sedes: string[]
}

export interface ExtendedBootstrapDatos extends BootstrapClinicaDatos {
  comuna?: string
  region?: string
  giroComercial?: string
  zonaHoraria?: string
  idiomaDocumentos?: string
  moneda?: string
  especialidad?: string
  logoUrl?: string
}

export interface BoxPlantillaBootstrap {
  nombre: string
  tipo: TipoBox
  unidadDental: string
  notas: string
}

export interface UseBootstrapClinicaReturn {
  paso: number
  tipoActividad: TipoActividad
  datos: ExtendedBootstrapDatos
  sedes: Sede[]
  equipo: MiembroInvitacionOnboarding[]
  plantillaSeleccionada: PlantillaCatalogoId | null
  preciosPlantilla: Record<string, string>
  boxesPlantilla: BoxPlantillaBootstrap[]
  boxesCreados: number
  catalogoPlantillaAplicado: boolean
  advertenciasConfiguracion: string[]
  errores: Record<string, string | null>
  procesando: boolean
  errorGeneral: string | null
  completado: boolean
  invitacionesCreadas: number
  invitacionesPendientes: number
  sucursalesRegistradas: number
  sucursalesSincronizadas: boolean
  errorSincronizacionSedes: string | null
  setTipoActividad: (tipo: TipoActividad) => void
  actualizarCampo: (campo: keyof ExtendedBootstrapDatos, valor: string) => void
  agregarSede: (sede: Sede) => void
  eliminarSede: (index: number) => void
  agregarMiembro: (miembro: MiembroInvitacionOnboarding) => void
  eliminarMiembro: (index: number) => void
  seleccionarPlantilla: (id: PlantillaCatalogoId | null) => void
  actualizarPrecioPlantilla: (codigo: string, valor: string) => void
  actualizarNombreBoxPlantilla: (index: number, nombre: string) => void
  avanzarPaso: () => void
  retrocederPaso: () => void
  cancelarConfiguracion: () => Promise<void>
  handleSubmit: (e?: React.FormEvent) => Promise<void>
  finalizarBienvenida: () => void
}
