/**
 * Módulo de administración de vademécum odontológico (F4-03f-4).
 *
 * Contenedor principal con 4 tabs:
 * - Vademécum regular (94 fármacos)
 * - Urgencia / carro reanimación (11 fármacos)
 * - Antirresortivos óseos / MRONJ (6 fármacos)
 * - Metadata de curación clínica
 *
 * Integra con:
 * - useVademecumAdmin (estado y acciones CRUD)
 * - useRBAC (control de acceso por rol)
 * - 3 modales de edición con validación Zod
 *
 * Acceso restringido a ADMIN y DENTISTA vía permiso ADMINISTRAR_VADEMECUM.
 */
import React, { useState, useCallback } from 'react'
import { useRBAC } from '../../../shared/hooks/useRBAC'
import { PERMISOS } from '../../../constants/rbacConstants'
import { useVademecumAdmin } from './hooks/useVademecumAdmin'
import { TablaVademecum } from './components/TablaVademecum'
import { TablaUrgencia } from './components/TablaUrgencia'
import { TablaAntirresortivos } from './components/TablaAntirresortivos'
import { MetadataCuracion } from './components/MetadataCuracion'
import { ModalEditarFarmaco } from './components/ModalEditarFarmaco'
import { ModalEditarUrgencia } from './components/ModalEditarUrgencia'
import { ModalEditarAntirresortivo } from './components/ModalEditarAntirresortivo'
import { AdminProtocolosContenido } from './components/AdminProtocolosContenido'
import type { FarmacoVademecum, FarmacoInput } from '../../../infrastructure/clinical-data/vademecumService'
import type { FarmacoUrgencia, Antirresortivo } from './schemas/vademecumSchema'
import { createLogger } from '../../../infrastructure/logging/logger'
import { Lock, Pill, RefreshCw } from 'lucide-react'
import { Button } from '../../../shared/ui/ui/Button'
import { PageHeader } from '../../../shared/ui/ui/PageHeader'

const log = createLogger('AdminVademecumModulo')

interface TabConfig {
  id: string
  nombre: string
  descripcion: string
}

const TABS: TabConfig[] = [
  { id: 'vademecum', nombre: 'Vademécum', descripcion: '94 fármacos regulares' },
  { id: 'urgencia', nombre: 'Urgencia', descripcion: 'Carro de reanimación' },
  { id: 'antirresortivos', nombre: 'Antirresortivos', descripcion: 'Riesgo MRONJ' },
  { id: 'alergias', nombre: 'Alergias Cruzadas', descripcion: 'Matriz de reactividad' },
  { id: 'interacciones', nombre: 'Interacciones', descripcion: 'Farmacológicas' },
  { id: 'profilaxis', nombre: 'Profilaxis', descripcion: 'Endocarditis AHA' },
  { id: 'anticoagulantes', nombre: 'Anticoagulantes', descripcion: 'Manejo perioperatorio' },
  { id: 'metadata', nombre: 'Metadata', descripcion: 'Info de curación' }
]

interface ModalFarmacoState {
  abierto: boolean
  farmaco: FarmacoVademecum | null
}

interface ModalUrgenciaState {
  abierto: boolean
  farmaco: FarmacoUrgencia | null
}

interface ModalAntirresortivoState {
  abierto: boolean
  farmaco: Antirresortivo | null
}

export const AdminVademecumModulo: React.FC = () => {
  const { puede } = useRBAC()
  const admin = useVademecumAdmin()
  const [tabActivo, setTabActivo] = useState<string>('vademecum')

  const [modalFarmaco, setModalFarmaco] = useState<ModalFarmacoState>({ abierto: false, farmaco: null })
  const [modalUrgencia, setModalUrgencia] = useState<ModalUrgenciaState>({ abierto: false, farmaco: null })
  const [modalAntirresortivo, setModalAntirresortivo] = useState<ModalAntirresortivoState>({ abierto: false, farmaco: null })
  const [guardando, setGuardando] = useState<boolean>(false)

  // Handlers vademécum regular
  const handleCrearFarmaco = (): void => setModalFarmaco({ abierto: true, farmaco: null })
  const handleEditarFarmaco = useCallback((farmaco: FarmacoVademecum): void => {
    setModalFarmaco({ abierto: true, farmaco })
  }, [])

  const handleGuardarFarmaco = useCallback(async (datos: FarmacoInput): Promise<void> => {
    setGuardando(true)
    try {
      await admin.crearOFarmacoActualizar(datos)
      setModalFarmaco({ abierto: false, farmaco: null })
    } finally {
      setGuardando(false)
    }
  }, [admin])

  const handleDesactivarFarmaco = async (farmaco: FarmacoVademecum): Promise<void> => {
    if (farmaco.numero !== undefined) {
      await admin.desactivar(farmaco.numero)
    }
  }

  const handleReactivarFarmaco = async (farmaco: FarmacoVademecum): Promise<void> => {
    if (farmaco.numero !== undefined) {
      await admin.reactivar(farmaco.numero)
    }
  }

  // Handlers urgencia
  const handleCrearUrgencia = (): void => setModalUrgencia({ abierto: true, farmaco: null })
  const handleEditarUrgencia = useCallback((farmaco: FarmacoUrgencia): void => {
    setModalUrgencia({ abierto: true, farmaco })
  }, [])

  const handleGuardarUrgencia = useCallback(async (datos: unknown): Promise<void> => {
    setGuardando(true)
    try {
      log.info('Guardar urgencia:', datos)
      setModalUrgencia({ abierto: false, farmaco: null })
    } finally {
      setGuardando(false)
    }
  }, [])

  // Handlers antirresortivos
  const handleCrearAntirresortivo = (): void => setModalAntirresortivo({ abierto: true, farmaco: null })
  const handleEditarAntirresortivo = useCallback((farmaco: Antirresortivo): void => {
    setModalAntirresortivo({ abierto: true, farmaco })
  }, [])

  const handleGuardarAntirresortivo = useCallback(async (datos: unknown): Promise<void> => {
    setGuardando(true)
    try {
      log.info('Guardar antirresortivo:', datos)
      setModalAntirresortivo({ abierto: false, farmaco: null })
    } finally {
      setGuardando(false)
    }
  }, [])

  // Validación de acceso
  if (!puede(PERMISOS.ADMINISTRAR_VADEMECUM)) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <Lock size={48} className="mx-auto mb-4 text-graphite-300" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">Acceso Denegado</h2>
          <p className="text-red-700">
            No tiene permisos para administrar el vademécum.
            Contacte al administrador del sistema si necesita acceso.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={Pill}
        title="Vademécum odontológico"
        description="Referencia clínica curada. Los cambios se sincronizan entre los dispositivos de la clínica."
        actions={
          <Button
            onClick={() => void admin.refrescar()}
            disabled={admin.cargando}
            variant="secondary"
            size="sm"
            icon={RefreshCw}
          >
            Refrescar
          </Button>
        }
      />

      {/* Tabs de navegación */}
      <div className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-xl overflow-hidden">
        <div
          className="scrollable-tab-strip flex border-b border-gray-200 dark:border-graphite-700 bg-gray-50 dark:bg-graphite-800 overflow-x-auto"
          role="group"
          aria-label="Secciones del vademécum"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabActivo(tab.id)}
              aria-pressed={tabActivo === tab.id}
              className={`px-6 py-3 text-sm font-semibold transition-colors duration-150 border-b-2 whitespace-nowrap ${
                tabActivo === tab.id
                  ? 'border-primary text-graphite-900 bg-white dark:bg-graphite-800 dark:text-gold-satin'
                  : 'border-transparent text-graphite-600 dark:text-graphite-400 hover:bg-graphite-100 dark:hover:bg-graphite-700'
              }`}
            >
              <div>{tab.nombre}</div>
              <div className="text-xs text-gray-500 dark:text-graphite-400 mt-0.5">{tab.descripcion}</div>
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-6">
          {admin.cargando && (
            <div className="text-center py-8 text-gray-500 dark:text-graphite-400">
              Cargando datos...
            </div>
          )}
          {admin.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
              Error: {admin.error}
            </div>
          )}

          {!admin.cargando && tabActivo === 'vademecum' && (
            <TablaVademecum
              vademecum={admin.vademecum}
              vademecumCompleto={admin.vademecumCompleto}
              familiasDisponibles={admin.familiasDisponibles}
              familiaSeleccionada={admin.familiaSeleccionada}
              setFamiliaSeleccionada={admin.setFamiliaSeleccionada}
              textoBusqueda={admin.textoBusqueda}
              setTextoBusqueda={admin.setTextoBusqueda}
              soloActivos={admin.soloActivos}
              setSoloActivos={admin.setSoloActivos}
              onCrearNuevo={handleCrearFarmaco}
              onEditar={handleEditarFarmaco}
              onDesactivar={handleDesactivarFarmaco}
              onReactivar={handleReactivarFarmaco}
            />
          )}

          {!admin.cargando && tabActivo === 'urgencia' && (
            <TablaUrgencia
              urgencia={admin.urgencia}
              onEditar={handleEditarUrgencia}
              onCrearNuevo={handleCrearUrgencia}
            />
          )}

          {!admin.cargando && tabActivo === 'antirresortivos' && (
            <TablaAntirresortivos
              antirresortivos={admin.antirresortivos}
              onEditar={handleEditarAntirresortivo}
              onCrearNuevo={handleCrearAntirresortivo}
            />
          )}

          {/* Tabs de protocolos clínicos (F4-03f-5d) */}
          {!admin.cargando &&
            ['alergias', 'interacciones', 'profilaxis', 'anticoagulantes'].includes(tabActivo) && (
              <AdminProtocolosContenido
                admin={admin}
                tabActivo={tabActivo}
                guardando={guardando}
                setGuardando={setGuardando}
              />
            )}

          {!admin.cargando && tabActivo === 'metadata' && (
            <MetadataCuracion metadata={admin.metadata} />
          )}
        </div>
      </div>

      {/* Modales */}
      {modalFarmaco.abierto && (
        <ModalEditarFarmaco
          farmaco={modalFarmaco.farmaco}
          onGuardar={handleGuardarFarmaco}
          onClose={() => setModalFarmaco({ abierto: false, farmaco: null })}
          guardando={guardando}
        />
      )}
      {modalUrgencia.abierto && (
        <ModalEditarUrgencia
          farmaco={modalUrgencia.farmaco}
          onGuardar={handleGuardarUrgencia}
          onClose={() => setModalUrgencia({ abierto: false, farmaco: null })}
          guardando={guardando}
        />
      )}
      {modalAntirresortivo.abierto && (
        <ModalEditarAntirresortivo
          farmaco={modalAntirresortivo.farmaco}
          onGuardar={handleGuardarAntirresortivo}
          onClose={() => setModalAntirresortivo({ abierto: false, farmaco: null })}
          guardando={guardando}
        />
      )}
    </div>
  )
}
export default AdminVademecumModulo
