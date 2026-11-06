import ExcelJS from 'exceljs'
import { validarFechaIso, validarMoneda, validarMontoMenor } from '../../utils/validation'

export interface MapeoColumnasExtracto {
  fecha: string
  monto: string
  descripcion?: string
  referencia?: string
  moneda?: string
}

export interface FilaExtractoNormalizada {
  fecha: string
  montoMenor: number
  moneda: string
  descripcion: string
  referencia: string
}

export interface ResultadoParseoExtracto {
  filas: FilaExtractoNormalizada[]
}

export interface LimitesParseoExtracto {
  maxBytes?: number
  maxFilas?: number
  monedaPredeterminada?: string
}

export function inferirMapeoColumnasExtracto(encabezados: readonly string[]): MapeoColumnasExtracto {
  const resolver = (nombres: readonly string[]): string | undefined => {
    const coincidencia = encabezados.find((encabezado) => nombres.includes(normalizarEncabezado(encabezado)))
    return coincidencia
  }
  const fecha = resolver(['fecha', 'fechaoperacion', 'fechamovimiento', 'date', 'transactiondate'])
  const monto = resolver(['monto', 'montofirmado', 'importe', 'amount', 'transactionamount', 'valormovimiento'])
  if (!fecha || !monto) {
    throw new Error('El extracto debe incluir fecha y una columna de monto firmado; las columnas separadas de cargo/abono requieren consolidación previa.')
  }
  return {
    fecha,
    monto,
    descripcion: resolver(['glosa', 'descripcion', 'description', 'memo', 'detalle']),
    referencia: resolver(['referencia', 'referencianumero', 'documento', 'nodocumento', 'ndocumento', 'folio', 'ref', 'fitid']),
    moneda: resolver(['moneda', 'currency', 'curdef']),
  }
}

const limiteBytesPredeterminado = 5 * 1024 * 1024
const limiteFilasPredeterminado = 10_000

export function parsearCsvBancario(
  contenido: string,
  mapeo: MapeoColumnasExtracto,
  limites: LimitesParseoExtracto = {},
): ResultadoParseoExtracto {
  validarLimites(limites)
  validarTamano(new TextEncoder().encode(contenido).byteLength, limites)
  const delimitador = detectarDelimitador(contenido)
  const registros = leerCsv(contenido, delimitador).filter((registro) => registro.some((celda) => celda.trim() !== ''))
  if (registros.length < 2) throw new Error('El extracto debe incluir encabezados y al menos una fila.')
  const encabezados = validarEncabezados(registros[0])
  const indices = resolverIndices(encabezados, mapeo)
  const filasDatos = registros.slice(1)
  validarNumeroFilas(filasDatos.length, limites)

  return {
    filas: filasDatos.map((fila, indice) => {
      if (fila.length !== encabezados.length) throw new Error(`La fila ${indice + 2} tiene columnas incompletas o ambiguas.`)
      return normalizarFila({
        fecha: fila[indices.fecha],
        monto: fila[indices.monto],
        descripcion: leerIndiceOpcional(fila, indices.descripcion),
        referencia: leerIndiceOpcional(fila, indices.referencia),
        moneda: leerIndiceOpcional(fila, indices.moneda),
      }, limites, indice + 2)
    }),
  }
}

export async function parsearXlsxBancario(
  bytes: Uint8Array | ArrayBuffer,
  mapeo: MapeoColumnasExtracto,
  limites: LimitesParseoExtracto = {},
): Promise<ResultadoParseoExtracto> {
  validarLimites(limites)
  const contenido = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes
  validarTamano(contenido.byteLength, limites)
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.load(contenido as never)
  const hoja = libro.worksheets[0]
  if (!hoja) throw new Error('El archivo XLSX no contiene una hoja de movimientos.')
  validarNumeroFilas(Math.max(0, hoja.rowCount - 1), limites)
  const encabezados = validarEncabezados(
    Array.from({ length: hoja.columnCount }, (_, indice) => hoja.getRow(1).getCell(indice + 1).text),
  )
  const indices = resolverIndices(encabezados, mapeo)
  const filas = Array.from({ length: Math.max(0, hoja.rowCount - 1) }, (_, indice) => hoja.getRow(indice + 2))
    .filter((fila) => fila.cellCount > 0 && Array.from({ length: hoja.columnCount }, (_, indice) => fila.getCell(indice + 1).text.trim()).some(Boolean))
  validarNumeroFilas(filas.length, limites)

  return {
    filas: filas.map((fila, indice) => normalizarFila({
      fecha: valorCelda(fila.getCell(indices.fecha + 1).value, 'fecha'),
      monto: valorCelda(fila.getCell(indices.monto + 1).value, 'monto'),
      descripcion: leerCeldaOpcional(fila, indices.descripcion),
      referencia: leerCeldaOpcional(fila, indices.referencia),
      moneda: leerCeldaOpcional(fila, indices.moneda),
    }, limites, indice + 2)),
  }
}

export function parsearOfxBancario(contenido: string, limites: LimitesParseoExtracto = {}): ResultadoParseoExtracto {
  validarLimites(limites)
  validarTamano(new TextEncoder().encode(contenido).byteLength, limites)
  if (!/<OFX\b/i.test(contenido)) throw new Error('El archivo no tiene una estructura OFX reconocible.')
  const bloques = Array.from(contenido.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi), (match) => match[1])
  if (bloques.length === 0) throw new Error('El archivo OFX no contiene movimientos.')
  validarNumeroFilas(bloques.length, limites)
  const moneda = extraerTag(contenido, 'CURDEF') || limites.monedaPredeterminada
  if (!moneda) throw new Error('El archivo OFX no declara la moneda de la cuenta.')
  validarMoneda(moneda.trim().toUpperCase())

  return {
    filas: bloques.map((bloque, indice) => {
      const fechaCruda = extraerTag(bloque, 'DTPOSTED')
      const fecha = fechaCruda?.match(/^(\d{4})(\d{2})(\d{2})/)?.slice(1).join('-')
      const monto = extraerTag(bloque, 'TRNAMT')
      if (!fecha || monto === null) throw new Error(`El movimiento OFX ${indice + 1} no tiene fecha o monto válido.`)
      return normalizarFila({
        fecha,
        monto,
        moneda,
        referencia: extraerTag(bloque, 'FITID') ?? '',
        descripcion: extraerTag(bloque, 'MEMO') ?? extraerTag(bloque, 'NAME') ?? '',
      }, limites, indice + 1)
    }),
  }
}

function normalizarFila(
  fila: { fecha: string; monto: string; descripcion?: string; referencia?: string; moneda?: string },
  limites: LimitesParseoExtracto,
  numeroFila: number,
): FilaExtractoNormalizada {
  const fecha = normalizarFecha(fila.fecha, numeroFila)
  const moneda = (fila.moneda || limites.monedaPredeterminada || '').trim().toUpperCase()
  if (!moneda) throw new Error(`La fila ${numeroFila} no declara una moneda.`)
  validarMoneda(moneda)
  const montoMenor = parsearMontoMenor(fila.monto, numeroFila)
  validarMontoMenor(montoMenor, `monto de la fila ${numeroFila}`, true)
  return {
    fecha,
    montoMenor,
    moneda,
    descripcion: (fila.descripcion ?? '').trim(),
    referencia: (fila.referencia ?? '').trim(),
  }
}

function parsearMontoMenor(valor: string, numeroFila: number): number {
  let limpio = valor.trim().replace(/[\u2212]/g, '-')
  if (/^\(.*\)$/.test(limpio)) limpio = `-${limpio.slice(1, -1)}`
  limpio = limpio.replace(/\s/g, '').replace(/^[A-Z]{3}/i, '').replace(/[A-Z]{3}$/i, '').replace(/[$€£]/g, '')
  const negativo = limpio.startsWith('-')
  if (negativo || limpio.startsWith('+')) limpio = limpio.slice(1)
  if (!limpio || !/^\d[\d.,]*$/.test(limpio)) throw new Error(`El monto de la fila ${numeroFila} es inválido o ambiguo.`)

  const separadores = [...limpio.matchAll(/[.,]/g)].map((match) => ({ separador: match[0], indice: match.index! }))
  let entero = limpio
  let decimales = ''
  if (separadores.length > 0) {
    const separadoresUnicos = new Set(separadores.map(({ separador }) => separador))
    if (separadoresUnicos.size === 2) {
      const ultimo = separadores[separadores.length - 1]
      if (limpio.length - ultimo.indice - 1 < 1 || limpio.length - ultimo.indice - 1 > 2) {
        throw new Error(`El monto de la fila ${numeroFila} tiene decimales ambiguos.`)
      }
      decimales = limpio.slice(ultimo.indice + 1)
      entero = limpiarAgrupadores(limpio.slice(0, ultimo.indice), ultimo.separador === ',' ? '.' : ',')
    } else {
      const separador = separadores[0].separador
      const partes = limpio.split(separador)
      if (partes.length > 2) {
        if (partes.slice(1).every((parte) => /^\d{3}$/.test(parte))) entero = partes.join('')
        else throw new Error(`El monto de la fila ${numeroFila} tiene separadores ambiguos.`)
      } else {
        const fraccion = partes[1]
        if (/^\d{1,2}$/.test(fraccion)) {
          entero = partes[0]
          decimales = fraccion
        } else if (/^\d{3}$/.test(fraccion) && /^\d{1,3}$/.test(partes[0])) {
          entero = partes.join('')
        } else {
          throw new Error(`El monto de la fila ${numeroFila} tiene decimales ambiguos.`)
        }
      }
    }
  }
  if (!/^\d+$/.test(entero) || !/^\d{0,2}$/.test(decimales)) {
    throw new Error(`El monto de la fila ${numeroFila} está mal formado.`)
  }
  const menor = Number(entero) * 100 + Number(decimales.padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(menor)) throw new Error(`El monto de la fila ${numeroFila} excede el límite seguro.`)
  return negativo ? -menor : menor
}

function limpiarAgrupadores(valor: string, agrupador: string): string {
  const partes = valor.split(agrupador)
  if (partes.length < 2 || !/^\d{1,3}$/.test(partes[0]) || !partes.slice(1).every((parte) => /^\d{3}$/.test(parte))) {
    throw new Error('El monto tiene agrupadores de miles ambiguos.')
  }
  return partes.join('')
}

function normalizarFecha(valor: string, numeroFila: number): string {
  const fecha = valor.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    validarFechaIso(fecha, `fecha de la fila ${numeroFila}`)
    return fecha
  }
  const diaMesAnio = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!diaMesAnio) throw new Error(`La fecha de la fila ${numeroFila} no es reconocible.`)
  const [, dia, mes, anio] = diaMesAnio
  const normalizada = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  validarFechaIso(normalizada, `fecha de la fila ${numeroFila}`)
  return normalizada
}

function detectarDelimitador(contenido: string): string {
  const primeraLinea = contenido.split(/\r?\n/, 1)[0] ?? ''
  const conteos = contarDelimitadores(primeraLinea)
  if (conteos[';'] === 0 && conteos[','] === 0 && conteos['\t'] === 0) {
    throw new Error('No se pudo identificar el separador de columnas del CSV.')
  }
  const ordenados = Object.entries(conteos).sort((a, b) => b[1] - a[1])
  if (ordenados[0][1] === ordenados[1][1]) throw new Error('El separador del CSV es ambiguo.')
  return ordenados[0][0]
}

function contarDelimitadores(linea: string): Record<string, number> {
  const conteos: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let entreComillas = false
  for (let indice = 0; indice < linea.length; indice += 1) {
    const caracter = linea[indice]
    if (caracter === '"') {
      if (entreComillas && linea[indice + 1] === '"') indice += 1
      else entreComillas = !entreComillas
    } else if (!entreComillas && caracter in conteos) conteos[caracter] += 1
  }
  return conteos
}

function leerCsv(contenido: string, delimitador: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let entreComillas = false
  for (let indice = 0; indice < contenido.length; indice += 1) {
    const caracter = contenido[indice]
    if (caracter === '"') {
      if (entreComillas && contenido[indice + 1] === '"') {
        celda += '"'
        indice += 1
      } else if (entreComillas || celda.length === 0) entreComillas = !entreComillas
      else throw new Error('El CSV contiene comillas no escapadas.')
    } else if (!entreComillas && caracter === delimitador) {
      fila.push(celda)
      celda = ''
    } else if (!entreComillas && (caracter === '\n' || caracter === '\r')) {
      if (caracter === '\r' && contenido[indice + 1] === '\n') indice += 1
      fila.push(celda)
      filas.push(fila)
      fila = []
      celda = ''
    } else celda += caracter
  }
  if (entreComillas) throw new Error('El CSV tiene una celda entre comillas sin cerrar.')
  if (celda !== '' || fila.length > 0) {
    fila.push(celda)
    filas.push(fila)
  }
  return filas
}

function validarEncabezados(encabezados: readonly string[]): string[] {
  const normalizados = encabezados.map((encabezado) => encabezado.trim())
  if (normalizados.length === 0 || normalizados.some((encabezado) => encabezado === '')) {
    throw new Error('El extracto contiene encabezados vacíos.')
  }
  if (new Set(normalizados).size !== normalizados.length) throw new Error('El extracto contiene encabezados duplicados.')
  return normalizados
}

function resolverIndices(encabezados: readonly string[], mapeo: MapeoColumnasExtracto) {
  const nombres = [mapeo.fecha, mapeo.monto, mapeo.descripcion, mapeo.referencia, mapeo.moneda].filter(Boolean)
  if (new Set(nombres).size !== nombres.length) throw new Error('El mapeo de columnas es ambiguo.')
  const resolver = (nombre: string | undefined, obligatorio = false): number | undefined => {
    if (!nombre) return undefined
    const indice = encabezados.indexOf(nombre)
    if (indice < 0 && obligatorio) throw new Error(`No existe la columna obligatoria "${nombre}".`)
    return indice < 0 ? undefined : indice
  }
  return {
    fecha: resolver(mapeo.fecha, true)!,
    monto: resolver(mapeo.monto, true)!,
    descripcion: resolver(mapeo.descripcion),
    referencia: resolver(mapeo.referencia),
    moneda: resolver(mapeo.moneda),
  }
}

function leerIndiceOpcional(fila: readonly string[], indice: number | undefined): string | undefined {
  return indice === undefined ? undefined : fila[indice]
}

function leerCeldaOpcional(fila: ExcelJS.Row, indice: number | undefined): string | undefined {
  return indice === undefined ? undefined : valorCelda(fila.getCell(indice + 1).value, 'texto')
}

function valorCelda(valor: ExcelJS.CellValue | null | undefined, tipo: 'fecha' | 'monto' | 'texto'): string {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) {
    if (tipo !== 'fecha' || !Number.isFinite(valor.getTime())) throw new Error('La celda XLSX contiene un valor no reconocido.')
    return valor.toISOString().slice(0, 10)
  }
  if (typeof valor === 'number') {
    if (tipo === 'fecha') {
      if (!Number.isFinite(valor) || valor < 1) throw new Error('La celda XLSX contiene una fecha numérica inválida.')
      const fecha = new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * 86_400_000)
      if (!Number.isFinite(fecha.getTime())) throw new Error('La celda XLSX contiene una fecha fuera de rango.')
      return fecha.toISOString().slice(0, 10)
    }
    if (tipo !== 'monto' || !Number.isFinite(valor)) return String(valor)
    const escalado = valor * 100
    if (Math.abs(escalado - Math.round(escalado)) > 1e-6) throw new Error('La celda XLSX tiene más de dos decimales.')
    const menor = Math.round(escalado)
    validarMontoMenor(menor, 'monto XLSX', true)
    return `${menor < 0 ? '-' : ''}${Math.floor(Math.abs(menor) / 100)}.${String(Math.abs(menor) % 100).padStart(2, '0')}`
  }
  if (typeof valor === 'object' && 'text' in valor) return valor.text
  if (typeof valor === 'object' && 'result' in valor) return valorCelda(valor.result as ExcelJS.CellValue, tipo)
  return String(valor)
}

function extraerTag(contenido: string, nombre: string): string | null {
  return contenido.match(new RegExp(`<${nombre}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? null
}

function validarLimites(limites: LimitesParseoExtracto): void {
  for (const [nombre, valor] of [['maxBytes', limites.maxBytes], ['maxFilas', limites.maxFilas]] as const) {
    if (valor !== undefined && (!Number.isSafeInteger(valor) || valor < 1)) {
      throw new RangeError(`El límite ${nombre} debe ser un entero positivo.`)
    }
  }
}

function normalizarEncabezado(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function validarTamano(bytes: number, limites: LimitesParseoExtracto): void {
  if (bytes > (limites.maxBytes ?? limiteBytesPredeterminado)) {
    throw new RangeError('El extracto supera el límite de bytes permitido.')
  }
}

function validarNumeroFilas(filas: number, limites: LimitesParseoExtracto): void {
  if (filas > (limites.maxFilas ?? limiteFilasPredeterminado)) {
    throw new RangeError('El extracto supera el límite de filas permitido.')
  }
}
