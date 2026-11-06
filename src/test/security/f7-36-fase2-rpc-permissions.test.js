/**
 * @vitest-environment node
 *
 * F7-36 FASE 2 (Commit 2.3): Test de regresión de permisos de RPCs
 * de auditoría y purge.
 *
 * OBJETIVO: Validar que las funciones SECURITY DEFINER restringidas
 * en la migración 2026_09_28_0002 no son llamadas directamente por
 * el frontend vía supabase.rpc(), garantizando que solo las Edge
 * Functions (con service_role) pueden invocarlas.
 *
 * LIMITACIÓN HONESTA:
 * Este test NO valida permisos reales contra una BD Supabase viva
 * porque Supabase local no está corriendo durante el CI. En su lugar:
 * 1. Valida mediante grep estático que el frontend NO llama a estas RPCs
 * 2. Valida que las Edge Functions SÍ las llaman (callers legítimos)
 * 3. Documenta el contrato de permisos esperado
 *
 * VALIDACIÓN REAL:
 * La validación real de permisos se hace manualmente al aplicar la
 * migración con `supabase db push` usando el test obligatorio del
 * brief en SQL Editor:
 *
 *   SET ROLE authenticated;
 *   SELECT public.registrar_evento_purge(
 *     '00000000-0000-0000-0000-000000000000'::uuid,
 *     'FAKE_EVENT', '{}'::jsonb,
 *     '00000000-0000-0000-0000-000000000000'::uuid);
 *   -- Esperado: ERROR "permission denied for function registrar_evento_purge"
 *   RESET ROLE;
 *
 * Ver docs/F7-36-FASE2-RFC.md y checklist de deploy en BITACORA.md.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(process.cwd())

/**
 * Busca recursivamente archivos con una extensión específica,
 * excluyendo node_modules, dist, y carpetas ocultas.
 */
const buscarArchivos = (dir, extension, exclude = ['node_modules', 'dist', '.git', '_tests']) => {
  const { readdirSync } = require('node:fs')
  const resultados = []

  const recorrer = (rutaActual) => {
    try {
      const entradas = readdirSync(rutaActual, { withFileTypes: true })
      for (const entrada of entradas) {
        const rutaCompleta = join(rutaActual, entrada.name)

        if (exclude.some((ex) => entrada.name === ex || entrada.name.startsWith('.'))) continue

        if (entrada.isDirectory()) {
          recorrer(rutaCompleta)
        } else if (entrada.isFile() && entrada.name.endsWith(extension)) {
          resultados.push(rutaCompleta)
        }
      }
    } catch {
      // Ignorar errores de lectura (permisos, enlaces rotos)
    }
  }

  recorrer(dir)
  return resultados
}

/**
 * Busca un patrón regex en un archivo y retorna las líneas coincidentes
 * con su número de línea.
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

describe('F7-36 FASE 2: Regresión de permisos de RPCs de auditoría', () => {
  // ============================================================
  // TEST 1: Frontend NO llama a registrar_evento_archivo
  // ============================================================
  it('1. Frontend NO invoca registrar_evento_archivo vía supabase.rpc()', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.')) // Excluir archivos de test

    const llamadasRpc = []
    archivosFrontend.forEach((archivo) => {
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

    // El frontend NUNCA debe llamar a registrar_evento_archivo vía Data API
    // Solo Edge Functions con service_role pueden invocarla (vía fetch HTTP)
    expect(llamadasRpc).toEqual([])
  })

  // ============================================================
  // TEST 2: Frontend NO llama a registrar_evento_purge
  // ============================================================
  it('2. Frontend NO invoca registrar_evento_purge vía supabase.rpc()', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.'))

    const llamadasRpc = []
    archivosFrontend.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\.rpc\(\s*['"]registrar_evento_purge['"]/
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
  // TEST 3: Frontend NO llama a purgar_archivos_expirados
  // ============================================================
  it('3. Frontend NO invoca purgar_archivos_expirados vía supabase.rpc()', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.'))

    const llamadasRpc = []
    archivosFrontend.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\.rpc\(\s*['"]purgar_archivos_expirados['"]/
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
  // TEST 4: Frontend NO llama a purgar_certificados_expirados
  // ============================================================
  it('4. Frontend NO invoca purgar_certificados_expirados vía supabase.rpc()', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.'))

    const llamadasRpc = []
    archivosFrontend.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\.rpc\(\s*['"]purgar_certificados_expirados['"]/
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
  // TEST 5: Edge Functions SÍ llaman a registrar_evento_archivo
  // (caller legítimo confirmado)
  // ============================================================
  it('5. Edge Functions invocan registrar_evento_archivo (caller legítimo)', () => {
    const archivosEdge = buscarArchivos(join(ROOT, 'supabase/functions'), '.ts')
      .filter((f) => !f.includes('.test.'))

    const llamadasHttp = []
    archivosEdge.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\/rest\/v1\/rpc\/registrar_evento_archivo/
      )
      if (coincidencias.length > 0) {
        llamadasHttp.push({
          edge: archivo.replace(ROOT, ''),
          llamadas: coincidencias.length,
        })
      }
    })

    // Deben existir al menos 4 Edge Functions que llaman a esta RPC:
    // r2-upload-url, r2-download-url, r2-delete, r2-restore
    expect(llamadasHttp.length).toBeGreaterThanOrEqual(4)

    const nombres = llamadasHttp.map((e) => e.edge)
    expect(nombres.some((n) => n.includes('r2-upload-url'))).toBe(true)
    expect(nombres.some((n) => n.includes('r2-download-url'))).toBe(true)
    expect(nombres.some((n) => n.includes('r2-delete'))).toBe(true)
    expect(nombres.some((n) => n.includes('r2-restore'))).toBe(true)
  })

  // ============================================================
  // TEST 6: Edge Functions SÍ llaman a registrar_evento_purge
  // (caller legítimo confirmado)
  // ============================================================
  it('6. Edge Functions invocan registrar_evento_purge (caller legítimo)', () => {
    const archivosEdge = buscarArchivos(join(ROOT, 'supabase/functions'), '.ts')
      .filter((f) => !f.includes('.test.'))

    const llamadasHttp = []
    archivosEdge.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\/rest\/v1\/rpc\/registrar_evento_purge/
      )
      if (coincidencias.length > 0) {
        llamadasHttp.push(archivo.replace(ROOT, ''))
      }
    })

    // Al menos archivos-purge y pacientes-purge deben llamarla
    expect(llamadasHttp.length).toBeGreaterThanOrEqual(2)
    expect(llamadasHttp.some((n) => n.includes('archivos-purge'))).toBe(true)
    expect(llamadasHttp.some((n) => n.includes('pacientes-purge'))).toBe(true)
  })

  // ============================================================
  // TEST 7: Contrato de permisos documentado
  // ============================================================
  it('7. Contrato de permisos está documentado en la migración SQL', () => {
    const migracion = join(
      ROOT,
      'supabase/migrations/20260928000200_f7_36_fase2_rpc_purge_perms.sql'
    )
    const contenido = readFileSync(migracion, 'utf-8')

    // Debe documentar cada función endurecida
    expect(contenido).toContain('registrar_evento_purge')
    expect(contenido).toContain('purgar_archivos_expirados')
    expect(contenido).toContain('purgar_certificados_expirados')
    expect(contenido).toContain('validar_eliminado_at_certificados')

    // Debe contener las sentencias REVOKE críticas
    expect(contenido).toContain('REVOKE ALL ON FUNCTION')
    expect(contenido).toContain('REVOKE EXECUTE ON FUNCTION')
    expect(contenido).toContain('FROM PUBLIC')
    expect(contenido).toContain('FROM authenticated')
    expect(contenido).toContain('FROM anon')

    // Debe contener el test obligatorio del brief en comentarios
    expect(contenido).toContain('SET ROLE authenticated')
    expect(contenido).toContain('permission denied for function')
  })
})
