import { getClinicaActivaSync } from '../../../../infrastructure/auth/authService'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import type { Prestacion } from '../schemas/prestacionSchema'

const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const contexto = () => {
  const clinicaId = getClinicaActivaSync()
  if (!USE_SUPABASE || !supabase || !uuid(clinicaId)) {
    throw new Error('No hay una clínica activa conectada para sincronizar el arancel.')
  }
  return { client: supabase, clinicaId }
}

const desdeFila = (fila: Record<string, unknown>): Prestacion => ({
  id: String(fila.id),
  nombre: String(fila.nombre),
  especialidad: String(fila.especialidad),
  precioParticular: Number(fila.precio_particular),
  precioFonasa: Number(fila.precio_fonasa),
  codigoFonasa: String(fila.codigo_fonasa ?? ''),
  precio: Number(fila.precio_particular),
})

export const prestacionesSupabaseService = {
  async listar(): Promise<Prestacion[]> {
    const { client, clinicaId } = contexto()
    const { data, error } = await client.from('prestaciones')
      .select('id,nombre,especialidad,precio_particular,precio_fonasa,codigo_fonasa')
      .eq('clinica_id', clinicaId).order('nombre')
    if (error) throw new Error('No se pudo cargar el arancel compartido de la clínica.')
    return (data ?? []).map((fila) => desdeFila(fila))
  },

  async guardar(prestacion: Prestacion): Promise<Prestacion> {
    const { client, clinicaId } = contexto()
    const nombre = prestacion.nombre.trim()
    const especialidad = prestacion.especialidad.trim()
    const particular = Number(prestacion.precioParticular)
    const fonasa = Number(prestacion.precioFonasa)
    if (!nombre || !especialidad || !Number.isSafeInteger(particular) || particular < 0 ||
        !Number.isSafeInteger(fonasa) || fonasa < 0) {
      throw new Error('Revisa el nombre, la especialidad y los precios enteros no negativos.')
    }
    const valores = {
      nombre, especialidad, precio_particular: particular,
      precio_fonasa: fonasa, codigo_fonasa: prestacion.codigoFonasa || null,
      precio: particular,
    }
    const { data, error } = uuid(prestacion.id)
      ? await client.from('prestaciones').update(valores).eq('id', prestacion.id)
          .eq('clinica_id', clinicaId).select('id,nombre,especialidad,precio_particular,precio_fonasa,codigo_fonasa').maybeSingle()
      : await (async () => {
          const { data: auth, error: authError } = await client.auth.getUser()
          if (authError || !auth.user?.id) throw new Error('Inicia sesión para guardar la prestación.')
          return client.from('prestaciones').insert({ ...valores, clinica_id: clinicaId, user_id: auth.user.id })
            .select('id,nombre,especialidad,precio_particular,precio_fonasa,codigo_fonasa').single()
        })()
    if (error || !data) throw new Error('No se pudo guardar la prestación. Revisa tus permisos y vuelve a intentar.')
    return desdeFila(data)
  },

  async reajustarMasivo(porcentaje: number | string, prestaciones: Prestacion[]): Promise<Prestacion[]> {
    const { client } = contexto()
    const pct = typeof porcentaje === 'string' && !porcentaje.trim() ? NaN : Number(porcentaje)
    if (!Number.isFinite(pct) || pct < -100 || pct > 10000) {
      throw new Error('El porcentaje debe estar entre -100% y 10000%.')
    }
    if (!prestaciones.length) throw new Error('No hay prestaciones sincronizadas para reajustar.')

    const esperadas = prestaciones.map((prestacion) => {
      const particular = Number(prestacion.precioParticular)
      const fonasa = Number(prestacion.precioFonasa)
      if (!uuid(prestacion.id) || !Number.isSafeInteger(particular) || particular < 0 ||
        !Number.isSafeInteger(fonasa) || fonasa < 0) {
        throw new Error('El arancel contiene datos pendientes de sincronización o precios inválidos.')
      }
      return { id: prestacion.id, precio_particular: particular, precio_fonasa: fonasa }
    })

    const { data, error } = await client.rpc('reajustar_arancel_clinica', {
      p_porcentaje: pct,
      p_prestaciones_esperadas: esperadas,
    })
    if (error?.code === '40001') {
      throw new Error('El arancel cambió desde que se cargó. Actualízalo antes de reajustar.')
    }
    if (error?.code === '42501') throw new Error('No tienes permisos para reajustar el arancel de esta clínica.')
    if (error?.code === '22003') throw new Error('El porcentaje generaría un precio fuera del rango permitido.')
    if (error || !Array.isArray(data) || data.length !== esperadas.length) {
      throw new Error('No se pudo reajustar el arancel completo. No se confirmó ningún cambio.')
    }
    return data.map((fila) => desdeFila(fila as Record<string, unknown>))
  },

  async eliminar(id: string | number): Promise<void> {
    const { client, clinicaId } = contexto()
    if (!uuid(id)) throw new Error('La prestación aún no está sincronizada.')
    const { data, error } = await client.from('prestaciones').delete()
      .eq('id', id).eq('clinica_id', clinicaId).select('id')
    if (error || data?.length !== 1) {
      throw new Error('No se pudo eliminar la prestación. Puede estar en uso o faltan permisos.')
    }
  },
}
