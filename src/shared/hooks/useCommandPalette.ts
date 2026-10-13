/**
 * useCommandPalette — Hook omnicanal con 6 categorías del Blueprint 03
 * Pacientes, Citas, Módulos, Acciones, Configuración y Documentos
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { usePacientesStore } from '../../app/stores/pacientesStore'
import { useDarkMode } from './useDarkMode'
import { useRBAC } from './useRBAC'
import { SECCIONES_SIDEBAR } from '../../constants/sidebarConstants'
import {
  ACCIONES_BASE,
  CONFIG_BASE,
  DOCUMENTOS_BASE,
  buildPacienteResults,
  buildCitaResults,
  buildModuloResults,
  buildAccionResults,
  buildConfigResults,
  buildDocumentoResults,
  type PaletteResult,
  type PaletteItem,
} from '../../constants/commandPaletteConstants'
import { agendaStorageService } from '../../domains/operations/agenda/services/agendaStorageService'
import { playSound } from '../utils/soundEffects'
import type { Paciente } from '../../domains/clinical/patient/schemas/pacienteSchema'

export type { PaletteResult, PaletteItem }
export type { PaletteResultType } from '../../constants/commandPaletteConstants'

export interface UseCommandPaletteOptions {
  onNavigate: (seccion: string) => void
  onSelectPaciente: (p: Paciente) => void
  onOpenCita?: (citaId: string | number) => void
  onOpenPreferencias?: () => void
  onEjecutarAccion?: (accionId: string) => void
  onOpenDocumento?: (doc: { tipo: string; id: string | number }) => void
  onCreateCita?: () => void
  onCreatePaciente?: () => void
  onCreatePresupuesto?: () => void
  onOpenAtajos?: () => void
}

export type UseCommandPaletteProps = UseCommandPaletteOptions

export const useCommandPalette = ({
  onNavigate,
  onSelectPaciente,
  onOpenCita,
  onOpenPreferencias,
  onEjecutarAccion,
  onOpenDocumento,
}: UseCommandPaletteOptions) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Debounce de 150ms para fuzzy matching (Blueprint 03 §03)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 150)
    return () => clearTimeout(timer)
  }, [query])

  const pacientes = usePacientesStore((s) => s.pacientes)
  const { puede } = useRBAC()
  const { setTheme } = useDarkMode()

  const pacientesItems = useMemo(() =>
    buildPacienteResults(pacientes || [], debouncedQuery, onNavigate, onSelectPaciente),
    [pacientes, debouncedQuery, onNavigate, onSelectPaciente]
  )

  const citasItems = useMemo(() => {
    let citas: Array<{ id?: string | number; pacienteNombre?: string; motivo?: string; fecha?: string; hora?: string; horaInicio?: string }> = []
    try { citas = agendaStorageService.obtenerCitas() || [] } catch { citas = [] }
    return buildCitaResults(citas, debouncedQuery, onNavigate, onOpenCita)
  }, [debouncedQuery, onNavigate, onOpenCita])

  const modulosItems = useMemo(() => {
    const permitidos = SECCIONES_SIDEBAR.flatMap((s) => s.items).filter(
      (item) => !item.permisoRequerido || puede(item.permisoRequerido)
    )
    return buildModuloResults(permitidos, debouncedQuery, onNavigate)
  }, [puede, debouncedQuery, onNavigate])

  const accionesItems = useMemo(() =>
    buildAccionResults(ACCIONES_BASE, onEjecutarAccion, onNavigate),
    [onEjecutarAccion, onNavigate]
  )

  const configItems = useMemo(() =>
    buildConfigResults(CONFIG_BASE, setTheme, onOpenPreferencias),
    [setTheme, onOpenPreferencias]
  )

  const docsItems = useMemo(() =>
    buildDocumentoResults(DOCUMENTOS_BASE, onOpenDocumento, onNavigate),
    [onOpenDocumento, onNavigate]
  )

  const allResults = useMemo((): PaletteResult[] => [
    ...pacientesItems, ...citasItems, ...modulosItems, ...accionesItems, ...configItems, ...docsItems,
  ], [pacientesItems, citasItems, modulosItems, accionesItems, configItems, docsItems])

  useEffect(() => { setSelectedIndex(0) }, [allResults.length])

  const open = useCallback(() => {
    playSound('openPalette')
    setIsOpen(true)
    setQuery('')
    setDebouncedQuery('')
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setDebouncedQuery('')
  }, [])
  const toggle = useCallback(() => { if (isOpen) close(); else open() }, [isOpen, open, close])

  const handleSelect = useCallback((r: PaletteResult) => {
    const fn = r.ejecutar || r.action
    fn?.()
    close()
    playSound('selectResult')
  }, [close])

  const selectCurrent = useCallback(() => {
    const item = allResults[selectedIndex]
    if (item) handleSelect(item)
  }, [allResults, selectedIndex, handleSelect])

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allResults.length - 1))
  }, [allResults.length])

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < allResults.length - 1 ? prev + 1 : 0))
  }, [allResults.length])

  return {
    isOpen, query, setQuery, selectedIndex, setSelectedIndex,
    allResults, open, close, toggle, selectCurrent, handleSelect, moveUp, moveDown,
  }
}
