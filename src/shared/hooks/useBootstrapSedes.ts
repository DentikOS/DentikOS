import { useState, useCallback } from 'react'
import type React from 'react'
import { type Sede } from '../../domains/organization/clinic/schemas/sedeSchema'
import type { ExtendedBootstrapDatos } from '../types/bootstrapClinica'

export interface UseBootstrapSedesReturn {
  sedes: Sede[]
  setSedes: React.Dispatch<React.SetStateAction<Sede[]>>
  agregarSede: (sede: Sede) => void
  eliminarSede: (index: number) => void
  asegurarSedePrincipal: (datos: ExtendedBootstrapDatos) => void
}

export const crearSedePrincipal = (datos: ExtendedBootstrapDatos): Sede => ({
  nombre: 'Sede Principal',
  direccion: datos.direccion || 'Dirección Principal',
  comuna: datos.comuna || 'Comuna Central',
  region: datos.region || 'Región Metropolitana',
  telefono: datos.telefono || '',
  zonaHoraria: datos.zonaHoraria || 'America/Santiago',
  activa: true,
})

export const useBootstrapSedes = (sedesIniciales: Sede[] = []): UseBootstrapSedesReturn => {
  const [sedes, setSedes] = useState<Sede[]>(sedesIniciales)

  const agregarSede = useCallback((s: Sede) => {
    setSedes((prev) => [...prev, s])
  }, [])

  const eliminarSede = useCallback((idx: number) => {
    setSedes((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const asegurarSedePrincipal = useCallback((datos: ExtendedBootstrapDatos) => {
    setSedes((prev) => prev.length === 0 ? [crearSedePrincipal(datos)] : prev)
  }, [])

  return {
    sedes,
    setSedes,
    agregarSede,
    eliminarSede,
    asegurarSedePrincipal,
  }
}
