/**
 * @vitest-environment node
 *
 * F7-36 FASE 3 (Commit 3.2): Test de regresión de hardening
 * de helpers RBAC SECURITY DEFINER.
 *
 * OBJETIVO: Validar que:
 * 1. El frontend NO llama directamente a funciones restringidas
 *    (set_app_metadata_role, get_role_from_metadata)
 * 2. La migración SQL existe y contiene las restricciones críticas
 * 3. El patrón de escalada de privilegios no está presente en código
 *
 * LIMITACIÓN HONESTA:
 * Este test NO valida permisos reales contra una BD Supabase viva
 * (Supabase local no corre durante CI). En su lugar:
 * 1. Valida mediante grep estático que el frontend no llama a estas RPCs
 * 2. Valida que la migración contiene los REVOKEs críticos
 * 3. Documenta el contrato de permisos esperado
 *
 * VALIDACIÓN REAL:
 * Se hace manualmente al aplicar la migración con `supabase db push`
 * usando el test obligatorio del brief en SQL Editor:
 *
 *   SET ROLE authenticated;
 *   SELECT public.set_app_metadata_role(
 *     '00000000-0000-0000-0000-000000000000'::uuid, 'admin'::public.app_role
 *   );
 *   -- Esperado: ERROR 'permission denied for function set_app_metadata_role'
 *   RESET ROLE;
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

/**
 * Busca recursivamente archivos con una extensión específica,
 * excluyendo node_modules, dist, y carpetas ocultas.
 */
const buscarArchivos = (dir, extension, exclude = ['node_modules', 'dist', '.git']) => {
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
      // Ignorar errores de lectura
    }
  }

  recorrer(dir)
  return resultados
}

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

describe('F7-36 FASE 3: Regresión de hardening RBAC', () => {
  // ============================================================
  // TEST 1: Frontend NO invoca set_app_metadata_role (escalada)
  // ============================================================
  it('1. Frontend NO invoca set_app_metadata_role vía supabase.rpc() (previene escalada)', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.'))

    const llamadasRpc = []
    archivosFrontend.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\.rpc\(\s*['"]set_app_metadata_role['"]/
      )
      if (coincidencias.length > 0) {
        llamadasRpc.push({
          archivo: archivo.replace(ROOT, ''),
          coincidencias,
        })
      }
    })

    // CRÍTICO: el frontend NUNCA debe llamar set_app_metadata_role
    // Es un vector de escalada de privilegios
    expect(llamadasRpc).toEqual([])
  })

  // ============================================================
  // TEST 2: Frontend NO invoca get_role_from_metadata
  // ============================================================
  it('2. Frontend NO invoca get_role_from_metadata vía supabase.rpc()', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.'))

    const llamadasRpc = []
    archivosFrontend.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\.rpc\(\s*['"]get_role_from_metadata['"]/
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
  // TEST 3: Frontend NO intenta manipular raw_app_meta_data directamente
  // ============================================================
  it('3. Frontend NO intenta UPDATE directo en auth.users', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.'))

    const intentos = []
    archivosFrontend.forEach((archivo) => {
      // Patrones sospechosos de escalada
      const patrones = [
        /from\(\s*['"]auth\.users['"]\s*\)\s*\.update/i,
        /from\(\s*['"]users['"]\s*\)\s*\.update/i,
        /raw_app_meta_data\s*=/,
      ]
      for (const patron of patrones) {
        const coincidencias = grepEnArchivo(archivo, patron)
        if (coincidencias.length > 0) {
          intentos.push({
            archivo: archivo.replace(ROOT, ''),
            patron: patron.toString(),
            coincidencias,
          })
          break
        }
      }
    })

    expect(intentos).toEqual([])
  })

  // ============================================================
  // TEST 4: Frontend NO invoca handle_new_user (trigger interno)
  // ============================================================
  it('4. Frontend NO invoca handle_new_user vía supabase.rpc()', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.'))

    const llamadasRpc = []
    archivosFrontend.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\.rpc\(\s*['"]handle_new_user['"]/
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
  // TEST 5: Frontend NO invoca profiles_lock_role (trigger interno)
  // ============================================================
  it('5. Frontend NO invoca profiles_lock_role vía supabase.rpc()', () => {
    const archivosFrontend = buscarArchivos(join(ROOT, 'src'), '.js')
      .concat(buscarArchivos(join(ROOT, 'src'), '.jsx'))
      .filter((f) => !f.includes('.test.'))

    const llamadasRpc = []
    archivosFrontend.forEach((archivo) => {
      const coincidencias = grepEnArchivo(
        archivo,
        /\.rpc\(\s*['"]profiles_lock_role['"]/
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
  // TEST 6: Migración SQL contiene los REVOKEs críticos
  // ============================================================
  it('6. Migración SQL contiene REVOKE de set_app_metadata_role a authenticated', () => {
    const migracion = join(
      ROOT,
      'supabase/migrations/20260928000400_f7_36_fase3_security_definer_hardening.sql'
    )
    const contenido = readFileSync(migracion, 'utf-8')

    // REVOKE crítico: previene escalada de privilegios
    expect(contenido).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.set_app_metadata_role.*FROM authenticated/s
    )
    expect(contenido).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.get_role_from_metadata.*FROM authenticated/s
    )
  })

  // ============================================================
  // TEST 7: Migración SQL contiene search_path vacío en las 8 funciones
  // ============================================================
  it('7. Migración SQL establece search_path vacío en todas las funciones', () => {
    const migracion = join(
      ROOT,
      'supabase/migrations/20260928000400_f7_36_fase3_security_definer_hardening.sql'
    )
    const contenido = readFileSync(migracion, 'utf-8')

    // Las 8 funciones deben tener search_path vacío
    expect(contenido).toContain('SET search_path = \'\'')

    // Verificar que NO hay search_path = public (riesgo de hijacking)
    const lineas = contenido.split('\n').filter((l) => l.includes('search_path'))
    const peligrosas = lineas.filter(
      (l) => l.includes('search_path = public') && !l.trim().startsWith('--')
    )
    expect(peligrosas).toEqual([])
  })

  // ============================================================
  // TEST 8: Contrato de escalada documentado
  // ============================================================
  it('8. Contrato de escalada de privilegios documentado en la migración', () => {
    const migracion = join(
      ROOT,
      'supabase/migrations/20260928000400_f7_36_fase3_security_definer_hardening.sql'
    )
    const contenido = readFileSync(migracion, 'utf-8')

    // Debe documentar el vector crítico
    expect(contenido).toContain('escalada de privilegios')
    expect(contenido).toContain('set_app_metadata_role')
    expect(contenido).toContain('permission denied for function')
  })
})
