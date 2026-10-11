import React, { useState, useEffect } from 'react'
import { Sparkles, Save, RotateCcw, Check } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { OdontogramaPieza, type CaraDental } from './OdontogramaPieza'
import { OdontogramaPanel } from './OdontogramaPanel'
import { OdontogramaPanelLateral } from './OdontogramaPanelLateral'
import { OdontogramaSlider } from './OdontogramaSlider'
import { fichasClinicasStorageService } from '../../../services/fichasClinicasStorageService'
import { useOdontogramaStore } from '../../../../../../app/stores/odontogramaStore'

const PERM_SUP_DER = ['1.8', '1.7', '1.6', '1.5', '1.4', '1.3', '1.2', '1.1']
const PERM_SUP_IZQ = ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8']
const PERM_INF_DER = ['4.8', '4.7', '4.6', '4.5', '4.4', '4.3', '4.2', '4.1']
const PERM_INF_IZQ = ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8']

const TEMP_SUP_DER = ['5.5', '5.4', '5.3', '5.2', '5.1']
const TEMP_SUP_IZQ = ['6.1', '6.2', '6.3', '6.4', '6.5']
const TEMP_INF_DER = ['8.5', '8.4', '8.3', '8.2', '8.1']
const TEMP_INF_IZQ = ['7.1', '7.2', '7.3', '7.4', '7.5']

interface OdontogramaProps {
  pacienteId?: string
  onGuardar?: (datos: Record<string, unknown>) => void
}

export const Odontograma: React.FC<OdontogramaProps> = ({ pacienteId, onGuardar }) => {
  const [estadoActivo, setEstadoActivo] = useState<string>('caries')
  const [modoVista, setModoVista] = useState<'inicial' | 'evolucion' | 'comparativo'>('evolucion')
  const [progresoTemporal, setProgresoTemporal] = useState<number>(100)
  const [mostrarTemporales, setMostrarTemporales] = useState<boolean>(false)
  const [guardado, setGuardado] = useState<boolean>(false)

  const [piezaSeleccionada, setPiezaSeleccionada] = useState<string | null>(null)
  const [panelAbierto, setPanelAbierto] = useState<boolean>(false)

  // Estado de las caras de cada pieza
  const [piezasData, setPiezasData] = useState<
    Record<string, { caras: Record<CaraDental, string>; estadoGeneral?: string }>
  >({})

  useEffect(() => {
    if (!pacienteId) return
    fichasClinicasStorageService.obtenerFichaClinica(pacienteId).then((ficha) => {
      if (ficha?.odontograma && typeof ficha.odontograma === 'object') {
        const od = ficha.odontograma as { piezasData?: Record<string, any> }
        if (od.piezasData) {
          setPiezasData(od.piezasData)
        }
      }
    })
  }, [pacienteId])

  const handleSeleccionarCara = (pieza: string | number, cara: CaraDental) => {
    const key = String(pieza)
    setPiezasData((prev) => {
      const actual = prev[key] || {
        caras: { vestibular: 'sano', lingual: 'sano', mesial: 'sano', distal: 'sano', oclusal: 'sano' },
      }
      return {
        ...prev,
        [key]: {
          ...actual,
          caras: { ...actual.caras, [cara]: estadoActivo },
        },
      }
    })
  }

  const handlePiezaClick = (pieza: string | number) => {
    setPiezaSeleccionada(String(pieza))
    setPanelAbierto(true)
  }

  const handleSeleccionarPieza = handlePiezaClick

  const handleLimpiar = () => {
    if (window.confirm('¿Deseas reiniciar el odontograma a estado sano?')) {
      setPiezasData({})
    }
  }

  const renderFilaPiezas = (piezasDer: string[], piezasIzq: string[], esTemp = false) => (
    <div className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto py-1">
      <div className="flex items-center gap-0.5">
        {piezasDer.map((num) => (
          <OdontogramaPieza
            key={num}
            numero={num}
            esTemporal={esTemp}
            caras={
              piezasData[num]?.caras || {
                vestibular: 'sano',
                lingual: 'sano',
                mesial: 'sano',
                distal: 'sano',
                oclusal: 'sano',
              }
            }
            estadoGeneral={piezasData[num]?.estadoGeneral}
            onClick={handlePiezaClick}
            onSeleccionarCara={handleSeleccionarCara}
            onSeleccionarPieza={handleSeleccionarPieza}
          />
        ))}
      </div>
      <div className="w-px h-12 bg-graphite-300 dark:bg-graphite-700 mx-1" />
      <div className="flex items-center gap-0.5">
        {piezasIzq.map((num) => (
          <OdontogramaPieza
            key={num}
            numero={num}
            esTemporal={esTemp}
            caras={
              piezasData[num]?.caras || {
                vestibular: 'sano',
                lingual: 'sano',
                mesial: 'sano',
                distal: 'sano',
                oclusal: 'sano',
              }
            }
            estadoGeneral={piezasData[num]?.estadoGeneral}
            onClick={handlePiezaClick}
            onSeleccionarCara={handleSeleccionarCara}
            onSeleccionarPieza={handleSeleccionarPieza}
          />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-4" data-testid="odontograma-completo-bp06">
      {/* Slider Temporal */}
      <OdontogramaSlider
        modoVista={modoVista}
        onCambiarModo={setModoVista}
        progresoTemporal={progresoTemporal}
        onProgresoChange={setProgresoTemporal}
      />

      {/* Controles de Vista Dental */}
      <div className="flex items-center justify-between gap-3 px-1 text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-medium text-graphite-700 dark:text-graphite-300">
          <input
            type="checkbox"
            checked={mostrarTemporales}
            onChange={(e) => setMostrarTemporales(e.target.checked)}
            className="w-4 h-4 rounded text-primary focus:ring-primary"
          />
          Mostrar Dentición Temporal (20 piezas)
        </label>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" icon={RotateCcw} onClick={handleLimpiar}>
            Reiniciar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={guardado ? Check : Save}
            onClick={async () => {
              if (pacienteId) {
                await fichasClinicasStorageService.guardarSeccionFicha(pacienteId, 'odontograma', {
                  piezasData,
                  modoVista,
                  actualizadoAt: new Date().toISOString(),
                })
              }
              const piezasLista = Object.entries(piezasData).map(([numero, data]) => ({
                numero,
                estado: data.estadoGeneral ? 'patologia' : Object.values(data.caras).some((c) => c !== 'sano') ? 'patologia' : 'sano',
                tipoPatologia: data.estadoGeneral || Object.values(data.caras).find((c) => c !== 'sano') || 'sano',
              }))
              useOdontogramaStore.getState().setOdontograma({ piezas: piezasLista })
              onGuardar?.(piezasData)
              setGuardado(true)
              setTimeout(() => setGuardado(false), 2000)
            }}
          >
            {guardado ? 'Guardado en Supabase' : 'Guardar Odontograma'}
          </Button>
        </div>
      </div>

      {/* Cuadrantes Dentales (32 Permanentes + 20 Temporales) */}
      <div className="p-4 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs">
        {/* Arcada Superior */}
        <div>
          <p className="text-[11px] font-bold text-center text-graphite-400 uppercase tracking-wider mb-1">
            Arcada Superior Maxilar
          </p>
          {renderFilaPiezas(PERM_SUP_DER, PERM_SUP_IZQ)}
          {mostrarTemporales && renderFilaPiezas(TEMP_SUP_DER, TEMP_SUP_IZQ, true)}
        </div>

        <div className="border-t border-surface" />

        {/* Arcada Inferior */}
        <div>
          {mostrarTemporales && renderFilaPiezas(TEMP_INF_DER, TEMP_INF_IZQ, true)}
          {renderFilaPiezas(PERM_INF_DER, PERM_INF_IZQ)}
          <p className="text-[11px] font-bold text-center text-graphite-400 uppercase tracking-wider mt-1">
            Arcada Inferior Mandibular
          </p>
        </div>
      </div>

      {/* Panel Lateral de Pieza con 5 Caras */}
      <OdontogramaPanelLateral
        pieza={piezaSeleccionada}
        piezaId={piezaSeleccionada}
        abierto={panelAbierto}
        datos={piezaSeleccionada ? piezasData[piezaSeleccionada] : undefined}
        onCerrar={() => {
          setPanelAbierto(false)
          setPiezaSeleccionada(null)
        }}
        onGuardar={(datosPieza) => {
          if (!piezaSeleccionada) return
          setPiezasData((prev) => ({ ...prev, [piezaSeleccionada]: datosPieza }))
        }}
        onActualizarCara={(cara, estado) => {
          if (!piezaSeleccionada) return
          setPiezasData((prev) => {
            const act = prev[piezaSeleccionada] || { caras: { vestibular: 'sano', lingual: 'sano', mesial: 'sano', distal: 'sano', oclusal: 'sano' } }
            return { ...prev, [piezaSeleccionada]: { ...act, caras: { ...act.caras, [cara]: estado } } }
          })
        }}
        onActualizarEstadoGeneral={(estado) => {
          if (!piezaSeleccionada) return
          setPiezasData((prev) => {
            const act = prev[piezaSeleccionada] || { caras: { vestibular: 'sano', lingual: 'sano', mesial: 'sano', distal: 'sano', oclusal: 'sano' } }
            return { ...prev, [piezaSeleccionada]: { ...act, estadoGeneral: estado } }
          })
        }}
      />
    </div>
  )
}
