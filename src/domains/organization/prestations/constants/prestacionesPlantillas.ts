export type PlantillaCatalogoId = 'general' | 'ortodoncia' | 'cirugia_rehabilitacion'

export interface PrestacionPlantilla {
  codigoInterno: string
  nombre: string
  categoria: string
  especialidad: string
  precioParticular: number
  precioFonasa: null
}

const generar = (
  codigo: string,
  nombre: string,
  categoria: string,
  especialidad: string,
  precioParticular: number,
): PrestacionPlantilla => ({ codigoInterno: codigo, nombre, categoria, especialidad, precioParticular, precioFonasa: null })

const BASE: PrestacionPlantilla[] = [
  generar('PRE-01', 'Limpieza dental (profilaxis)', 'Preventivo', 'Diagnóstico y Prevención', 50000),
  generar('PRE-02', 'Fluoración', 'Preventivo', 'Diagnóstico y Prevención', 20000),
  generar('PRE-03', 'Sellantes oclusales', 'Preventivo', 'Diagnóstico y Prevención', 30000),
  generar('PRE-04', 'Control odontológico', 'Preventivo', 'Diagnóstico y Prevención', 25000),
  generar('RES-01', 'Restauración composite', 'Restaurador', 'Operatoria / Estética', 80000),
  generar('RES-02', 'Restauración amalgama', 'Restaurador', 'Operatoria / Estética', 60000),
  generar('END-01', 'Endodoncia unirradicular', 'Endodoncia', 'Endodoncia', 120000),
  generar('END-02', 'Endodoncia birradicular', 'Endodoncia', 'Endodoncia', 180000),
  generar('END-03', 'Endodoncia multirradicular', 'Endodoncia', 'Endodoncia', 220000),
  generar('CIR-01', 'Exodoncia simple', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 80000),
  generar('CIR-02', 'Exodoncia compleja', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 150000),
  generar('PRO-01', 'Corona de porcelana', 'Prótesis', 'Rehabilitación y Prótesis', 150000),
  generar('PRO-02', 'Corona temporal', 'Prótesis', 'Rehabilitación y Prótesis', 50000),
  generar('PRO-03', 'Prótesis parcial removible', 'Prótesis', 'Rehabilitación y Prótesis', 400000),
  generar('PRO-04', 'Prótesis total', 'Prótesis', 'Rehabilitación y Prótesis', 600000),
  generar('URG-01', 'Atención de urgencia', 'Urgencias', 'Urgencias', 40000),
  generar('RAD-01', 'Radiografía periapical', 'Diagnóstico', 'Diagnóstico y Prevención', 8000),
  generar('RAD-02', 'Radiografía panorámica', 'Diagnóstico', 'Diagnóstico y Prevención', 25000),
  generar('EST-01', 'Blanqueamiento dental', 'Estética', 'Operatoria / Estética', 220000),
  generar('PER-01', 'Destartraje', 'Periodoncia', 'Periodoncia', 40000),
]

const ORTODONCIA: PrestacionPlantilla[] = [
  generar('ORT-01', 'Instalación brackets metálicos', 'Ortodoncia', 'Ortodoncia y Ortopedia', 800000),
  generar('ORT-02', 'Instalación brackets estéticos', 'Ortodoncia', 'Ortodoncia y Ortopedia', 1200000),
  generar('ORT-03', 'Instalación brackets cerámicos', 'Ortodoncia', 'Ortodoncia y Ortopedia', 1500000),
  generar('ORT-04', 'Control de ortodoncia mensual', 'Ortodoncia', 'Ortodoncia y Ortopedia', 30000),
  generar('ORT-05', 'Cambio de arcos', 'Ortodoncia', 'Ortodoncia y Ortopedia', 40000),
  generar('ORT-06', 'Instalación de retenedor', 'Ortodoncia', 'Ortodoncia y Ortopedia', 150000),
  generar('ORT-07', 'Ortodoncia invisible (alineadores)', 'Ortodoncia', 'Ortodoncia y Ortopedia', 3500000),
  generar('ORT-08', 'Reparación de bracket', 'Ortodoncia', 'Ortodoncia y Ortopedia', 20000),
  generar('ORT-09', 'Retiro de brackets', 'Ortodoncia', 'Ortodoncia y Ortopedia', 80000),
  generar('ORT-10', 'Fotografía y cefalometría', 'Ortodoncia', 'Ortodoncia y Ortopedia', 50000),
]

const CIRUGIA_REHABILITACION: PrestacionPlantilla[] = [
  generar('CIR-10', 'Instalación de implante', 'Cirugía', 'Implantología', 800000),
  generar('CIR-11', 'Elevación de seno maxilar', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 600000),
  generar('CIR-12', 'Injerto óseo', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 400000),
  generar('CIR-13', 'Exodoncia quirúrgica', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 150000),
  generar('CIR-14', 'Cirugía de terceros molares (por pieza)', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 250000),
  generar('CIR-15', 'Frenectomía', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 180000),
  generar('CIR-16', 'Alveolectomía', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 200000),
  generar('CIR-17', 'Apicectomía', 'Cirugía', 'Cirugía Bucal y Maxilofacial', 280000),
  generar('REH-01', 'Corona sobre implante', 'Rehabilitación', 'Rehabilitación y Prótesis', 350000),
  generar('REH-02', 'Prótesis fija implantosoportada', 'Rehabilitación', 'Rehabilitación y Prótesis', 2500000),
  generar('REH-03', 'Carillas de porcelana', 'Rehabilitación', 'Rehabilitación y Prótesis', 250000),
  generar('REH-04', 'Incrustación onlay/inlay', 'Rehabilitación', 'Rehabilitación y Prótesis', 180000),
  generar('REH-05', 'Perno muñón', 'Rehabilitación', 'Rehabilitación y Prótesis', 100000),
  generar('REH-06', 'Puente de porcelana (3 unidades)', 'Rehabilitación', 'Rehabilitación y Prótesis', 450000),
  generar('REH-07', 'Diseño de sonrisa (DSD)', 'Rehabilitación', 'Rehabilitación y Prótesis', 800000),
]

export const PLANTILLAS_CATALOGO: ReadonlyArray<{
  id: PlantillaCatalogoId
  nombre: string
  descripcion: string
  prestaciones: PrestacionPlantilla[]
}> = [
  {
    id: 'general',
    nombre: 'Clínica General',
    descripcion: '20 prestaciones base de prevención, operatoria, endodoncia, cirugía y rehabilitación.',
    prestaciones: BASE,
  },
  {
    id: 'ortodoncia',
    nombre: 'Ortodoncia',
    descripcion: 'Las 20 prestaciones generales más 10 de ortodoncia.',
    prestaciones: [...BASE, ...ORTODONCIA],
  },
  {
    id: 'cirugia_rehabilitacion',
    nombre: 'Cirugía + Rehabilitación',
    descripcion: 'Las 20 prestaciones generales más 8 quirúrgicas y 7 de rehabilitación.',
    prestaciones: [...BASE, ...CIRUGIA_REHABILITACION],
  },
]

export const obtenerPlantillaCatalogo = (id: PlantillaCatalogoId): PrestacionPlantilla[] => {
  const plantilla = PLANTILLAS_CATALOGO.find((item) => item.id === id)
  return (plantilla?.prestaciones ?? []).map((prestacion) => ({ ...prestacion }))
}
