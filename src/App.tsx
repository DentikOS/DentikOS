import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react'
import { motion } from 'framer-motion'
import { LoginScreen } from './shared/ui/LoginScreen'
import { Sidebar } from './shared/ui/Sidebar'
import { MobileHamburger } from './shared/ui/MobileHamburger'
import { SidebarMobileOverlay } from './shared/ui/SidebarMobileOverlay'
import { ModoPresentacionBar } from './shared/ui/ModoPresentacionBar'
import { PreferenciasModal } from './shared/ui/PreferenciasModal'
import { DispositivosModal } from './shared/ui/DispositivosModal'
import { PerfilModal } from './shared/ui/PerfilModal'
import { FocusMode } from './shared/ui/FocusMode'
import { KeyboardShortcutsModal } from './shared/ui/KeyboardShortcutsModal'
import { useKeyboardShortcuts } from './shared/hooks/useKeyboardShortcuts'
import { useSupabaseRealtime } from './shared/hooks/useSupabaseRealtime'
import { useNotificationsRealtime } from './shared/hooks/useNotificationsRealtime'
import { useSidebarStore } from './app/stores/useSidebarStore'
import { useTopBarStore } from './app/stores/useTopBarStore'
import { useAutoSurgicalMode } from './shared/hooks/useAutoSurgicalMode'
import { ACCIONES_POR_MODULO } from './constants/topBarActionsConstants'
import { CargandoModulo } from './shared/ui/CargandoModulo'
import { ErrorBoundary } from './shared/ui/ErrorBoundary' // F6-01
import { ToastContainer } from './shared/ui/ToastContainer'
import { AppDialogProvider } from './shared/ui/AppDialogProvider'
import { useAppDialog } from './shared/hooks/useAppDialog'
import { TopBar } from './shared/ui/TopBar'
import { usePrestacionesStore } from './app/stores/prestacionesStore'
import { useSesionStore } from './app/stores/sesionStore'
import { useDataMigration } from './shared/hooks/useDataMigration'
import { useNavegacionClinica } from './domains/clinical/patient/hooks/useNavegacionClinica' // F7-26
import { useRealtimeSync } from './shared/hooks/useRealtimeSync'
import { useOfflineQueue } from './shared/hooks/useOfflineQueue'
import { supabase, USE_SUPABASE } from './infrastructure/supabase/supabaseClient'
import { construirUserProfile } from './infrastructure/clinical-data/userProfileBuilder'
import { useBootstrapDetection } from './shared/hooks/useBootstrapDetection'
import { AceptarInvitacion } from './shared/ui/AceptarInvitacion'
import { BootstrapClinica } from './shared/ui/BootstrapClinica'
import { VerificandoCuenta } from './shared/ui/VerificandoCuenta'
import { useInvitacionHash } from './shared/hooks/useInvitacionHash'
import { useDarkMode } from './shared/hooks/useDarkMode'
import { useThemeClass } from './shared/hooks/useThemeClass'
import { useRestaurarPaciente } from './shared/hooks/useRestaurarPaciente'
import { useSidebarCounters } from './shared/hooks/useSidebarCounters'
import { useCommandPalette } from './shared/hooks/useCommandPalette'
import { CommandPalette } from './shared/ui/CommandPalette'

// Módulos de uso diario — carga eager (Public API, Constitución v3.0.0)
import { Agenda as AgendaModulo } from './domains/operations/agenda'
import { usePresupuestosStore } from './app/stores/usePresupuestosStore'
import { usePacientesStore } from './app/stores/usePacientesStore'
import { useSessionGuard } from './shared/hooks/useSessionGuard'
import { DashboardModulo } from './application/analytics/dashboard'
import { createLogger } from './infrastructure/logging/logger'
import { createTenantRepository } from './infrastructure/storage/localStorageRepository' // F7-36 FASE 1 (hotfix import)
import { migrateCorruptTenantKeys } from './infrastructure/persistence/migrateCorruptTenantKeys'
import type { Paciente } from './domains/clinical/patient/schemas/pacienteSchema'
import type { PerfilUsuario } from './infrastructure/auth/authService'

const log = createLogger('App')

// (F2-05) — resto de los módulos vía React.lazy: no se descargan en el
// bundle inicial, solo cuando el usuario navega a esa sección por primera vez.
const PacientesListado = lazy(() => import('./domains/clinical/patient').then(m => ({ default: m.PacientesListado })))
const FichaClinica = lazy(() => import('./domains/clinical/patient').then(m => ({ default: m.FichaClinica })))
const FinanzasModulo = lazy(() => import('./domains/billing/cash-register').then(m => ({ default: m.FinanzasModulo })))
const InventarioModulo = lazy(() => import('./domains/operations/inventory').then(m => ({ default: m.InventarioModulo })))
const UrgenciasGesModulo = lazy(() => import('./domains/clinical/emergency-ges').then(m => ({ default: m.UrgenciasGesModulo })))
const EsterilizacionModulo = lazy(() => import('./domains/operations/sterilization').then(m => ({ default: m.EsterilizacionModulo })))
const LaboratorioModulo = lazy(() => import('./domains/addons/lab').then(m => ({ default: m.LaboratorioModulo })))
const PrestacionesModulo = lazy(() => import('./domains/organization/prestations').then(m => ({ default: m.PrestacionesModulo })))
const PresupuestosModulo = lazy(() => import('./domains/billing/budget').then(m => ({ default: m.PresupuestosModulo })))
const PagosModulo = lazy(() => import('./domains/billing/payment').then(m => ({ default: m.PagosModulo })))
const ComunicacionesModulo = lazy(() => import('./domains/operations/communications').then(m => ({ default: m.ComunicacionesModulo })))
const ReportesModulo = lazy(() => import('./domains/billing/report').then(m => ({ default: m.ReportesModulo })))
const DatosClinicaForm = lazy(() => import('./domains/organization/clinic').then(m => ({ default: m.DatosClinicaForm })))
const AdminVademecumModulo = lazy(() => import('./domains/organization/vademecum').then(m => ({ default: m.AdminVademecumModulo })))
const GestionMiembrosModulo = lazy(() => import('./domains/organization/team').then(m => ({ default: m.GestionMiembrosModulo })))
const AdministracionDentikOSModulo = lazy(() => import('./domains/organization/clinic').then(m => ({ default: m.AdministracionDentikOSModulo })))

interface SesionStoreState {
  userProfile: PerfilUsuario | null
  login: (profile: PerfilUsuario) => void
  logout: () => void
}

interface PacientesStoreState {
  pacientes: Paciente[]
  setPacientes: (pacientes: Paciente[]) => void
}

interface DashboardModuloProps {
  setPacienteSeleccionado: (paciente: Paciente | null) => void
  setActiveSection: (seccion: string) => void
}

interface AgendaModuloProps {
  alSeleccionarPaciente: (paciente: Paciente) => void
  citaSeleccionadaId?: string | number | null
}

interface PresupuestosModuloProps {
  setPacienteSeleccionado: (paciente: Paciente | null) => void
  setActiveSection: (seccion: string) => void
}

const Dashboard = DashboardModulo as React.ComponentType<DashboardModuloProps>
const Agenda = AgendaModulo as React.ComponentType<AgendaModuloProps>
const Presupuestos = PresupuestosModulo as React.ComponentType<PresupuestosModuloProps>

export const App: React.FC = () => {
  // F7-36 FASE 1 (Commit 1.5f): repo tenant-aware para paciente seleccionado (PHI).
  // La clave clinica_paciente_seleccionado_id ahora se almacena como
  // sd_<clinicaId>_clinica_paciente_seleccionado_id para aislamiento multi-tenant.
  const pacienteSeleccionadoRepo = createTenantRepository<string | null>('clinica_paciente_seleccionado_id', null)

  // F4-02e: Persistir activeSection (localStorage). Si no hay, usar 'Dashboard'.
  const [activeSection, setActiveSection] = useState<string>(() => {
    try {
      const guardado = localStorage.getItem('clinica_active_section')
      return guardado || 'Dashboard'
    } catch {
      return 'Dashboard'
    }
  })
  // F4-02e: Paciente seleccionado (null inicialmente, restaurado desde Supabase).
  const [pacienteSeleccionado, setPacienteSeleccionadoState] = useState<Paciente | null>(null)

  // F4-02e + F7-36: Wrapper que persiste el pacienteId en repo tenant-aware
  const setPacienteSeleccionado = (paciente: Paciente | null): void => {
    setPacienteSeleccionadoState(paciente)
    try {
      if (paciente?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(paciente.id))) {
        // F7-36: usa tenant-aware para aislamiento multi-tenant
        pacienteSeleccionadoRepo.guardar(String(paciente.id))
      } else {
        pacienteSeleccionadoRepo.eliminar()
      }
    } catch (e: unknown) {
      log.error('Error al persistir pacienteId:', e)
    }
  }

  // F4-02e: Persistir activeSection cuando cambia
  useEffect(() => {
    try {
      localStorage.setItem('clinica_active_section', activeSection)
    } catch (e: unknown) {
      log.error('Error al persistir sección activa:', e)
    }
  }, [activeSection])

  const userProfile = useSesionStore((state: unknown) => (state as SesionStoreState).userProfile)
  const loginStore = useSesionStore((state: unknown) => (state as SesionStoreState).login)
  const pacienteActivo = usePacientesStore((s) => s.pacienteActivo)
  const bootstrapNecesario = useBootstrapDetection(userProfile) // F7-11b
  // F7-11: Detectar invitación pendiente en URL hash
  const invitacionPendiente = useInvitacionHash()

  // F7-25: Dark mode y modo quirúrgico con persistencia
  const { theme, darkMode, cycleTheme, toggleDarkMode } = useDarkMode()
  useThemeClass()
  useKeyboardShortcuts()
  useSupabaseRealtime()
  useNotificationsRealtime()
  const logoutStore = useSesionStore((state: unknown) => (state as SesionStoreState).logout)

  // F6-H: Timeout de sesión + sincronización entre pestañas + manejo de errores 401
  useSessionGuard({ userProfile, logout: logoutStore })

  // F4-02e: Restaurar paciente seleccionado desde Supabase al recargar
  useRestaurarPaciente(userProfile, pacienteSeleccionado, setPacienteSeleccionadoState, setActiveSection)
  // F10-B2.5: contadores para el Sidebar
  const sidebarCounters = useSidebarCounters()

  // F7-26: Navegación clínica entre pacientes (← → en ficha)
  const navegacionClinica = useNavegacionClinica(
    pacienteSeleccionado,
    setPacienteSeleccionado
  )

  // Blueprint 02 & 03: Modo Foco, Modo Presentación, Atajos y Modo Quirúrgico
  const focusMode = useSidebarStore((s) => s.focusMode)
  const setFocusMode = useSidebarStore((s) => s.setFocusMode)
  const toggleFocusMode = useSidebarStore((s) => s.toggleFocusMode)
  const presentationMode = useTopBarStore((s) => s.presentationMode)
  const setPresentationMode = useTopBarStore((s) => s.setPresentationMode)
  const startTimer = useTopBarStore((s) => s.startTimer)
  const stopTimer = useTopBarStore((s) => s.stopTimer)
  const [perfilModalOpen, setPerfilModalOpen] = useState(false)
  const [preferenciasModalOpen, setPreferenciasModalOpen] = useState(false)
  const [dispositivosModalOpen, setDispositivosModalOpen] = useState(false)
  const [citaSeleccionadaId, setCitaSeleccionadaId] = useState<string | number | null>(null)
  useAutoSurgicalMode()

  const handleOpenCita = useCallback((citaId: string | number) => {
    setActiveSection('Agenda')
    setCitaSeleccionadaId(citaId)
  }, [setActiveSection])

  const handleEjecutarAccion = useCallback((accionId: string) => {
    if (accionId === 'nueva-cita') {
      setActiveSection('Agenda')
    } else if (accionId === 'nuevo-paciente') {
      setActiveSection('Pacientes')
    } else if (accionId === 'nuevo-pago') {
      setActiveSection('Pagos')
    } else if (accionId === 'exportar-reportes') {
      setActiveSection('Reportes')
    }
  }, [setActiveSection])

  const handleOpenDocumento = useCallback((doc: { tipo: string; id: string | number }) => {
    if (doc.tipo === 'presupuesto') {
      setActiveSection('Presupuestos')
    } else if (doc.tipo === 'receta') {
      setActiveSection('Vademécum')
    } else {
      setActiveSection('Documentos')
    }
  }, [setActiveSection])

  // F10-B4: CommandPalette con ⌘K (Navegación omnicanal 6 categorías - HOTFIX 03.1)
  const commandPalette = useCommandPalette({
    onNavigate: setActiveSection,
    onSelectPaciente: (paciente: Paciente) => setPacienteSeleccionado(paciente),
    onOpenCita: handleOpenCita,
    onOpenPreferencias: () => setPreferenciasModalOpen(true),
    onEjecutarAccion: handleEjecutarAccion,
    onOpenDocumento: handleOpenDocumento,
  })

  // Iniciar timer de atención cuando se abre ficha de paciente
  useEffect(() => {
    if (pacienteSeleccionado) startTimer()
    else stopTimer()
  }, [pacienteSeleccionado, startTimer, stopTimer])

  // Acciones contextuales por módulo del Blueprint 03
  const accionesConfig = ACCIONES_POR_MODULO[activeSection]
  const accionPrimaria = useMemo(() => {
    if (!accionesConfig?.primaria) return null
    const mapAction: Record<string, () => void> = {
      crearCita: () => setActiveSection('Agenda'),
      crearPaciente: () => {
        setActiveSection('Pacientes')
        setPacienteSeleccionado(null)
        setTimeout(() => window.dispatchEvent(new CustomEvent('abrir_nuevo_paciente')), 50)
      },
      crearPresupuesto: () => setActiveSection('Presupuestos'),
      registrarPago: () => setActiveSection('Pagos'),
      nuevoItem: () => setActiveSection('Inventario'),
      nuevoCiclo: () => setActiveSection('Esterilización'),
      ingresoGes: () => setActiveSection('Urgencias GES'),
      buscarFarmaco: () => setActiveSection('Vademécum'),
    }
    return {
      label: accionesConfig.primaria.label,
      icon: accionesConfig.primaria.icon,
      onClick: mapAction[accionesConfig.primaria.actionKey] || (() => {}),
    }
  }, [accionesConfig, setActiveSection, setPacienteSeleccionado])

  const accionesSecundarias = useMemo(() => {
    if (!accionesConfig?.secundarias) return []
    return accionesConfig.secundarias.map((sec) => ({
      label: sec.label,
      icon: sec.icon,
      onClick: () => {
        if (sec.actionKey === 'crearPaciente') {
          setActiveSection('Pacientes')
          setPacienteSeleccionado(null)
          setTimeout(() => window.dispatchEvent(new CustomEvent('abrir_nuevo_paciente')), 50)
        } else if (sec.actionKey === 'crearCita') {
          setActiveSection('Agenda')
        } else if (sec.actionKey === 'abrirReportes') {
          setActiveSection('Reportes')
        } else if (sec.actionKey === 'crearPresupuesto') {
          setActiveSection('Presupuestos')
        } else if (sec.actionKey === 'ajusteStock') {
          setActiveSection('Inventario')
        } else if (sec.actionKey === 'garantias') {
          setActiveSection('Urgencias GES')
        }
      },
    }))
  }, [accionesConfig, setActiveSection, setPacienteSeleccionado])

  // Breadcrumbs dinámicos para TopBar
  const breadcrumbs = useMemo(() => {
    if (activeSection === 'Pacientes' && pacienteSeleccionado) {
      return [
        { label: 'Pacientes', onClick: () => setPacienteSeleccionado(null) },
        { label: pacienteSeleccionado.nombre },
      ]
    }
    return [{ label: activeSection }]
  }, [activeSection, pacienteSeleccionado])

  useDataMigration(userProfile)

  // F5-02: activar sincronización en tiempo real
  useRealtimeSync()

  // F5-03: procesar cola offline al iniciar y al volver la conexión
  useOfflineQueue()

  useEffect(() => {
    const refrescarDesdeStorage = (usePrestacionesStore.getState() as { refrescarDesdeStorage: () => void }).refrescarDesdeStorage

    const handleNavegarSeccion = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) setActiveSection(customEvent.detail)
    }

    window.addEventListener('storage', refrescarDesdeStorage)
    window.addEventListener('arancel_actualizado', refrescarDesdeStorage)
    window.addEventListener('navegar_seccion', handleNavegarSeccion)

    return () => {
      window.removeEventListener('storage', refrescarDesdeStorage)
      window.removeEventListener('arancel_actualizado', refrescarDesdeStorage)
      window.removeEventListener('navegar_seccion', handleNavegarSeccion)
    }
  }, [])

  // Listeners para atajos de creación (Blueprint 02 §07)
  useEffect(() => {
    const handleNuevaCita = () => {
      setActiveSection('Agenda')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('abrir_nueva_cita'))
      }, 100)
    }

    const handleNuevoPaciente = () => {
      setActiveSection('Pacientes')
      setPacienteSeleccionado(null)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('abrir_nuevo_paciente'))
      }, 100)
    }

    window.addEventListener('nueva_cita', handleNuevaCita)
    window.addEventListener('abrir_nuevo_paciente', handleNuevoPaciente)

    return () => {
      window.removeEventListener('nueva_cita', handleNuevaCita)
      window.removeEventListener('abrir_nuevo_paciente', handleNuevoPaciente)
    }
  }, [setActiveSection, setPacienteSeleccionado])

  // F4-02b FIX: Detectar sesión de Supabase al cargar la app
  // y restaurar perfil. IMPORTANTE: solo restaurar si NO hay logout en progreso.
  useEffect(() => {
    if (!USE_SUPABASE || !supabase) return

    // Si userProfile acaba de ser limpiado (logout), no restaurar
    // Esto previene que el useEffect restaure la sesión inmediatamente
    // después de un logout intencional.
    if (userProfile === null) {
      // Esperar un tick para ver si el logout completó el cierre de Supabase
      const timer = setTimeout(async () => {
        try {
          if (!supabase) return
          const { data: { session } } = await supabase.auth.getSession()

          // Solo restaurar si Supabase TODAVÍA tiene sesión activa
          // (si el usuario cerró sesión manualmente, session será null)
          if (session?.user) {
            log.info('Sesión de Supabase detectada, restaurando perfil...')

            // F7-10b: reconstruir perfil con rol contextual vía construirUserProfile
            // (lee miembros_clinica.rol filtrado por clinica_actual())
            const userMetadata = { ...(session.user.user_metadata || {}), role: session.user.app_metadata?.role || 'recepcion' }
            const perfilRestaurado = await construirUserProfile(
              session.user.email?.toLowerCase() || '',
              userMetadata,
              {}
            )

            loginStore(perfilRestaurado as unknown as PerfilUsuario)
            log.info('F7-10b: Perfil restaurado con rol contextual:', perfilRestaurado.rol)
          }
        } catch (error: unknown) {
          log.error('Error restaurando sesión de Supabase:', error)
        }
      }, 100) // 100ms delay para dar tiempo al logout de cerrar Supabase

      return () => clearTimeout(timer)
    }
  }, [userProfile, loginStore])

  const pacientes = usePacientesStore((state: unknown) => (state as PacientesStoreState).pacientes)
  const setPacientes = usePacientesStore((state: unknown) => (state as PacientesStoreState).setPacientes)

  useEffect(() => {
    if (userProfile?.nombreCompleto) document.title = `DentikOS — ${userProfile.nombreCompleto}`
    else document.title = 'DentikOS'
  }, [userProfile])

  // Hotfix 3/4: migración automática de claves corruptas de localStorage
  useEffect(() => {
    if (userProfile?.email) {
      // Ejecutar migración de claves corruptas una sola vez por sesión
      const MIGRATION_KEY = 'dentikos_corrupt_keys_migrated_v1'
      const alreadyMigrated = localStorage.getItem(MIGRATION_KEY)

      if (!alreadyMigrated) {
        const result = migrateCorruptTenantKeys()
        if (result.migrated > 0 || result.deleted > 0) {
          localStorage.setItem(MIGRATION_KEY, new Date().toISOString())
        }
      }
    }
  }, [userProfile?.email])

  const handleLogin = (profile: PerfilUsuario): void => {
    loginStore(profile)
  }

  const handleLogout = (): void => {
    logoutStore()
  }

  const handleActualizarPaciente = (datos: Partial<Paciente> | Paciente): void => {
    const pacienteActualizado: Paciente = { ...(pacienteSeleccionado || {}), ...datos } as Paciente
    const nuevaLista = pacientes.map(p => p.id === pacienteActualizado.id ? pacienteActualizado : p)
    setPacientes(nuevaLista)
    setPacienteSeleccionado(pacienteActualizado)
  }

  const { confirm } = useAppDialog()
  const handleEliminarPaciente = async (idPaciente: string | number): Promise<boolean> => {
    const confirmado = await confirm({
      title: 'Eliminar paciente',
      description: '¿Estás seguro de eliminar este paciente? El paciente se archivará y podrá ser restaurado por un administrador.',
      variant: 'danger',
      confirmText: 'Eliminar'
    })
    if (!confirmado) return false
    usePacientesStore.getState().setPacientes((prev) => prev.filter((p) => String(p.id) !== String(idPaciente)))
    if (pacienteSeleccionado && String(pacienteSeleccionado.id) === String(idPaciente)) {
      setPacienteSeleccionado(null)
    }
    return true
  }

  // F7-11b: Pantalla de verificación mientras se determina bootstrapNecesario
  if (bootstrapNecesario === null && userProfile) return <VerificandoCuenta />

  if (bootstrapNecesario) {
    return (
      <>
        <AppDialogProvider />
        <BootstrapClinica onComplete={() => window.location.reload()} />
      </>
    )
  }

  // F7-11: Invitación pendiente
  if (invitacionPendiente) return <AceptarInvitacion onAceptarExitoso={() => window.location.reload()} />

  if (!userProfile) return <LoginScreen onLogin={handleLogin} />

  return (
    <>
      <ToastContainer />
      <AppDialogProvider />
      <CommandPalette {...commandPalette} />
      <PerfilModal isOpen={perfilModalOpen} onClose={() => setPerfilModalOpen(false)} />
      <PreferenciasModal isOpen={preferenciasModalOpen} onClose={() => setPreferenciasModalOpen(false)} />
      <DispositivosModal isOpen={dispositivosModalOpen} onClose={() => setDispositivosModalOpen(false)} />
      <ModoPresentacionBar
        activo={presentationMode}
        paciente={pacienteSeleccionado}
        onSalir={() => setPresentationMode(false)}
      />

      {/* Features Premium: Modo Foco y Panel de Atajos */}
      <FocusMode />
      <KeyboardShortcutsModal />

      <div className="min-h-screen flex flex-col bg-canvas text-primary-surface font-sans">
        {focusMode ? (
          <div className="h-12 flex items-center px-4 bg-white dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#24334A] shrink-0">
            <span className="text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
              Modo Foco — {pacienteSeleccionado?.nombre || 'Ficha Clínica'}
            </span>
          </div>
        ) : (
          <TopBar
            userProfile={userProfile}
            activeSection={activeSection}
            pacienteSeleccionado={pacienteSeleccionado}
            onLogout={handleLogout}
            darkMode={darkMode}
            theme={theme}
            breadcrumbs={breadcrumbs}
            accionPrimaria={accionPrimaria}
            accionesSecundarias={accionesSecundarias}
            onOpenSearch={() => commandPalette.toggle()}
            onOpenAtajos={() => window.dispatchEvent(new CustomEvent('open-shortcuts-modal'))}
            onOpenPerfil={() => setPerfilModalOpen(true)}
            onOpenPreferencias={() => setPreferenciasModalOpen(true)}
            onOpenDispositivos={() => setDispositivosModalOpen(true)}
            hamburger={<MobileHamburger />}
          />
        )}
        <div className="flex flex-1">
          <Sidebar userProfile={userProfile} activeSection={activeSection} setActiveSection={setActiveSection} onLogout={handleLogout} counters={sidebarCounters} />
          <SidebarMobileOverlay userProfile={userProfile} activeSection={activeSection} setActiveSection={setActiveSection} onLogout={handleLogout} counters={sidebarCounters} />

          <main className="flex-1 p-8 print:p-0 overflow-x-hidden">
            <Suspense fallback={<CargandoModulo />}>
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{
                  duration: 0.35, // Token "Fluido"
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {activeSection === 'Dashboard' && (
                  <Dashboard
                    setPacienteSeleccionado={setPacienteSeleccionado}
                    setActiveSection={setActiveSection}
                  />
                )}

                {activeSection === 'Agenda' && (
                  <ErrorBoundary modulo="agenda" onReset={() => setActiveSection('Dashboard')}>
                    <Agenda
                      alSeleccionarPaciente={(paciente: Paciente) => {
                        setPacienteSeleccionado(paciente)
                        setActiveSection('Pacientes')
                      }}
                      citaSeleccionadaId={citaSeleccionadaId}
                    />
                  </ErrorBoundary>
                )}

                {(activeSection === 'Urgencias y GES' || activeSection === 'Urgencias GES') && (
                  <UrgenciasGesModulo />
                )}

                {activeSection === 'Esterilización' && (
                  <EsterilizacionModulo />
                )}

                {activeSection === 'Laboratorio' && (
                  <LaboratorioModulo />
                )}

                {activeSection === 'Prestaciones' && (
                  <PrestacionesModulo />
                )}

                {activeSection === 'Presupuestos' && (
                  <ErrorBoundary modulo="presupuestos" onReset={() => setActiveSection('Dashboard')}>
                    <Presupuestos
                      setPacienteSeleccionado={setPacienteSeleccionado}
                      setActiveSection={setActiveSection}
                    />
                  </ErrorBoundary>
                )}

                {activeSection === 'Pagos' && (
                  <PagosModulo />
                )}

                {activeSection === 'Finanzas' && (
                  <FinanzasModulo />
                )}

                {activeSection === 'Comunicaciones' && (
                  <ComunicacionesModulo />
                )}

                {activeSection === 'Inventario' && <InventarioModulo />}

                {activeSection === 'Reportes' && (
                  <ReportesModulo />
                )}

                {(activeSection === 'Administración DentikOS' || activeSection === 'Miembros' || activeSection === 'Configuración') && (
                  <AdministracionDentikOSModulo userProfile={userProfile} />
                )}

                {activeSection === 'Vademécum' && <AdminVademecumModulo />}

                {activeSection === 'Pacientes' && (
                  <ErrorBoundary modulo="pacientes" onReset={() => { setPacienteSeleccionado(null); usePacientesStore.getState().cerrarFicha(); setActiveSection('Dashboard') }}>
                    {(pacienteSeleccionado || pacienteActivo) ? (
                      <FichaClinica
                        paciente={(pacienteSeleccionado || pacienteActivo)!}
                        pacienteId={(pacienteSeleccionado || pacienteActivo)?.id}
                        alActualizarPaciente={handleActualizarPaciente}
                        alEliminarPaciente={handleEliminarPaciente}
                        alVolver={() => {
                          setPacienteSeleccionado(null)
                          usePacientesStore.getState().cerrarFicha()
                        }}
                        navegacionClinica={navegacionClinica} /* F7-26 */
                      />
                    ) : (
                      <PacientesListado
                        alSeleccionarPaciente={(p) => {
                          setPacienteSeleccionado(p)
                          usePacientesStore.getState().setPacienteActivo(p)
                        }}
                        alEliminarPaciente={handleEliminarPaciente}
                        alPacienteCreado={(p) => {
                          setPacienteSeleccionado(p as Paciente)
                          usePacientesStore.getState().setPacienteActivo(p as Paciente)
                        }}
                      />
                    )}
                  </ErrorBoundary>
                )}
              </motion.div>
            </Suspense>
          </main>
        </div>
      </div>
    </>
  )
}

export default App
