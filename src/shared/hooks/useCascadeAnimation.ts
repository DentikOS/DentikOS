import { useEffect, useRef } from 'react'

/**
 * Hook que detecta si es el mount inicial de la app (Blueprint 02 §03).
 * Retorna true solo durante la ventana de carga inicial (~600ms) y luego false.
 * Evita animaciones repetidas de cascada en re-renders posteriores.
 */
export const useIsInitialMount = (durationMs = 600): boolean => {
  const isInitialMountRef = useRef(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialMountRef.current = false
    }, durationMs)

    return () => clearTimeout(timer)
  }, [durationMs])

  return isInitialMountRef.current
}
