import { useState, useEffect, useCallback } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { usePacientesStore, type FiltrosPacientes } from '../../../../app/stores/pacientesStore'

const STORAGE_KEY = 'pacientes_filtros_guardados'

export interface FiltroGuardado {
  id: string
  nombre: string
  filtros: FiltrosPacientes
  creadoEn: string
}

export const useFiltrosGuardados = () => {
  const userProfile = useSesionStore((s) => s.userProfile)
  const storageKey = `${STORAGE_KEY}_${userProfile?.id || 'anonimo'}`
  const filtrosActuales = usePacientesStore((s) => s.filtros)
  const setFiltros = usePacientesStore((s) => s.setFiltros)

  const [filtrosGuardados, setFiltrosGuardados] = useState<FiltroGuardado[]>([])

  // Cargar filtros guardados al montar o cambiar de usuario
  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        setFiltrosGuardados(JSON.parse(stored))
      } catch (e) {
        console.error('Error cargando filtros guardados:', e)
      }
    } else {
      setFiltrosGuardados([])
    }
  }, [storageKey])

  // Guardar filtro actual
  const guardarFiltro = useCallback((nombre: string) => {
    const nuevoFiltro: FiltroGuardado = {
      id: crypto.randomUUID(),
      nombre,
      filtros: { ...filtrosActuales },
      creadoEn: new Date().toISOString(),
    }

    setFiltrosGuardados((prev) => {
      const nuevos = [...prev, nuevoFiltro]
      localStorage.setItem(storageKey, JSON.stringify(nuevos))
      return nuevos
    })
  }, [filtrosActuales, storageKey])

  // Aplicar filtro guardado
  const aplicarFiltro = useCallback((id: string) => {
    const filtro = filtrosGuardados.find((f) => f.id === id)
    if (filtro) {
      setFiltros(filtro.filtros)
    }
  }, [filtrosGuardados, setFiltros])

  // Eliminar filtro guardado
  const eliminarFiltro = useCallback((id: string) => {
    setFiltrosGuardados((prev) => {
      const nuevos = prev.filter((f) => f.id !== id)
      localStorage.setItem(storageKey, JSON.stringify(nuevos))
      return nuevos
    })
  }, [storageKey])

  return {
    filtrosGuardados,
    guardarFiltro,
    aplicarFiltro,
    eliminarFiltro,
  }
}
