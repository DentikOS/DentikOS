/**
 * Constantes y Enumeraciones para el Módulo de Finanzas Avanzado
 */

export interface ConvenioConfig {
  id: string
  nombre: string
  descuentoDefecto: number
  descripcion: string
}

export interface MetodoPagoOpcion {
  id: string
  nombre: string
  comisionPct: number
}

// La clínica define sus convenios en configuracion_convenios compartida.
// No precargar tasas ilustrativas como si fueran acuerdos reales.
export const CONVENIOS_DEFAULT: readonly ConvenioConfig[] = []

export const CATEGORIAS_EGRESO: readonly string[] = [
  'Insumos Odontológicos (Casa Dental)',
  'Arriendo / Servicios Básicos / Gastos Comunes',
  'Pago Honorarios Especialista / Cirujano',
  'Sueldos Personal / TENS / Recepción',
  'Mantenimiento Equipos / Autoclave',
  'Impuestos / Contabilidad',
  'Otros Gastos Operativos'
]

export const CATEGORIAS_INGRESO: readonly string[] = [
  'Abono Tratamiento Paciente',
  'Pago Presupuesto Completo',
  'Reembolso Convenio / Seguro / Isapre',
  'Otros Ingresos'
]

export const METODOS_PAGO_OPCIONES: readonly MetodoPagoOpcion[] = [
  { id: 'Efectivo', nombre: 'Efectivo', comisionPct: 0 },
  { id: 'Débito', nombre: 'Tarjeta Débito (POS / Transbank)', comisionPct: 1.2 },
  { id: 'Crédito', nombre: 'Tarjeta Crédito (POS / Transbank)', comisionPct: 2.1 },
  { id: 'Transferencia', nombre: 'Transferencia Bancaria', comisionPct: 0 },
  { id: 'Cheque', nombre: 'Cheque', comisionPct: 0 }
]

export const PORCENTAJE_RETENCION_HONORARIOS_DEFAULT = 13.75
