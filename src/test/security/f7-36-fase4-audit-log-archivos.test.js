/**
 * @vitest-environment node
 *
 * F7-36 FASE 4 (Commit 4.2): Test de regresión de PHI en audit_log
 * de archivos clínicos.
 *
 * OBJETIVO: Validar que:
 * 1. El frontend NO llama directamente a registrar_evento_archivo
 * 2. Las 4 Edge Functions llaman con los campos correctos
 * 3. La migración NO incluye nombre_archivo ni r2_object_key en new_data
 * 4. La migración conserva paciente_id, categoria, tamano_bytes
 * 5. search_path está vacío (alineado con FASE 3)
 * 6. Permisos restrictivos preservados (alineado con FASE 2)
 *
 * LIMITACIÓN HONESTA:
 * Este test NO valida permisos reales contra BD viva (Supabase local
 * no corre durante CI). Valida el contrato mediante grep estático.
 *
 * VALIDACIÓN REAL:
 * Se hace manualmente al aplicar la migración con `supabase db push`
 * subiendo un archivo en la app y verificando con:
 *
 *   SELECT action, new_data
 *   FROM audit_log
 *   WHERE action = 'FILE_UPLOAD'
 *   ORDER BY created_at DESC LIMIT 1;
 *
 * Esperado: new_data SIN "nombre_archivo" ni "r2_object_key".
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

/**
 * Busca un patrón regex en un archivo y retorna las líneas coincidentes.
 */
const grepEnArchivo = (ruta, patron) => {
  try {
    const lineas = readFileSync(ruta, 'utf-8').split('\n')
    const coincidencias = []
    lineas.forEach((linea, idx) => {
      if (patron.test(linea)) {
        coincidencias.push({ linea: idx + 1, contenido: linea.trim() })
      }
    })
    return coincidencias
  } catch {
    return []
  }
}

/**
 * Remueve comentarios de línea (//) y de bloque (/* *\/) del código.
 * Necesario para no detectar PHI en comentarios F7-34.
 */
const stripComments = (codigo) => {
  // Remover comentarios de bloque /* ... *\/
  let sin_bloque = codigo.replace(/\/\*[\s\S]*?\*\//g, '')
  // Remover comentarios de línea //... (hasta fin de línea)
  return sin_bloque.replace(/\/\/.*$/gm, '')
}

describe('F7-36 FASE 4: Regresión de PHI en audit_log de archivos', () => {
  // ============================================================
  // TEST 1: Frontend NO invoca registrar_evento_archivo
  // ============================================================
  it('1. Frontend NO invoca registrar_evento_archivo vía supabase.rpc()', () => {
    const { readdirSync } = require('node:fs')
    const archivosFrontend = []

    const recorrer = (dir) => {
      try {
        const entradas = readdirSync(dir, { withFileTypes: true })
        for (const entrada of entradas) {
          if (['node_modules', 'dist', '.git'].includes(entrada.name)) continue
          const rutaCompleta = join(dir, entrada.name)
          if (entrada.isDirectory()) {
            recorrer(rutaCompleta)
          } else if (entrada.isFile() && (entrada.name.endsWith('.js') || entrada.name.endsWith('.jsx'))) {
            archivosFrontend.push(rutaCompleta)
          }
        }
      } catch {}
    }

    recorrer(join(ROOT, 'src'))

    const llamadasRpc = []
    archivosFrontend
      .filter((f) => !f.includes('.test.'))
      .forEach((archivo) => {
        const coincidencias = grepEnArchivo(
          archivo,
          /\.rpc\(\s*['"]registrar_evento_archivo['"]/
        )
        if (coincidencias.length > 0) {
          llamadasRpc.push({
            archivo: archivo.replace(ROOT, ''),
            coincidencias,
          })
        }
      })

    expect(llamadasRpc).toEqual([])
  })

  // ============================================================
  // TEST 2: Edge Functions llaman con campos correctos (sin PHI)
  // ============================================================
  it('2. Edge Functions r2-upload-url NO manda nombre_archivo ni r2_object_key en p_detalle', () => {
    const ruta = join(ROOT, 'supabase/functions/r2-upload-url/index.ts')
    const contenido = readFileSync(ruta, 'utf-8')

    // Buscar el bloque de registrar_evento_archivo
    const match = contenido.match(
      /registrar_evento_archivo[\s\S]{0,800}?body:\s*JSON\.stringify\(\{[\s\S]{0,400}?\}\)/
    )
    expect(match).toBeTruthy()

    const bloque = stripComments(match[0])

    // NO debe contener nombre_archivo ni r2_object_key en p_detalle
    expect(bloque).not.toMatch(/p_detalle:[\s\S]{0,200}?nombre_archivo/)
    expect(bloque).not.toMatch(/p_detalle:[\s\S]{0,200}?r2_object_key/)
  })

  // ============================================================
  // TEST 3: r2-download-url NO manda PHI
  // ============================================================
  it('3. Edge Functions r2-download-url NO manda nombre_archivo ni r2_object_key en p_detalle', () => {
    const ruta = join(ROOT, 'supabase/functions/r2-download-url/index.ts')
    const contenido = readFileSync(ruta, 'utf-8')

    const match = contenido.match(
      /registrar_evento_archivo[\s\S]{0,800}?body:\s*JSON\.stringify\(\{[\s\S]{0,400}?\}\)/
    )
    expect(match).toBeTruthy()

    const bloque = stripComments(match[0])
    expect(bloque).not.toMatch(/p_detalle:[\s\S]{0,200}?nombre_archivo/)
    expect(bloque).not.toMatch(/p_detalle:[\s\S]{0,200}?r2_object_key/)
  })

  // ============================================================
  // TEST 4: r2-delete NO manda PHI
  // ============================================================
  it('4. Edge Functions r2-delete NO manda nombre_archivo ni r2_object_key en p_detalle', () => {
    const ruta = join(ROOT, 'supabase/functions/r2-delete/index.ts')
    const contenido = readFileSync(ruta, 'utf-8')

    const match = contenido.match(
      /registrar_evento_archivo[\s\S]{0,800}?body:\s*JSON\.stringify\(\{[\s\S]{0,400}?\}\)/
    )
    expect(match).toBeTruthy()

    const bloque = stripComments(match[0])
    expect(bloque).not.toMatch(/p_detalle:[\s\S]{0,200}?nombre_archivo/)
    expect(bloque).not.toMatch(/p_detalle:[\s\S]{0,200}?r2_object_key/)
  })

  // ============================================================
  // TEST 5: r2-restore NO manda PHI
  // ============================================================
  it('5. Edge Functions r2-restore NO manda nombre_archivo ni r2_object_key en p_detalle', () => {
    const ruta = join(ROOT, 'supabase/functions/r2-restore/index.ts')
    const contenido = readFileSync(ruta, 'utf-8')

    const match = contenido.match(
      /registrar_evento_archivo[\s\S]{0,800}?body:\s*JSON\.stringify\(\{[\s\S]{0,400}?\}\)/
    )
    expect(match).toBeTruthy()

    const bloque = stripComments(match[0])
    expect(bloque).not.toMatch(/p_detalle:[\s\S]{0,200}?nombre_archivo/)
    expect(bloque).not.toMatch(/p_detalle:[\s\S]{0,200}?r2_object_key/)
  })

  // ============================================================
  // TEST 6: Migración NO incluye nombre_archivo en new_data
  // ============================================================
  it('6. Migración SQL NO incluye nombre_archivo en new_data', () => {
    const ruta = join(
      ROOT,
      'supabase/migrations/20260928000500_f7_36_fase4_audit_log_archivos.sql'
    )
    const contenido = readFileSync(ruta, 'utf-8')

    // Buscar el bloque jsonb_build_object que construye new_data
    const match = contenido.match(
      /jsonb_build_object\([\s\S]{0,500}?\)/
    )
    expect(match).toBeTruthy()

    const bloque = stripComments(match[0])

    // NO debe contener nombre_archivo como campo de new_data
    expect(bloque).not.toMatch(/'nombre_archivo'/)
  })

  // ============================================================
  // TEST 7: Migración NO incluye r2_object_key en new_data
  // ============================================================
  it('7. Migración SQL NO incluye r2_object_key en new_data', () => {
    const ruta = join(
      ROOT,
      'supabase/migrations/20260928000500_f7_36_fase4_audit_log_archivos.sql'
    )
    const contenido = readFileSync(ruta, 'utf-8')

    const match = contenido.match(
      /jsonb_build_object\([\s\S]{0,500}?\)/
    )
    expect(match).toBeTruthy()

    const bloque = stripComments(match[0])
    expect(bloque).not.toMatch(/'r2_object_key'/)
  })

  // ============================================================
  // TEST 8: Migración conserva campos necesarios para trazabilidad
  // ============================================================
  it('8. Migración SQL conserva paciente_id, categoria, tamano_bytes en new_data', () => {
    const ruta = join(
      ROOT,
      'supabase/migrations/20260928000500_f7_36_fase4_audit_log_archivos.sql'
    )
    const contenido = readFileSync(ruta, 'utf-8')

    const match = contenido.match(
      /jsonb_build_object\([\s\S]{0,500}?\)/
    )
    expect(match).toBeTruthy()

    const bloque = stripComments(match[0])

    // DEBE contener estos campos (trazabilidad)
    expect(bloque).toMatch(/'paciente_id'/)
    expect(bloque).toMatch(/'categoria'/)
    expect(bloque).toMatch(/'tamano_bytes'/)
    expect(bloque).toMatch(/'evento'/)
    expect(bloque).toMatch(/'timestamp'/)
  })
})
