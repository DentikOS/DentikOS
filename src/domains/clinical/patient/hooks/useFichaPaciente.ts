import { useState, useEffect, useMemo, useCallback } from 'react'
import type React from 'react'
import { pacientesStorageService } from '../services/pacientesStorageService'
import { evolucionesStorageService, type EvolucionClinicaLocal } from '../services/evolucionesStorageService'
import { certificadosStorageService } from '../services/certificadosStorageService'
import type { CertificadoPapelera } from '../services/papeleraCertificadosService'
// F6-D-4: usar recetasStorageService para recetas
import { recetasStorageService, type RecetaLocal } from '../services/recetasStorageService'
import { odontogramaStorageService, type OdontogramaDatos } from '../../../../domains/clinical/odontogram/services/odontogramaStorageService'
import { useFichaClinicaSync } from './useFichaClinicaSync'
import type { ItemPresupuesto, AbonoItem } from './usePresupuestoForm'
import type { Paciente } from '../schemas/pacienteSchema'

export interface FichaDataState {
  motivoConsulta: string
  anamnesisProxima: string
  alergias: string
  enfermedades: string
  medicamentos: string
  habitos: string
  examenExtraoral: string
  examenIntraoral: string
  presionArterial: string
  riesgoCariogenico: string
  riesgoPeriodontal: string
}

export interface UseFichaPacienteReturn {
  sincronizando: boolean
  syncError: string | null
  tabActiva: string
  setTabActiva: (tab: string) => void
  odontogramaInicial: OdontogramaDatos
  odontogramaEvolucion: OdontogramaDatos
  guardarInicial: (nuevoOdonto: OdontogramaDatos) => Promise<void>
  guardarEvolucion: (nuevoOdonto: OdontogramaDatos) => Promise<void>
  fichaData: FichaDataState
  handleFichaChange: (campo: keyof FichaDataState | string, valor: string) => void
  itemsPresupuesto: ItemPresupuesto[]
  setItemsPresupuesto: React.Dispatch<React.SetStateAction<ItemPresupuesto[]>>
  abonos: AbonoItem[]
  setAbonos: React.Dispatch<React.SetStateAction<AbonoItem[]>>
  recetas: RecetaLocal[]
  setRecetas: React.Dispatch<React.SetStateAction<RecetaLocal[]>>
  evolucionesNotas: EvolucionClinicaLocal[]
  setEvolucionesNotas: React.Dispatch<React.SetStateAction<EvolucionClinicaLocal[]>>
  certificados: CertificadoPapelera[]
  setCertificados: React.Dispatch<React.SetStateAction<CertificadoPapelera[]>>
  totalPresupuesto: number
  totalAbonado: number
  saldoPendiente: number
}

export const useFichaPaciente = (
  paciente: Paciente,
  alActualizarPaciente: (paciente: Paciente) => void
): UseFichaPacienteReturn => {
  // F6-D-1: Sincronizar datos clínicos desde Supabase al abrir la ficha
  const { sincronizando, error: syncError } = useFichaClinicaSync(paciente?.id)

  const [tabActiva, setTabActiva] = useState<string>('Ficha Clínica')
  const [odontogramaInicial, setOdontogramaInicial] = useState<OdontogramaDatos>({})
  const [odontogramaEvolucion, setOdontogramaEvolucion] = useState<OdontogramaDatos>({})
  
  const [itemsPresupuesto, setItemsPresupuesto] = useState<ItemPresupuesto[]>(() => 
    pacientesStorageService.obtenerItem<ItemPresupuesto[]>(`presupuesto_items_${paciente.id}`, [])
  )
  const [abonos, setAbonos] = useState<AbonoItem[]>(() => 
    pacientesStorageService.obtenerItem<AbonoItem[]>(`abonos_${paciente.id}`, [])
  )
  // F6-D-4: cargar recetas desde Supabase (vía recetasStorageService)
  const [recetas, setRecetas] = useState<RecetaLocal[]>(() => 
    recetasStorageService.obtenerRecetas(paciente.id, [])
  )
  // F6-D-5: cargar evoluciones desde Supabase (vía evolucionesStorageService)
  const [evolucionesNotas, setEvolucionesNotas] = useState<EvolucionClinicaLocal[]>(() => 
    evolucionesStorageService.obtenerEvoluciones(String(paciente.id), [])
  )
  // F6-D-6: cargar certificados desde Supabase (vía certificadosStorageService)
  const [certificados, setCertificados] = useState<CertificadoPapelera[]>(() => 
    certificadosStorageService.obtenerCertificados(paciente.id, []) as CertificadoPapelera[]
  )

  const [fichaData, setFichaData] = useState<FichaDataState>({
    motivoConsulta: (paciente as unknown as Record<string, string>).motivoConsulta || '',
    anamnesisProxima: (paciente as unknown as Record<string, string>).anamnesisProxima || '',
    alergias: Array.isArray(paciente.alergias) ? paciente.alergias.join(', ') : (paciente.alergias || ''),
    enfermedades: (paciente as unknown as Record<string, string>).enfermedades || '',
    medicamentos: (paciente as unknown as Record<string, string>).medicamentos || '',
    habitos: (paciente as unknown as Record<string, string>).habitos || '',
    examenExtraoral: (paciente as unknown as Record<string, string>).examenExtraoral || '',
    examenIntraoral: (paciente as unknown as Record<string, string>).examenIntraoral || '',
    presionArterial: (paciente as unknown as Record<string, string>).presionArterial || '',
    riesgoCariogenico: (paciente as unknown as Record<string, string>).riesgoCariogenico || 'Bajo',
    riesgoPeriodontal: (paciente as unknown as Record<string, string>).riesgoPeriodontal || 'Gingivitis'
  })

  // F6-D-2: cargar odontogramas desde Supabase (vía odontogramaStorageService)
  // F7-17: odontogramaStorageService es importación de módulo (singleton estable),
  // NO debe estar en deps. useEffect solo re-ejecuta cuando cambia paciente.id.
  useEffect(() => {
    const dataInicial = odontogramaStorageService.obtenerOdontogramaInicial(paciente.id, {})
    setOdontogramaInicial(dataInicial)

    const dataEvolucion = odontogramaStorageService.obtenerOdontogramaEvolucion(paciente.id, {})
    setOdontogramaEvolucion(dataEvolucion)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente.id])

  const handleFichaChange = useCallback((campo: keyof FichaDataState | string, valor: string): void => {
    setFichaData(prev => {
      const nuevaFicha = { ...prev, [campo]: valor }
      alActualizarPaciente({ ...paciente, ...nuevaFicha })
      return nuevaFicha
    })
  }, [paciente, alActualizarPaciente])

  // F6-D-2: guardar en Supabase + localStorage
  const guardarInicial = useCallback(async (nuevoOdonto: OdontogramaDatos): Promise<void> => {
    setOdontogramaInicial(nuevoOdonto)
    await odontogramaStorageService.guardarOdontogramaInicial(paciente.id, nuevoOdonto)
  }, [paciente.id])

  // F6-D-2: guardar en Supabase + localStorage
  const guardarEvolucion = useCallback(async (nuevoOdonto: OdontogramaDatos): Promise<void> => {
    setOdontogramaEvolucion(nuevoOdonto)
    await odontogramaStorageService.guardarOdontogramaEvolucion(paciente.id, nuevoOdonto)
  }, [paciente.id])

  const totalPresupuesto = useMemo(() => (itemsPresupuesto || []).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0), [itemsPresupuesto])
  const totalAbonado = useMemo(() => (abonos || []).reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0), [abonos])
  const saldoPendiente = totalPresupuesto - totalAbonado

  return {
    // F6-D-1: estado de sincronización de datos clínicos
    sincronizando,
    syncError,
    tabActiva,
    setTabActiva,
    odontogramaInicial,
    odontogramaEvolucion,
    guardarInicial,
    guardarEvolucion,
    fichaData,
    handleFichaChange,
    itemsPresupuesto,
    setItemsPresupuesto,
    abonos,
    setAbonos,
    recetas,
    setRecetas,
    evolucionesNotas,
    setEvolucionesNotas,
    certificados,
    setCertificados,
    totalPresupuesto,
    totalAbonado,
    saldoPendiente
  }
}
