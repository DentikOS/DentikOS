import React, { memo, useState } from 'react'
import { User, PenTool } from 'lucide-react'
import { Button } from '../../../../shared/ui/ui/Button'
import { FirmaDigitalCanvas } from '../../../../shared/ui/FirmaDigitalCanvas'
import { useSesionStore } from '../../../../app/stores/sesionStore'

export interface PerfilProfesionalData {
  nombreCompleto?: string
  rut?: string
  especialidad?: string
  registroSalud?: string
  numeroRegistroISP?: string
  firmaDigital?: string
  email?: string
  [key: string]: unknown
}

export interface PerfilProfesionalFormProps {
  userProfile?: PerfilProfesionalData | null
  alGuardar: (perfil: PerfilProfesionalData) => void | Promise<void>
}

export const PerfilProfesionalForm: React.FC<PerfilProfesionalFormProps> = memo(({ userProfile, alGuardar }) => {
  const [nombreCompleto, setNombreCompleto] = useState<string>(userProfile?.nombreCompleto || '')
  const [rut, setRut] = useState<string>(userProfile?.rut || '')
  const [especialidad, setEspecialidad] = useState<string>(userProfile?.especialidad || 'Cirujano Dentista')
  const [numeroRegistroISP, setNumeroRegistroISP] = useState<string>(
    userProfile?.numeroRegistroISP || userProfile?.registroSalud || ''
  )
  const [firmaDigital, setFirmaDigital] = useState<string>(userProfile?.firmaDigital || '')
  const [email, setEmail] = useState<string>(userProfile?.email || '')
  const [enviando, setEnviando] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Detectar rol del usuario para renderizado condicional
  const sesionUserProfile = useSesionStore((s) => s.userProfile)
  const rol = (userProfile as any)?.rol || (sesionUserProfile as any)?.rol || 'recepcion'

  // Categorización de rol
  const esOdontologo = rol === 'dentista' || rol === 'admin'
  const esAsistente = rol === 'asistente'
  const esRecepcion = rol === 'recepcion'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // Validación obligatoria SOLO para odontólogos
    if (esOdontologo && !numeroRegistroISP.trim()) {
      setError('El N° de Registro ISP es obligatorio para el ejercicio clínico odontológico.')
      return
    }

    setEnviando(true)
    try {
      await alGuardar({
        ...userProfile,
        nombreCompleto,
        rut,
        especialidad: esOdontologo ? especialidad : undefined,
        registroSalud: esOdontologo ? numeroRegistroISP : undefined,
        numeroRegistroISP: esOdontologo ? numeroRegistroISP : undefined,
        firmaDigital: esOdontologo ? firmaDigital : undefined,
        email,
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-surface rounded-2xl p-6 shadow-xs space-y-4 text-xs">
      <div className="border-b border-surface pb-3">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 surgical:text-black uppercase tracking-wider inline-flex items-center gap-2">
          <User size={14} />
          {esOdontologo ? 'Perfil del Odontólogo / Profesional' :
           esAsistente ? 'Perfil del Asistente Dental' :
           esRecepcion ? 'Perfil de Recepción' :
           'Mi Perfil'}
        </h3>
        <p className="text-gray-500 dark:text-graphite-400 text-[11px]">
          {esOdontologo
            ? 'Información acreditada para firmar recetas médicas, certificados y consentimientos informados.'
            : esAsistente
            ? 'Información profesional para apoyo clínico y logística.'
            : esRecepcion
            ? 'Información de contacto para atención al paciente.'
            : 'Información básica de tu perfil profesional.'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/40 rounded-xl text-red-700 dark:text-red-300 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nombre - siempre visible y obligatorio */}
        <div>
          <label htmlFor="perfil-nombre" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">
            Nombre Completo <span className="text-red-500 dark:text-red-400 surgical:text-red-600 ml-0.5">*</span>
          </label>
          <input
            id="perfil-nombre"
            type="text"
            required
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-surface bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-50 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* RUT - siempre visible, obligatorio solo para odontólogos */}
        <div>
          <label htmlFor="perfil-rut" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">
            RUT {esOdontologo && (
              <>
                Profesional <span className="text-red-500 dark:text-red-400 surgical:text-red-600 ml-0.5">*</span>
              </>
            )}
          </label>
          <input
            id="perfil-rut"
            type="text"
            required={esOdontologo}
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-surface bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-50 font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Campos específicos de odontólogo */}
        {esOdontologo && (
          <>
            <div>
              <label htmlFor="perfil-especialidad" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">
                Especialidad Clínica <span className="text-red-500 dark:text-red-400 surgical:text-red-600 ml-0.5">*</span>
              </label>
              <input
                id="perfil-especialidad"
                type="text"
                required
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-surface bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label htmlFor="perfil-registro-isp" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">
                N° Registro ISP / Super. Salud <span className="text-red-500 dark:text-red-400 surgical:text-red-600 ml-0.5">*</span>
              </label>
              <input
                id="perfil-registro-isp"
                type="text"
                required
                value={numeroRegistroISP}
                onChange={(e) => setNumeroRegistroISP(e.target.value)}
                placeholder="Ej: 123456"
                className="w-full p-2.5 rounded-lg border border-surface bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </>
        )}

        {/* Email - siempre visible */}
        <div className={esOdontologo ? 'sm:col-span-2' : ''}>
          <label htmlFor="perfil-email" className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1">
            Email {esOdontologo ? 'Profesional' : ''}
          </label>
          <input
            id="perfil-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-surface bg-white dark:bg-graphite-800 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Firma digital SOLO para odontólogos */}
      {esOdontologo && (
        <div className="pt-3 border-t border-surface space-y-2">
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 surgical:text-black mb-1 flex items-center gap-1.5">
            <PenTool size={13} className="text-[#D4AF37]" />
            Firma Digital (3 Modos: Dibujar, Subir imagen o Tipográfica)
          </label>
          <FirmaDigitalCanvas alGuardarFirma={(dataUrl) => setFirmaDigital(dataUrl)} />
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-surface">
        <Button type="submit" variant="primary" size="md" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Guardar Perfil'}
        </Button>
      </div>
    </form>
  )
})

PerfilProfesionalForm.displayName = 'PerfilProfesionalForm'
