/**
 * Constantes de nombres de eventos Realtime (F5-02).
 *
 * Define los nombres canónicos de los eventos custom que se emiten
 * cuando hay cambios en tablas de Supabase que NO tienen store Zustand.
 *
 * Los hooks de módulos individuales (useAgenda, usePresupuestos, etc.)
 * pueden escuchar estos eventos para refrescarse cuando hay cambios
 * desde otros dispositivos.
 *
 * Uso en emisor (useRealtimeSync.js):
 *   window.dispatchEvent(new CustomEvent(REALTIME_EVENTS.CITAS_CHANGED))
 *
 * Uso en receptor (hook de módulo):
 *   useEffect(() => {
 *     const handler = () => { /* refrescar datos *\/ }
 *     window.addEventListener(REALTIME_EVENTS.CITAS_CHANGED, handler)
 *     return () => window.removeEventListener(REALTIME_EVENTS.CITAS_CHANGED, handler)
 *   }, [])
 */

export const REALTIME_EVENTS = {
  // Eventos de módulos con estado local (sin store Zustand)
  CITAS_CHANGED: 'realtime:citas_changed',
  PRESUPUESTOS_CHANGED: 'realtime:presupuestos_changed',
  PAGOS_CHANGED: 'realtime:pagos_changed',
  FINANZAS_CHANGED: 'realtime:finanzas_changed',

  // Eventos de datos clínicos (hooks individuales escucharán en trabajo incremental)
  EVOLUCIONES_CHANGED: 'realtime:evoluciones_changed',
  RECETAS_CHANGED: 'realtime:recetas_changed',
  ODONTOGRAMA_CHANGED: 'realtime:odontograma_changed',
  PERIODONTOGRAMA_CHANGED: 'realtime:periodontograma_changed',

  // Eventos de inventario
  INVENTARIO_CHANGED: 'realtime:inventario_changed',
  ESTERILIZACION_CHANGED: 'realtime:esterilizacion_changed',
  LABORATORIO_CHANGED: 'realtime:laboratorio_changed',

  // Eventos de datos de referencia (vademécum, alergias cruzadas, etc.)
  VADEMECUM_CHANGED: 'realtime:vademecum_changed'
} as const

export type RealtimeEventName = typeof REALTIME_EVENTS[keyof typeof REALTIME_EVENTS]

/**
 * Tablas críticas que requieren sincronización en tiempo real.
 * Mapea nombre de tabla → nombre de evento a emitir.
 */
export const TABLAS_REALTIME: Readonly<Record<string, RealtimeEventName | null>> = {
  pacientes: null, // Usa pacientesStore.refrescarDesdeSupabase()
  citas: REALTIME_EVENTS.CITAS_CHANGED,
  presupuestos: REALTIME_EVENTS.PRESUPUESTOS_CHANGED,
  presupuesto_items: REALTIME_EVENTS.PRESUPUESTOS_CHANGED,
  pagos: REALTIME_EVENTS.PAGOS_CHANGED,
  movimientos_financieros: REALTIME_EVENTS.FINANZAS_CHANGED,
  evoluciones_clinicas: REALTIME_EVENTS.EVOLUCIONES_CHANGED,
  recetas: REALTIME_EVENTS.RECETAS_CHANGED,
  odontogramas: REALTIME_EVENTS.ODONTOGRAMA_CHANGED,
  periodontogramas: REALTIME_EVENTS.PERIODONTOGRAMA_CHANGED,
  inventario: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_proveedores: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_ubicaciones: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_lotes: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_stock_por_ubicacion: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_movimientos: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_ordenes_compra: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_orden_compra_items: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_kits: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_kit_items: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_ventas: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_venta_items: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_mantenciones: REALTIME_EVENTS.INVENTARIO_CHANGED,
  inventario_permisos_aditivos: REALTIME_EVENTS.INVENTARIO_CHANGED,
  esterilizacion_programas: REALTIME_EVENTS.ESTERILIZACION_CHANGED,
  esterilizacion_insumos_config: REALTIME_EVENTS.ESTERILIZACION_CHANGED,
  esterilizacion_ciclos: REALTIME_EVENTS.ESTERILIZACION_CHANGED,
  esterilizacion_ciclo_instrumentos: REALTIME_EVENTS.ESTERILIZACION_CHANGED,
  esterilizacion_pasos: REALTIME_EVENTS.ESTERILIZACION_CHANGED,
  esterilizacion_pruebas: REALTIME_EVENTS.ESTERILIZACION_CHANGED,
  esterilizacion_usos: REALTIME_EVENTS.ESTERILIZACION_CHANGED,
  esterilizacion_eventos: REALTIME_EVENTS.ESTERILIZACION_CHANGED,
  laboratorios: REALTIME_EVENTS.LABORATORIO_CHANGED,
  laboratorio_tipos_trabajo: REALTIME_EVENTS.LABORATORIO_CHANGED,
  laboratorio_precios: REALTIME_EVENTS.LABORATORIO_CHANGED,
  plantillas_laboratorio: REALTIME_EVENTS.LABORATORIO_CHANGED,
  ordenes_laboratorio: REALTIME_EVENTS.LABORATORIO_CHANGED,
  historial_etapas_laboratorio: REALTIME_EVENTS.LABORATORIO_CHANGED,
  garantias_laboratorio: REALTIME_EVENTS.LABORATORIO_CHANGED,
  permisos_laboratorio_aditivos: REALTIME_EVENTS.LABORATORIO_CHANGED,
  ordenes_laboratorio_costos: REALTIME_EVENTS.LABORATORIO_CHANGED,
  laboratorio_pagos: REALTIME_EVENTS.LABORATORIO_CHANGED,
  archivos_clinicos: REALTIME_EVENTS.LABORATORIO_CHANGED,
  garantias_laboratorio_historial: REALTIME_EVENTS.LABORATORIO_CHANGED,
  configuracion_alertas_laboratorio: REALTIME_EVENTS.LABORATORIO_CHANGED,
  alertas_laboratorio_estado: REALTIME_EVENTS.LABORATORIO_CHANGED,
  vademecum: REALTIME_EVENTS.VADEMECUM_CHANGED,
  vademecum_urgencia: REALTIME_EVENTS.VADEMECUM_CHANGED,
  vademecum_antirresortivos: REALTIME_EVENTS.VADEMECUM_CHANGED,
  alergias_cruzadas: REALTIME_EVENTS.VADEMECUM_CHANGED,
  interacciones_farmacologicas: REALTIME_EVENTS.VADEMECUM_CHANGED,
  profilaxis_endocarditis: REALTIME_EVENTS.VADEMECUM_CHANGED,
  manejo_anticoagulantes: REALTIME_EVENTS.VADEMECUM_CHANGED,
  reference_data_meta: REALTIME_EVENTS.VADEMECUM_CHANGED,
}
