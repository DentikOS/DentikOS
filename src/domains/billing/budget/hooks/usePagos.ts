import { useState } from 'react'
import { pagosService, type RegistrarPagoInput } from '../services/pagosService'

export const usePagos = () => {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const registrarPago = async (input: RegistrarPagoInput) => {
    setCargando(true)
    setError(null)
    try {
      const res = pagosService.registrarPagoManual(input)
      return res
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar pago'
      setError(msg)
      throw err
    } finally {
      setCargando(false)
    }
  }

  return {
    registrarPago,
    cargando,
    error,
  }
}
