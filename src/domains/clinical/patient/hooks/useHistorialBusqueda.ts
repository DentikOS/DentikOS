import { useState, useEffect, useCallback } from 'react'
import { useSesionStore } from '../../../../app/stores/sesionStore'

const STORAGE_KEY = 'pacientes_historial_busqueda'
const MAX_HISTORIAL = 10

export const useHistorialBusqueda = () => {
  const userProfile = useSesionStore((s) => s.userProfile)
  const storageKey = `${STORAGE_KEY}_${userProfile?.id || 'anonimo'}`

  const [historial, setHistorial] = useState<string[]>([])
  const [mostrarHistorial, setMostrarHistorial] = useState(false)

  // Cargar historial al montar o cambiar usuario
  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        setHistorial(JSON.parse(stored))
      } catch (e) {
        console.error('Error cargando historial:', e)
      }
    } else {
      setHistorial([])
    }
  }, [storageKey])

  // Agregar búsqueda al historial
  const agregarBusqueda = useCallback((busqueda: string) => {
    const q = busqueda.trim()
    if (!q) return

    setHistorial((prev) => {
      const filtrado = prev.filter((b) => b !== q)
      const nuevo = [q, ...filtrado]
      const limitado = nuevo.slice(0, MAX_HISTORIAL)
      localStorage.setItem(storageKey, JSON.stringify(limitado))
      return limitado
    })
  }, [storageKey])

  // Limpiar historial
  const limpiarHistorial = useCallback(() => {
    setHistorial([])
    localStorage.removeItem(storageKey)
  }, [storageKey])

  return {
    historial,
    mostrarHistorial,
    setMostrarHistorial,
    agregarBusqueda,
    limpiarHistorial,
  }
}
