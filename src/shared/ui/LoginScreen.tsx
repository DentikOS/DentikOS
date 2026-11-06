import React, { useState, useEffect, useCallback } from 'react'
import {
  supabaseSignIn,
  supabaseSignUp,
  reenviarEmailVerificacion,
  type PerfilUsuario,
} from '../../infrastructure/auth/authService'
import { construirUserProfile } from '../../infrastructure/clinical-data/userProfileBuilder'
import { obtenerRolPorDefecto } from '../../infrastructure/auth/rbacService'
import { createLogger } from '../../infrastructure/logging/logger'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { LoginBrandBanner } from './LoginBrandBanner'
import { DentikOSLogo } from './brand/DentikOSLogo'
import { RecuperarContrasena } from './RecuperarContrasena'
import { RegistroForm } from './RegistroForm'
import { useLoginStates, type EstadoLogin } from '../hooks/useLoginStates'
import { useDarkMode } from '../hooks/useDarkMode'
import { Eye, EyeOff, Lock, RefreshCw, AlertTriangle, Globe } from 'lucide-react'

const log = createLogger('LoginScreen')
const REMEMBER_KEY = 'dentikos_remember_email'

export type { EstadoLogin }

export interface LoginScreenProps {
  onLogin: (profile: PerfilUsuario) => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(REMEMBER_KEY) || ''
    return ''
  })
  const [password, setPassword] = useState<string>('')
  const [mostrarPassword, setMostrarPassword] = useState<boolean>(false)
  const [recordarme, setRecordarme] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') return !!localStorage.getItem(REMEMBER_KEY)
    return false
  })
  const [isFirstTime, setIsFirstTime] = useState<boolean>(false)
  const [nombreCompleto, setNombreCompleto] = useState<string>('')
  const [rut, setRut] = useState<string>('')
  const [especialidad, setEspecialidad] = useState<string>('')
  const [rol, setRol] = useState<string>(obtenerRolPorDefecto())
  const [modalRecuperar, setModalRecuperar] = useState<boolean>(false)
  const [idioma, setIdioma] = useState<'ES' | 'EN'>('ES')

  const { theme, setTheme } = useDarkMode()
  const { estado, errorMsg, setEstado, setErrorMsg, resetearFallosLogin, procesarErrorAuth } =
    useLoginStates({ email, password })

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('reset-password')) {
      setModalRecuperar(true)
    }
  }, [])

  // Escape cancela el flujo de registro
  const handleCancelarRegistro = useCallback((): void => {
    setIsFirstTime(false)
    setEmail('')
    setPassword('')
    setNombreCompleto('')
    setRut('')
    setEspecialidad('')
    setErrorMsg('')
  }, [setErrorMsg])

  useEffect(() => {
    if (!isFirstTime) return
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') handleCancelarRegistro()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isFirstTime, handleCancelarRegistro])

  const handleRecordarmeToggle = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const checked = e.target.checked
    setRecordarme(checked)
    if (!checked && typeof localStorage !== 'undefined') localStorage.removeItem(REMEMBER_KEY)
  }

  const handleReenviarVerificacion = async (): Promise<void> => {
    if (!email.trim()) return
    const res = await reenviarEmailVerificacion(email.trim())
    if (res.success) setErrorMsg('Correo de verificación reenviado.')
    else setErrorMsg(res.error || 'Error al reenviar correo.')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (email.trim() === '' || password === '' || estado === 'cuenta_bloqueada') return

    const formattedEmail = email.trim().toLowerCase()
    if (recordarme && typeof localStorage !== 'undefined') {
      localStorage.setItem(REMEMBER_KEY, formattedEmail)
    }

    setEstado('cargando')
    setErrorMsg('')

    try {
      const metadata: Record<string, unknown> = {
        nombreCompleto: nombreCompleto || 'Profesional Dental',
        rut: rut || '',
        especialidad: especialidad || 'Cirujano Dentista',
        rol,
      }

      if (isFirstTime) {
        const result = await supabaseSignUp(formattedEmail, password, metadata)
        if (!result.success) {
          procesarErrorAuth(result.error || 'Error al registrar usuario')
          return
        }
      } else {
        const result = await supabaseSignIn(formattedEmail, password)
        if (!result.success) {
          procesarErrorAuth(result.error || 'Credenciales inválidas')
          return
        }
        metadata._supabaseUserMetadata = result.userMetadata || {}
      }

      resetearFallosLogin()
      const userMetadata = (metadata._supabaseUserMetadata as Record<string, unknown>) || {}
      const userProfile = await construirUserProfile(formattedEmail, userMetadata, metadata)
      onLogin(userProfile as unknown as PerfilUsuario)
    } catch (err: unknown) {
      log.error('Error inesperado en login:', err)
      procesarErrorAuth('Error inesperado de autenticación')
    }
  }

  return (
    <div className="min-h-[100svh] bg-[#070B14] flex items-center justify-center p-3 sm:p-6 text-slate-100" role="main">
      <div className="w-full max-w-md lg:max-w-5xl bg-[#080E1E] lg:bg-[#0B132B]/95 rounded-2xl lg:rounded-3xl shadow-xl lg:shadow-2xl border border-[#24334A] overflow-hidden flex flex-col lg:flex-row">
        <div className="hidden lg:flex lg:w-[55%]">
          <LoginBrandBanner />
        </div>

        <div className="w-full lg:w-[45%] p-5 sm:p-10 flex flex-col justify-between bg-[#080E1E] login-form-panel">
          <div>
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <DentikOSLogo variant="horizontal" size="sm" opticalSize="standard" dark={true} />
              <span className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-1 rounded-md border border-slate-700/50">
                v1.0.0
              </span>
            </div>

            <div className="flex justify-between items-center mb-6">
              <span className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold flex items-center gap-1.5">
                <Lock size={12} /> Acceso Quirúrgico
              </span>
              <span className="hidden lg:inline text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/50">
                v1.0.0
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">
              {isFirstTime ? 'Comenzar con DentikOS' : 'Iniciar Sesión'}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {isFirstTime ? 'Configura tus credenciales maestras' : 'Ingresa tus credenciales para acceder a tu consulta'}
            </p>

            {estado === 'mantenimiento' && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Correo electrónico"
                id="login-email"
                data-testid="login-email"
                type="email"
                required
                disabled={estado === 'cargando' || estado === 'cuenta_bloqueada'}
                size="lg"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg('') }}
                placeholder="dr.odontologo@clinica.cl"
              />

              <div className="relative">
                <Input
                  label="Contraseña"
                  id="login-password"
                  data-testid="login-password"
                  type={mostrarPassword ? 'text' : 'password'}
                  required
                  disabled={estado === 'cargando' || estado === 'cuenta_bloqueada'}
                  size="lg"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg('') }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-white transition-colors p-1"
                >
                  {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {isFirstTime && (
                <RegistroForm
                  nombreCompleto={nombreCompleto}
                  rut={rut}
                  especialidad={especialidad}
                  rol={rol}
                  onNombreCompleto={setNombreCompleto}
                  onRut={setRut}
                  onEspecialidad={setEspecialidad}
                  onRol={setRol}
                  onVolver={handleCancelarRegistro}
                />
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={recordarme}
                    onChange={handleRecordarmeToggle}
                    className="rounded border-slate-700 bg-slate-900 text-[#D4AF37] focus:ring-0"
                  />
                  <span>Recordarme</span>
                </label>
                <button
                  type="button"
                  onClick={() => setModalRecuperar(true)}
                  className="text-slate-400 hover:text-[#D4AF37] transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {errorMsg && (
                <div data-testid="login-error" role="alert" className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex justify-between items-center">
                  <span>{errorMsg}</span>
                  {estado === 'email_no_verificado' && (
                    <button type="button" onClick={handleReenviarVerificacion} className="underline font-semibold ml-2 text-amber-300">
                      Reenviar
                    </button>
                  )}
                  {['error_credenciales', 'error_red'].includes(estado) && (
                    <button type="button" onClick={() => { setErrorMsg(''); setEstado('vacio') }} className="ml-2 inline-flex items-center gap-1 text-slate-300 hover:text-white">
                      <RefreshCw size={12} /> Reintentar
                    </button>
                  )}
                </div>
              )}

              <Button
                data-testid="login-submit"
                type="submit"
                loading={estado === 'cargando'}
                disabled={estado === 'cuenta_bloqueada' || (!email.trim() && !password)}
                fullWidth
                className="mt-2"
              >
                {estado === 'cargando' ? 'Iniciando...' : isFirstTime ? 'Crear cuenta profesional' : 'Iniciar Sesión'}
              </Button>

              <div className="relative py-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
                <span className="relative bg-[#080E1E] px-3 text-[11px] text-slate-500 uppercase tracking-wider">o</span>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => { setIsFirstTime(!isFirstTime); setErrorMsg('') }}
                className="text-xs text-slate-300 hover:text-white border border-slate-800"
              >
                {isFirstTime ? '¿Ya tienes cuenta? Iniciar sesión' : 'Comenzar con DentikOS'}
              </Button>
            </form>
          </div>

          {/* Footer multi-tema, idioma y legal */}
          <div className="pt-6 mt-6 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setTheme('light')} className={`px-2 py-0.5 rounded text-[11px] ${theme === 'light' ? 'bg-[#D4AF37] text-black font-semibold' : 'hover:text-white'}`}>Claro</button>
                <button type="button" onClick={() => setTheme('dark')} className={`px-2 py-0.5 rounded text-[11px] ${theme === 'dark' ? 'bg-[#D4AF37] text-black font-semibold' : 'hover:text-white'}`}>Oscuro</button>
              </div>
              <button type="button" onClick={() => setIdioma(idioma === 'ES' ? 'EN' : 'ES')} className="inline-flex items-center gap-1 text-[11px] hover:text-white">
                <Globe size={12} /> {idioma}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>© 2026 DentikOS</span>
              <div className="flex gap-2">
                <a href="#terminos" className="hover:text-slate-400">Términos</a>
                <span>·</span>
                <a href="#privacidad" className="hover:text-slate-400">Privacidad</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalRecuperar && (
        <RecuperarContrasena
          emailInicial={email}
          alCerrar={() => setModalRecuperar(false)}
          modoNuevaContrasena={typeof window !== 'undefined' && window.location.hash.includes('reset-password')}
        />
      )}
    </div>
  )
}

LoginScreen.displayName = 'LoginScreen'
