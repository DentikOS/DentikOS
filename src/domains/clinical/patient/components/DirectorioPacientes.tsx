/**
 * DirectorioPacientes v3 (BP06 Completeness)
 *
 * Integración con PacientesListado (3 vistas: Lista, Tabla, Tarjetas,
 * KPIs rápidos, búsqueda 150ms debounced y acciones masivas).
 * Mantiene compatibilidad total con props y data-testids.
 */
import React, { memo } from 'react'
import { PacientesListado, type PacientesListadoProps } from './listado/PacientesListado'

export type DirectorioPacientesProps = PacientesListadoProps

export const DirectorioPacientes: React.FC<DirectorioPacientesProps> = memo((props) => {
  return <PacientesListado {...props} />
})

DirectorioPacientes.displayName = 'DirectorioPacientes'
