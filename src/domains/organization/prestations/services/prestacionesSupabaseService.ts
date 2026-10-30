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
