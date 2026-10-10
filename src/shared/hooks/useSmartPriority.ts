import { useState, useEffect, useCallback } from 'react'
import { leerJSON, escribirJSON } from '../../infrastructure/storage/localStorageRepository'
import { useDashboardStore } from '../../app/stores/useDashboardStore'
import { WIDGET_CONFIG } from '../../application/analytics/dashboard/constants/dashboardConstants'
import type { WidgetType } from '../types/dashboardTypes'

const STORAGE_KEY = 'dashboard_smart_priority_clicks'
const DIAS_7 = 7 * 24 * 60 * 60 * 1000

interface ClickRecord {
  widgetId: string
  timestamp: number
}

export const useSmartPriority = () => {
  const { widgetOrder, reorderWidgets } = useDashboardStore()
  const [sugerencia, setSugerencia] = useState<{ widgetId: string; nombre: string } | null>(null)

  const evaluarSugerencia = useCallback(() => {
    const ahora = Date.now()
    const raw = leerJSON<ClickRecord[]>(STORAGE_KEY, [])
    const recientes = raw.filter((r) => ahora - r.timestamp < DIAS_7)
    if (recientes.length < 5) return

    const conteo: Record<string, number> = {}
    recientes.forEach((r) => {
      conteo[r.widgetId] = (conteo[r.widgetId] || 0) + 1
    })

    const masClickeado = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]
    if (masClickeado && masClickeado[1] / recientes.length > 0.5) {
      const topId = masClickeado[0]
      if (widgetOrder[0] !== topId) {
        const config = WIDGET_CONFIG[topId as WidgetType]
        setSugerencia({
          widgetId: topId,
          nombre: config?.titulo || topId
        })
      }
    }
  }, [widgetOrder])

  const registrarClickWidget = useCallback((widgetId: string) => {
    const raw = leerJSON<ClickRecord[]>(STORAGE_KEY, [])
    const actualizado = [...raw, { widgetId, timestamp: Date.now() }]
    escribirJSON(STORAGE_KEY, actualizado)
    evaluarSugerencia()
  }, [evaluarSugerencia])

  const aceptarSugerencia = useCallback(() => {
    if (!sugerencia) return
    const nuevoOrden = [sugerencia.widgetId, ...widgetOrder.filter((id) => id !== sugerencia.widgetId)]
    reorderWidgets(nuevoOrden)
    setSugerencia(null)
  }, [sugerencia, widgetOrder, reorderWidgets])

  const descartarSugerencia = useCallback(() => {
    setSugerencia(null)
  }, [])

  useEffect(() => {
    evaluarSugerencia()
  }, [evaluarSugerencia])

  return { sugerencia, registrarClickWidget, aceptarSugerencia, descartarSugerencia }
}
