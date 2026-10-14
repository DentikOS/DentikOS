/**
 * PerfilModal — Modal wrapper para PerfilProfesionalForm (Blueprint 03 §06)
 *
 * Envuelve el formulario existente de Perfil Profesional en un modal
 * accesible con backdrop blur. Sincroniza cambios persistentes con Supabase.
 */
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera, Loader2 } from 'lucide-react'
import { Icon } from './Icon'
import { PerfilProfesionalForm } from '../../domains/organization/team/components/PerfilProfesionalForm'
import type { PerfilProfesionalData } from '../../domains/organization/team/components/PerfilProfesionalForm'
import { useSesionStore } from '../../app/stores/sesionStore'
import { useProfileSync } from '../hooks/useProfileSync'

export interface PerfilModalProps {
  isOpen: boolean
  onClose: () => void
  userProfile?: PerfilProfesionalData | null
  onGuardar?: (perfil: PerfilProfesionalData) => void | Promise<void>
}

export const PerfilModal: React.FC<PerfilModalProps> = ({
  isOpen,
  onClose,
  userProfile: propUserProfile,
  onGuardar,
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const storeUserProfile = useSesionStore((s) => s.userProfile)
  const userProfile = propUserProfile || (storeUserProfile as PerfilProfesionalData | null)
  const { actualizar, subirFoto } = useProfileSync()
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  const fotoUrl = (userProfile as any)?.fotoUrl as string | undefined
  const iniciales = (userProfile?.nombreCompleto || 'U')
    .replace('Dr. ', '')
    .replace('Dra. ', '')
    .trim()
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose()
    }
  }

  const handleGuardar = async (perfil: PerfilProfesionalData) => {
    try {
      await actualizar({
        fullName: perfil.nombreCompleto,
        especialidad: perfil.especialidad,
        rut: perfil.rut,
        telefono: (perfil as any).telefono,
      })
    } catch {}

    if (onGuardar) {
      await onGuardar(perfil)
    }
    onClose()
  }

  const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSubiendoFoto(true)
    try {
      await subirFoto(file)
    } finally {
      setSubiendoFoto(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(7,11,20,0.5)' }}
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-[640px] max-w-full max-h-[90vh] bg-white dark:bg-graphite-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Perfil profesional"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface">
              <h2 className="text-lg font-semibold text-graphite-900 dark:text-graphite-50">
                Perfil profesional
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-graphite-100 dark:hover:bg-graphite-800 cursor-pointer"
                aria-label="Cerrar"
              >
                <Icon icon={X} size="sm" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Sección de Foto de Perfil */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-surface">
                <div
                  className="w-16 h-16 rounded-full p-[2px] flex items-center justify-center shrink-0 shadow-xs overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #E5C378 0%, #B88E3A 100%)' }}
                >
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt={userProfile?.nombreCompleto || 'Avatar'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white dark:bg-graphite-900 text-primary font-bold rounded-full flex items-center justify-center text-lg">
                      {iniciales}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-graphite-900 dark:text-graphite-100">
                    Foto de Perfil
                  </p>
                  <p className="text-[11px] text-graphite-500">
                    JPG, PNG o WebP (máx. 5MB). Visible en el Top Bar y documentos clínicos.
                  </p>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSubirFoto}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={subiendoFoto}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-graphite-100 dark:bg-graphite-800 text-graphite-700 dark:text-graphite-200 hover:bg-graphite-200 dark:hover:bg-graphite-700 transition-colors cursor-pointer"
                  >
                    {subiendoFoto ? (
                      <Loader2 size={13} className="animate-spin text-primary" />
                    ) : (
                      <Camera size={13} className="text-graphite-500" />
                    )}
                    <span>{subiendoFoto ? 'Subiendo...' : 'Cambiar foto'}</span>
                  </button>
                </div>
              </div>

              <PerfilProfesionalForm
                userProfile={userProfile}
                alGuardar={handleGuardar}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

PerfilModal.displayName = 'PerfilModal'
