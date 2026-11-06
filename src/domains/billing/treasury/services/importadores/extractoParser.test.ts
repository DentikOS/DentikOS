import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { inferirMapeoColumnasExtracto, parsearCsvBancario, parsearOfxBancario, parsearXlsxBancario } from './extractoParser'

describe('importadores de extractos', () => {
  it('reconoce encabezados comunes y rechaza columnas de cargo/abono sin importe firmado', () => {
    expect(inferirMapeoColumnasExtracto(['Fecha operación', 'Glosa', 'Monto', 'N° documento', 'Moneda'])).toEqual({
      fecha: 'Fecha operación', monto: 'Monto', descripcion: 'Glosa', referencia: 'N° documento', moneda: 'Moneda'
    })
    expect(() => inferirMapeoColumnasExtracto(['Fecha', 'Cargo', 'Abono'])).toThrow(/monto firmado/i)
  })

  it('lee CSV con separador de punto y coma o coma y normaliza decimales a unidades menores', () => {
    const porPuntoYComa = parsearCsvBancario(
      'fecha;descripcion;monto;referencia;moneda\n2026-11-04;Pago clínica;123.456,78;ABC-1;CLP',
      { fecha: 'fecha', descripcion: 'descripcion', monto: 'monto', referencia: 'referencia', moneda: 'moneda' },
    )
    const porComa = parsearCsvBancario(
      'fecha,descripcion,monto,referencia,moneda\n2026-11-04,Abono,1234.56,DEF-2,CLP',
      { fecha: 'fecha', descripcion: 'descripcion', monto: 'monto', referencia: 'referencia', moneda: 'moneda' },
    )

    expect(porPuntoYComa.filas[0]).toMatchObject({ fecha: '2026-11-04', montoMenor: 12_345_678, moneda: 'CLP' })
    expect(porComa.filas[0]).toMatchObject({ fecha: '2026-11-04', montoMenor: 123_456, moneda: 'CLP' })
  })

  it('lee XLSX y OFX y rechaza filas ambiguas, corruptas o por encima de límites', async () => {
    const libro = new ExcelJS.Workbook()
    const hoja = libro.addWorksheet('Movimientos')
    hoja.addRow(['fecha', 'descripcion', 'monto', 'referencia', 'moneda'])
    hoja.addRow(['2026-11-04', 'Pago', 5000.25, 'XYZ-7', 'CLP'])
    const bytes = await libro.xlsx.writeBuffer()
    const xlsx = await parsearXlsxBancario(bytes, {
      fecha: 'fecha', descripcion: 'descripcion', monto: 'monto', referencia: 'referencia', moneda: 'moneda',
    })
    const ofx = parsearOfxBancario(`
      OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CLP
      <BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261104120000[-3:SCL]
      <TRNAMT>5000.25<FITID>FIT-1<NAME>Pago dentista<MEMO>ABC-7</STMTTRN>
      </BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
    `)

    expect(xlsx.filas[0]).toMatchObject({ montoMenor: 500_025, referencia: 'XYZ-7' })
    expect(ofx.filas[0]).toMatchObject({ fecha: '2026-11-04', montoMenor: 500_025, referencia: 'FIT-1' })
    expect(() => parsearCsvBancario('fecha,monto\n2026-11-04,"1,2,3"', {
      fecha: 'fecha', descripcion: 'fecha', monto: 'monto', referencia: 'fecha', moneda: 'monto',
    })).toThrow(/monto|ambig/i)
    expect(() => parsearOfxBancario('<OFX><CURDEF>CLP<STMTTRN><DTPOSTED>20261104<NAME>Sin monto</STMTTRN></OFX>'))
      .toThrow(/TRNAMT|monto/i)
    expect(() => parsearCsvBancario('fecha;monto\n2026-11-04;1\n2026-11-05;2', {
      fecha: 'fecha', monto: 'monto',
    }, { maxFilas: 1 })).toThrow(/límite|filas/i)
    expect(() => parsearCsvBancario('fecha;monto\n2026-11-04;1', {
      fecha: 'fecha', monto: 'monto',
    }, { maxBytes: 5 })).toThrow(/límite|bytes/i)
  })

  it('interpreta fechas seriales de Excel y rechaza agrupadores numéricos ambiguos', async () => {
    const libro = new ExcelJS.Workbook()
    const hoja = libro.addWorksheet('Movimientos')
    hoja.addRow(['fecha', 'monto', 'moneda'])
    hoja.addRow([45234, 100, 'CLP'])
    const bytes = await libro.xlsx.writeBuffer()
    const xlsx = await parsearXlsxBancario(bytes, { fecha: 'fecha', monto: 'monto', moneda: 'moneda' })

    expect(xlsx.filas[0]).toMatchObject({ fecha: '2023-11-04', montoMenor: 10_000 })
  })

  it('rechaza agrupadores numéricos ambiguos', () => {
    expect(() => parsearCsvBancario('fecha;monto;moneda\n2026-11-04;1234.567;CLP', {
      fecha: 'fecha', monto: 'monto', moneda: 'moneda',
    })).toThrow(/monto|ambig/i)
  })
})
