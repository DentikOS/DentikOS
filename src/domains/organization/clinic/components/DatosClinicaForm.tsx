import React, { memo, useState, useEffect } from 'react'
import { convertirImagenADataURL } from '../utils/clinicCalculations'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { Lock, Building2, CheckCircle2, AlertCircle } from 'lucide-react'
import { CLINICA_DEFAULT, type ClinicaConfig } from '../constants/clinicConstants'
import { clinicStorageService, type DatosClinicaConfig } from '../services/clinicStorageService'
import { MembreteClinica } from './MembreteClinica'
import { normalizarConfiguracionMembrete, type ConfiguracionMembrete } from '../schemas/configuracionMembreteSchema'
import { useSesionStore } from '../../../../app/stores/sesionStore'
import { markFormDirty, markFormSaved } from '../../../../shared/utils/formDirtyUtils'
import { supabase, USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { subirLogoClinicaAR2 } from '../../../../infrastructure/storage/r2ArchivosService'
import { esZonaHorariaIanaValida } from '../utils/timeZoneUtils'

const log = createLogger('DatosClinicaForm')
const MAX_LOGO_BYTES = 5 * 1024 * 1024
const LOGO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface DatosClinicaFormProps {
  datosClinica?: DatosClinicaConfig | ClinicaConfig
  alGuardar?: (datos: DatosClinicaConfig | ClinicaConfig) => void
  userProfile?: { rol?: string; clinicaId?: string | null; [key: string]: unknown } | null
}

export const DatosClinicaForm: React.FC<DatosClinicaFormProps> = memo(({ datosClinica = CLINICA_DEFAULT, alGuardar, userProfile }) => {
  const clinicaActual = useSesionStore((s) => s.clinicaActual)
  const clinicaId = clinicaActual || (userProfile?.clinicaId as string | undefined)

  const [form, setForm] = useState<DatosClinicaConfig | ClinicaConfig>(() => {
    if (datosClinica && datosClinica !== CLINICA_DEFAULT) return datosClinica
    const guardada = clinicStorageService.obtenerClinica()
    if (guardada && Object.keys(guardada).length > 0) return guardada
    return datosClinica || CLINICA_DEFAULT
  })
  const [estadoGuardado, setEstadoGuardado] = useState<string | null>(null)
  const [errorGuardado, setErrorGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)

  // Al montar, sincronizar desde Supabase
  useEffect(() => {
    let activo = true
    const guardada = clinicStorageService.obtenerClinica()
    if (guardada && Object.keys(guardada).length > 0) {
      setForm((prev) => ({ ...prev, ...guardada }))
    }
    if (clinicaId) {
      Promise.resolve(clinicStorageService.sincronizarClinicaDesdeSupabase(clinicaId))
        .then((desdeSupa) => {
          if (activo && desdeSupa) setForm((prev) => ({ ...prev, ...desdeSupa }))
        })
        .catch((err: unknown) => {
          log.warn('Error sincronizando datos de clínica:', err)
        })
    }
    return () => { activo = false }
  }, [clinicaId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleClinicaActualizada = (event: Event) => {
      const detail = (event as CustomEvent<{
        clinicaId?: string
        datos?: DatosClinicaConfig
      }>).detail

      if (!detail?.datos || (detail.clinicaId && detail.clinicaId !== clinicaId)) return
      if (!detail.clinicaId && clinicaId) return
      setForm((prev) => ({ ...prev, ...detail.datos }))
    }

    window.addEventListener('clinica_actualizada', handleClinicaActualizada)
    return () => window.removeEventListener('clinica_actualizada', handleClinicaActualizada)
  }, [clinicaId])

  // F6-C-e: solo el admin puede editar la configuración de clínica.
  const esSoloLectura = userProfile?.rol !== 'admin'

  const handleChange = (campo: string, valor: string) => {
    markFormDirty()
    setEstadoGuardado(null)
    setErrorGuardado(false)
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  const handleMembreteChange = (
    cambios: Partial<Omit<ConfiguracionMembrete, 'mostrar'>> & { mostrar?: Partial<ConfiguracionMembrete['mostrar']> }
  ) => {
    markFormDirty()
    setEstadoGuardado(null)
    setErrorGuardado(false)
    setForm((prev) => {
      const configuracionActual = normalizarConfiguracionMembrete((prev as DatosClinicaConfig).configuracionMembrete)
      return {
        ...prev,
        configuracionMembrete: normalizarConfiguracionMembrete({
          ...configuracionActual,
          ...cambios,
          mostrar: { ...configuracionActual.mostrar, ...cambios.mostrar },
        }),
      }
    })
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (esSoloLectura) return
    const file = e.target.files?.[0]
    if (!file) return

    if (!LOGO_MIME_TYPES.has(file.type)) {
      setEstadoGuardado('El logo debe ser JPG, PNG o WebP.')
      setErrorGuardado(true)
      return
    }
    if (file.size < 1 || file.size > MAX_LOGO_BYTES) {
      setEstadoGuardado('El logo debe pesar menos de 5 MB.')
      setErrorGuardado(true)
      return
    }

    markFormDirty()
    setEstadoGuardado(null)
    setErrorGuardado(false)
    setSubiendoLogo(true)

    try {
      let logoUrl: string | null = null
      if (clinicaId && USE_SUPABASE && supabase) {
        logoUrl = await subirLogoClinicaAR2(clinicaId, file)
        if (!logoUrl) {
          setEstadoGuardado('No se pudo cargar el logo. Verifica la conexión y vuelve a intentarlo.')
          setErrorGuardado(true)
          return
        }
      } else {
        const dataUrl = await convertirImagenADataURL(file)
        if (typeof dataUrl === 'string') logoUrl = dataUrl
      }

      if (logoUrl) setForm((prev) => ({ ...prev, logoUrl }))
    } catch {
      setEstadoGuardado('No se pudo cargar el logo. Verifica el archivo e inténtalo nuevamente.')
      setErrorGuardado(true)
    } finally {
      setSubiendoLogo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (esSoloLectura || guardando || subiendoLogo) return
    const zonaHoraria = String((form as DatosClinicaConfig).zonaHoraria || 'America/Santiago')
    if (!esZonaHorariaIanaValida(zonaHoraria)) {
      setEstadoGuardado('Indica una zona horaria IANA válida, por ejemplo America/Santiago.')
      setErrorGuardado(true)
      return
    }
    setGuardando(true)
    setEstadoGuardado(null)
    setErrorGuardado(false)

    try {
      let datosAGuardar = form as DatosClinicaConfig
      const guardadoEnNube = Boolean(clinicaId && USE_SUPABASE && supabase)

      if (guardadoEnNube && typeof datosAGuardar.logoUrl === 'string' && datosAGuardar.logoUrl.startsWith('data:')) {
        const respuestaLogo = await fetch(datosAGuardar.logoUrl)
        const logoBlob = await respuestaLogo.blob()
        if (!LOGO_MIME_TYPES.has(logoBlob.type) || logoBlob.size < 1 || logoBlob.size > MAX_LOGO_BYTES) {
          setEstadoGuardado('Vuelve a cargar el logo como JPG, PNG o WebP de hasta 5 MB para sincronizarlo.')
          setErrorGuardado(true)
          return
        }

        const extension = logoBlob.type === 'image/png' ? 'png' : logoBlob.type === 'image/webp' ? 'webp' : 'jpg'
        const archivoLogo = new File([logoBlob], `logo-clinica.${extension}`, { type: logoBlob.type })
        const logoUrl = await subirLogoClinicaAR2(clinicaId as string, archivoLogo)
        if (!logoUrl) {
          setEstadoGuardado('No se pudo sincronizar el logo. Verifica la conexión y vuelve a intentarlo.')
          setErrorGuardado(true)
          return
        }

        datosAGuardar = { ...datosAGuardar, logoUrl }
        setForm((prev) => ({ ...prev, logoUrl }))
      }

      let guardado = false
      if (clinicaId) {
        guardado = await clinicStorageService.guardarClinicaCompleta(clinicaId, datosAGuardar)
      } else {
        clinicStorageService.guardarClinica(datosAGuardar)
        const nuevoNombre = datosAGuardar.nombreClinica?.trim() || ''
        if (typeof window !== 'undefined' && nuevoNombre) {
          window.dispatchEvent(new CustomEvent('clinica_actualizada', {
            detail: { nombre: nuevoNombre, datos: datosAGuardar },
          }))
        }
        guardado = true
      }

      if (!guardado) {
        setEstadoGuardado('No se pudo guardar la configuración. Revisa tus permisos y vuelve a intentarlo.')
        setErrorGuardado(true)
        return
      }

      markFormSaved()
      setEstadoGuardado(clinicaId && USE_SUPABASE && supabase
        ? 'Guardado en la nube'
        : 'Guardado en este dispositivo; no se sincronizó con la nube.')
      if (alGuardar) alGuardar(datosAGuardar)
    } catch {
      log.error('No se pudo guardar la configuración de clínica.')
      setEstadoGuardado('No se pudo guardar la configuración. Verifica la conexión y vuelve a intentarlo.')
      setErrorGuardado(true)
    } finally {
      setGuardando(false)
    }
  }

  const inputClass = `w-full p-2.5 rounded-lg border border-surface text-graphite-900 dark:text-graphite-50 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
    esSoloLectura ? 'bg-gray-100 dark:bg-graphite-900/50 cursor-not-allowed text-gray-500' : 'bg-white dark:bg-graphite-800 surgical:bg-graphite-200'
  }`
  const configuracionMembrete = normalizarConfiguracionMembrete((form as DatosClinicaConfig).configuracionMembrete)
  const elementosMembrete: { key: keyof ConfiguracionMembrete['mostrar']; label: string }[] = [
    { key: 'logo', label: 'Logo' },
    { key: 'nombre', label: 'Nombre de la clínica' },
    { key: 'rut', label: 'RUT' },
    { key: 'direccion', label: 'Dirección' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'sitioWeb', label: 'Sitio web' },
    { key: 'registroSeremi', label: 'Registro SEREMI' },
    { key: 'registroIsp', label: 'Registro ISP' },
  ]

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-surface rounded-2xl p-6 shadow-xs space-y-4 text-xs">
      <div className="border-b border-surface pb-3">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 surgical:text-black uppercase tracking-wider inline-flex items-center gap-2"><Building2 size={14} />Información de la Clínica & Membrete</h3>
        <p className="text-gray-500 dark:text-graphite-400 text-[11px]">
          Membrete compartido para presupuestos, comprobantes de pago, recetas y derivaciones.
          {esSoloLectura && (
            <span className="ml-2 inline-block px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded text-[10px] font-semibold">
              <span className="inline-flex items-center gap-1"><Lock size={12} />Solo lectura - Contacta al administrador para cambios</span>
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Nombre Fantasía Clínica *</label>
          <input
            type="text"
            required
            disabled={esSoloLectura}
            value={form.nombreClinica || ''}
            onChange={(e) => handleChange('nombreClinica', e.target.value)}
            className={`${inputClass} font-bold`}
          />
        </div>
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Razón Social</label>
          <input
            type="text"
            disabled={esSoloLectura}
            value={form.razonSocial || ''}
            onChange={(e) => handleChange('razonSocial', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">RUT Empresa</label>
          <input
            type="text"
            disabled={esSoloLectura}
            value={form.rutClinica || ''}
            onChange={(e) => handleChange('rutClinica', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Giro comercial</label>
          <input
            type="text"
            disabled={esSoloLectura}
            value={(form as DatosClinicaConfig).giroComercial || ''}
            onChange={(e) => handleChange('giroComercial', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Teléfono Contacto</label>
          <input
            type="text"
            disabled={esSoloLectura}
            value={form.telefono || ''}
            onChange={(e) => handleChange('telefono', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Email Oficial</label>
          <input
            type="email"
            disabled={esSoloLectura}
            value={form.emailContacto || ''}
            onChange={(e) => handleChange('emailContacto', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="clinica-ciudad" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Ciudad</label>
          <input
            id="clinica-ciudad"
            type="text"
            disabled={esSoloLectura}
            value={form.ciudad || ''}
            onChange={(e) => handleChange('ciudad', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="clinica-comuna" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Comuna</label>
          <input
            id="clinica-comuna"
            type="text"
            disabled={esSoloLectura}
            value={(form as DatosClinicaConfig).comuna || ''}
            onChange={(e) => handleChange('comuna', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="clinica-region" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Región</label>
          <input
            id="clinica-region"
            type="text"
            disabled={esSoloLectura}
            value={(form as DatosClinicaConfig).region || ''}
            onChange={(e) => handleChange('region', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="clinica-zona-horaria" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Zona horaria *</label>
          <input
            id="clinica-zona-horaria"
            type="text"
            required
            list="zonas-horarias-clinica"
            disabled={esSoloLectura}
            value={(form as DatosClinicaConfig).zonaHoraria || 'America/Santiago'}
            onChange={(e) => handleChange('zonaHoraria', e.target.value)}
            className={inputClass}
          />
          <datalist id="zonas-horarias-clinica">
            <option value="America/Santiago" />
            <option value="America/Argentina/Buenos_Aires" />
            <option value="America/Lima" />
            <option value="Europe/Madrid" />
            <option value="America/New_York" />
            <option value="America/Los_Angeles" />
          </datalist>
        </div>
      </div>

      <div>
        <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Dirección Completa</label>
        <input
          type="text"
          disabled={esSoloLectura}
          value={form.direccion || ''}
          onChange={(e) => handleChange('direccion', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Eslogan o Frase Identitaria</label>
        <input
          type="text"
          disabled={esSoloLectura}
          value={(form.eslogan as string) || ''}
          onChange={(e) => handleChange('eslogan', e.target.value)}
          className={inputClass}
        />
      </div>

      <fieldset className="space-y-3 rounded-xl border border-surface p-3">
        <legend className="px-1 font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">Datos públicos y registros</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">
            Sitio web
            <input type="url" disabled={esSoloLectura} value={(form as DatosClinicaConfig).sitioWeb || ''} onChange={(e) => handleChange('sitioWeb', e.target.value)} className={`${inputClass} mt-1 font-normal`} placeholder="https://clinica.cl" />
          </label>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">
            Instagram
            <input type="text" disabled={esSoloLectura} value={(form as DatosClinicaConfig).instagram || ''} onChange={(e) => handleChange('instagram', e.target.value)} className={`${inputClass} mt-1 font-normal`} placeholder="@clinica" />
          </label>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">
            Facebook
            <input type="text" disabled={esSoloLectura} value={(form as DatosClinicaConfig).facebook || ''} onChange={(e) => handleChange('facebook', e.target.value)} className={`${inputClass} mt-1 font-normal`} placeholder="facebook.com/clinica" />
          </label>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">
            Registro SEREMI
            <input type="text" disabled={esSoloLectura} value={(form as DatosClinicaConfig).registroSeremi || ''} onChange={(e) => handleChange('registroSeremi', e.target.value)} className={`${inputClass} mt-1 font-normal`} />
          </label>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">
            Registro ISP
            <input type="text" disabled={esSoloLectura} value={(form as DatosClinicaConfig).registroIsp || ''} onChange={(e) => handleChange('registroIsp', e.target.value)} className={`${inputClass} mt-1 font-normal`} />
          </label>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">
            Idioma de documentos
            <select disabled={esSoloLectura} value={(form as DatosClinicaConfig).idiomaDocumentos || 'es-CL'} onChange={(e) => handleChange('idiomaDocumentos', e.target.value)} className={`${inputClass} mt-1 font-normal`}>
              <option value="es-CL">Español (Chile)</option>
            </select>
          </label>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">
            Moneda de la clínica
            <select disabled={esSoloLectura} value={(form as DatosClinicaConfig).moneda || 'CLP'} onChange={(e) => handleChange('moneda', e.target.value)} className={`${inputClass} mt-1 font-normal`}>
              <option value="CLP">CLP — Peso chileno</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-surface p-3">
        <legend className="px-1 font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black">Membrete de documentos</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { id: 'clasico', nombre: 'Clásico', descripcion: 'Logo a la izquierda y datos alineados a la derecha.' },
            { id: 'moderno', nombre: 'Moderno', descripcion: 'Logo centrado y datos en una línea.' },
            { id: 'minimalista', nombre: 'Minimalista', descripcion: 'Solo logo y nombre de la clínica.' },
          ].map((diseno) => (
            <button
              key={diseno.id}
              type="button"
              aria-pressed={configuracionMembrete.diseno === diseno.id}
              disabled={esSoloLectura}
              onClick={() => handleMembreteChange({ diseno: diseno.id as ConfiguracionMembrete['diseno'] })}
              className={`rounded-lg border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${configuracionMembrete.diseno === diseno.id ? 'border-primary bg-primary/5' : 'border-surface hover:bg-gray-50 dark:hover:bg-graphite-800'}`}
            >
              <span className="block font-semibold text-gray-800 dark:text-graphite-100">{diseno.nombre}</span>
              <span className="mt-1 block text-[10px] text-gray-500 dark:text-graphite-400">{diseno.descripcion}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: 'colorPrincipal', label: 'Texto principal' },
            { key: 'colorLinea', label: 'Línea separadora' },
            { key: 'colorTitulos', label: 'Títulos' },
            { key: 'colorTextoSecundario', label: 'Texto secundario' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-[10px] font-semibold text-gray-700 dark:text-graphite-300">
              <input
                type="color"
                aria-label={label}
                disabled={esSoloLectura}
                value={configuracionMembrete[key as 'colorPrincipal' | 'colorLinea' | 'colorTitulos' | 'colorTextoSecundario']}
                onChange={(event) => handleMembreteChange({ [key]: event.target.value } as Partial<ConfiguracionMembrete>)}
                className="h-8 w-10 cursor-pointer rounded border border-surface bg-transparent disabled:cursor-not-allowed"
              />
              {label}
            </label>
          ))}
        </div>

        {configuracionMembrete.diseno !== 'minimalista' && (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className="inline-flex items-center gap-1.5 text-[10px] text-gray-700 dark:text-graphite-300">
              <input
                type="checkbox"
                aria-label="Logo monocromático"
                checked={configuracionMembrete.logoMonocromatico}
                disabled={esSoloLectura}
                onChange={(event) => handleMembreteChange({ logoMonocromatico: event.target.checked })}
              />
              Logo monocromático
            </label>
            {elementosMembrete.map(({ key, label }) => (
              <label key={key} className="inline-flex items-center gap-1.5 text-[10px] text-gray-700 dark:text-graphite-300">
                <input
                  type="checkbox"
                  aria-label={`Mostrar ${label}`}
                  checked={configuracionMembrete.mostrar[key]}
                  disabled={esSoloLectura}
                  onChange={(event) => handleMembreteChange({ mostrar: { [key]: event.target.checked } })}
                />
                {label}
              </label>
            ))}
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-graphite-400">Vista previa en vivo</p>
          <div className="rounded-lg border border-surface bg-white p-4 dark:bg-graphite-900">
            <MembreteClinica clinica={form as DatosClinicaConfig} />
          </div>
        </div>
      </fieldset>

      <div>
        <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">Logo Impresión (Blanco y Negro o Color)</label>
        <div className="flex items-center gap-4 mt-2">
          {form.logoUrl && (
            <div className="w-16 h-16 border rounded-lg p-1 bg-white dark:bg-graphite-800 flex items-center justify-center">
              <img src={form.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={esSoloLectura || subiendoLogo}
            onChange={handleLogoUpload}
            className={`text-xs ${esSoloLectura || subiendoLogo ? 'cursor-not-allowed text-gray-400' : ''}`}
          />
        </div>
      </div>

      {!esSoloLectura && (
        <div className="flex items-center justify-between pt-3 border-t border-surface">
          <div>
            {estadoGuardado && (
              <span className={`${errorGuardado ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} font-semibold text-xs inline-flex items-center gap-1.5`}>
                {errorGuardado ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                {estadoGuardado}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={guardando || subiendoLogo}
            className="px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition cursor-pointer disabled:opacity-50"
          >
            {subiendoLogo ? 'Subiendo logo...' : guardando ? 'Guardando...' : 'Guardar Configuración Clínica'}
          </button>
        </div>
      )}
    </form>
  )
})

DatosClinicaForm.displayName = 'DatosClinicaForm'
