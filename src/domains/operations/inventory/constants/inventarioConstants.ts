/**
 * Constantes y Enumeraciones para el Módulo de Inventario e Insumos
 */

export interface ItemInventarioDefault {
  id: number
  nombre: string
  categoria: string
  cantidad: number
  minimoCritico: number
  unidad: string
  fechaVencimiento: string
  precioUnitario: number
  proveedor: string
}

export const CATEGORIAS_INSUMOS: readonly string[] = [
  'Anestésicos y Agujas',
  'Restauración y Resinas',
  'Endodoncia',
  'Cirugía e Implantes',
  'Protección e Higiene (EPP)',
  'Periodoncia y Profilaxis',
  'Impresión y Cementación',
  'Instrumental',
  'Esterilización'
]

export const UNIDADES_MEDIDA: readonly string[] = [
  'Cajas',
  'Unidades / Piezas',
  'Tubos / Cárpulas',
  'Frascos / Botellas',
  'Paquetes',
  'Kits'
]

export const ITEMS_INVENTARIO_DEFAULT: readonly ItemInventarioDefault[] = [
  {
    id: 1,
    nombre: 'Lidocaína 2% con Epinefrina (36mg)',
    categoria: 'Anestésicos y Agujas',
    cantidad: 45,
    minimoCritico: 20,
    unidad: 'Tubos / Cárpulas',
    fechaVencimiento: '2027-05-15',
    precioUnitario: 850,
    proveedor: 'Dental Ahumada'
  },
  {
    id: 2,
    nombre: 'Resina Composite Z350 A2',
    categoria: 'Restauración y Resinas',
    cantidad: 3,
    minimoCritico: 5,
    unidad: 'Unidades / Piezas',
    fechaVencimiento: '2026-11-30',
    precioUnitario: 32000,
    proveedor: '3M Oral Care'
  },
  {
    id: 3,
    nombre: 'Guantes de Nitrilo Talla M',
    categoria: 'Protección e Higiene (EPP)',
    cantidad: 8,
    minimoCritico: 10,
    unidad: 'Cajas',
    fechaVencimiento: '2028-01-10',
    precioUnitario: 6500,
    proveedor: 'Insumos Médicos Chile'
  }
]
