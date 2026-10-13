import React, { memo, useState, useCallback, useMemo, useEffect } from 'react'
import { Trash2, Loader2, XCircle, Download, Printer, Lock } from 'lucide-react'
import { createPortal } from 'react-dom'
import { certificadosStorageService } from '../services/certificadosStorageService'
import { imprimirCertificadoAislado } from '../services/certificadosPrintService'
import { useDescargaCertificado } from '../hooks/useDescargaCertificado'
import { useAutoRespaldoCertificados } from '../hooks/useAutoRespaldoCertificados'
import { usePapeleraCertificados, type CertificadoPapelera } from '../hooks/usePapeleraCertificados'
import { ModalPapeleraCertificados } from './ModalPapeleraCertificados'
import { FormularioNuevoCertificado } from './FormularioNuevoCertificado'
import { CertificadoImprimible } from './CertificadoImprimible'
import { createLogger } from '../../../../infrastructure/logging/logger'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import type { Paciente } from '../schemas/pacienteSchema'

const log = createLogger('CertificadosSection')

export interface CertificadosSectionProps {
  paciente: Partial<Paciente> & { id: string | number; nombre: string; rut?: string; [key: string]: unknown }
  userProfile?: { nombreCompleto?: string; rut?: string; especialidad?: string; [key: string]: unknown } | null
  certificados?: CertificadoPapelera[]
  setCertificados?: (certificados: CertificadoPapelera[]) => void
}

/**
 * Sección de Certificados Médicos (F6-D-6 refactor, M2c auto-respaldo)
 *
 * Componente padre que renderiza:
 * - FormularioNuevoCertificado
 * - Historial de certificados emitidos (con mini-badge de candado si respaldado)
 * - Preview del certificado seleccionado (con badge grande de estado R2)
 * - Portal de impresión aislada (M2a)
 */
export const CertificadosSection: React.FC<CertificadosSectionProps> = memo(({
  paciente,
  userProfile,
  certificados = [],
  setCertificados: setCertificadosProp = () => {}
}) => {
  // Estabilizar setCertificados para evitar re-renders masivos
  const setCertificados = useCallback((nuevos: CertificadoPapelera[]) => {
    setCertificadosProp(nuevos)
  }, [setCertificadosProp])

  const [certSeleccionadoVer, setCertSeleccionadoVer] = useState<CertificadoPapelera | null>(null)
  
  // Estado local como FUENTE DE VERDAD dentro de este componente
  const [certsLocal, setCertsLocal] = useState<CertificadoPapelera[]>(() => 
    Array.isArray(certificados) ? certificados : []
  )
  
  const { confirm } = useAppDialog()
  
  // Sincronizar con el padre al desmontar (para persistencia)
  useEffect(() => {
    return () => {
      if (Array.isArray(certsLocal) && certsLocal.length > 0) {
        setCertificados(certsLocal)
      }
    }
  }, [certsLocal, setCertificados])

  // useMemo para estabilizar referencia
  const listaCertificados = useMemo(
    () => (Array.isArray(certsLocal) ? certsLocal : []),
    [certsLocal]
  )

  const {
    papeleraAbierta,
    abrirPapelera,
    cerrarPapelera,
    certificadosActivos,
    hayEliminados,
    moverAPapelera,
    restaurar,
    eliminarDefinitivo,
    vaciarPapelera
  } = usePapeleraCertificados(paciente.id, certsLocal, setCertsLocal)

  // Certificados eliminados para el modal (derivado de certsLocal)
  const certificadosEliminados = useMemo(() => {
    const result = Array.isArray(certsLocal) ? certsLocal.filter(c => c.eliminadoAt) : []
    return result
  }, [certsLocal])

  const { generandoPDF, descargarPDF } = useDescargaCertificado(paciente.id, listaCertificados, setCertsLocal)

  const { respaldandoIds, idsConError, reintentarRespaldo } = useAutoRespaldoCertificados(
    listaCertificados,
    paciente.id,
    setCertsLocal
  )

  const handleGenerarCertificado = (nuevoCertificado: CertificadoPapelera): void => {
    const actualizados = [nuevoCertificado, ...listaCertificados]
    setCertsLocal(actualizados)
    certificadosStorageService.guardarCertificados(paciente.id, actualizados).catch(err => log.warn("Error al guardar:", err))
    setCertSeleccionadoVer(nuevoCertificado)
  }

  const handleEliminarCertificado = async (id: string | number): Promise<void> => {
    const ok = await confirm({
      title: 'Mover a papelera',
      description: 'El certificado se moverá a la papelera (se conservará 730 días).',
      variant: 'danger',
      confirmText: 'Mover a papelera'
    })
    if (ok) {
      const movido = await moverAPapelera(id)
      if (movido && certSeleccionadoVer?.id === id) setCertSeleccionadoVer(null)
    }
  }

  const handleVerCertificado = (cert: CertificadoPapelera): void => {
    setCertSeleccionadoVer(cert)
    setTimeout(() => {
      document.getElementById('certificado-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const certAMostrar = certSeleccionadoVer || (certificadosActivos.length > 0 ? certificadosActivos[0] : null)

  const handleDescargarPDF = (): void => {
    if (certAMostrar) {
      descargarPDF(certAMostrar)
    }
  }

  const estadoRespaldo = certAMostrar
    ? respaldandoIds.has(certAMostrar.id)
      ? 'respaldando'
      : certAMostrar.r2ArchivoId
        ? 'respaldado'
        : idsConError.has(certAMostrar.id)
          ? 'error'
          : 'pendiente'
    : null

  return (
    <div className="space-y-6">
      <FormularioNuevoCertificado 
        userProfile={userProfile} 
        onGenerarCertificado={handleGenerarCertificado} 
      />

      {/* Sección Papelera - siempre visible */}
      <div className="bg-white dark:bg-graphite-800 p-3 border border-gray-200 dark:border-graphite-700 rounded-2xl print:hidden flex justify-between items-center">
        <span className="text-xs text-gray-600 dark:text-graphite-400">
          {hayEliminados
            ? 'Hay certificados en papelera'
            : 'Papelera vacía'}
        </span>
        <button
          onClick={abrirPapelera}
          disabled={!hayEliminados}
          className="text-xs bg-gray-100 dark:bg-graphite-800 text-gray-700 dark:text-graphite-300 border border-gray-300 dark:border-graphite-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          title={hayEliminados ? 'Abrir papelera' : 'No hay certificados en papelera'}
        >
          <span className="flex items-center gap-1"><Trash2 size={12} />Papelera</span>
        </button>
      </div>

      {certificadosActivos.length > 0 && (
        <div className="bg-white dark:bg-graphite-800 p-4 border border-gray-200 dark:border-graphite-700 rounded-2xl print:hidden">
          <h4 className="font-bold text-xs text-gray-800 dark:text-graphite-100 mb-3 uppercase tracking-wider">Historial de Certificados Emitidos ({certificadosActivos.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {certificadosActivos.map(c => (
              <div
                key={c.id}
                onClick={() => handleVerCertificado(c)}
                className={`p-3 rounded-xl border text-xs flex justify-between items-center cursor-pointer transition-all ${
                  certAMostrar?.id === c.id ? 'bg-black text-white border-black' : 'bg-gray-50 dark:bg-graphite-800 hover:bg-gray-100 dark:hover:bg-graphite-700 border-gray-200 dark:border-graphite-700 text-gray-800 dark:text-graphite-100'
                }`}
              >
                <div>
                  <span className="font-bold uppercase tracking-wider mr-2">
                    {c.tipo === 'asistencia' ? 'Asistencia' : 'Reposo'}
                  </span>
                  <span>({c.fechaEmision}) — {c.diagnosticoMotivo}</span>
                  {c.r2ArchivoId && <span title="Respaldado en R2"><Lock className="ml-2 text-green-600 inline" size={12} /></span>}
                  {respaldandoIds.has(c.id) && <span title="Respaldando..."><Loader2 className="ml-2 animate-spin inline" size={12} /></span>}
                  {idsConError.has(c.id) && <span title="Error al respaldar"><XCircle className="ml-2 text-red-500 inline" size={12} /></span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleVerCertificado(c); }}
                    className="text-[10px] opacity-75 hover:opacity-100 underline cursor-pointer"
                  >
                    Ver/Imprimir →
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEliminarCertificado(c.id); }}
                    className="text-red-400 hover:text-red-200 font-bold ml-2"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {certAMostrar ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center print:hidden">
            <div className="flex items-center gap-2">
              {estadoRespaldo === 'respaldado' && (
                <span className="text-xs bg-green-100 text-green-800 border border-green-200 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                  <span className="flex items-center gap-1"><Lock size={12} />Respaldado en R2</span>
                </span>
              )}
              {estadoRespaldo === 'respaldando' && (
                <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full font-semibold flex items-center gap-1 animate-pulse">
                  <Loader2 className="animate-spin" size={12} />Respaldando en R2...
                </span>
              )}
              {estadoRespaldo === 'error' && (
                <button
                  onClick={() => reintentarRespaldo(certAMostrar.id)}
                  className="text-xs bg-red-100 text-red-800 border border-red-200 px-3 py-1 rounded-full font-semibold flex items-center gap-1 hover:bg-red-200"
                >
                  <XCircle size={12} />Sin respaldo — Click para reintentar
                </button>
              )}
              {estadoRespaldo === 'pendiente' && (
                <span className="text-xs bg-gray-100 dark:bg-graphite-800 text-gray-600 dark:text-graphite-400 border border-gray-200 dark:border-graphite-700 px-3 py-1 rounded-full font-semibold">
                  Pendiente de respaldo
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDescargarPDF}
                disabled={generandoPDF || estadoRespaldo === 'respaldando'}
                className="bg-gray-100 dark:bg-graphite-800 text-gray-800 dark:text-graphite-100 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-200 border border-gray-300 dark:border-graphite-600 shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {generandoPDF ? <><Loader2 className="animate-spin" size={14} />Generando PDF...</> : <><Download size={14} />Descargar PDF</>}
              </button>
              <button
                onClick={imprimirCertificadoAislado}
                className="bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-800 shadow-sm flex items-center gap-2"
              >
                <span className="flex items-center gap-1"><Printer size={14} />Imprimir Certificado Oficial (Letter)</span>
              </button>
            </div>
          </div>

          <div id="certificado-preview">
            <CertificadoImprimible cert={certAMostrar} paciente={paciente} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-graphite-800 rounded-2xl border border-dashed border-gray-300 dark:border-graphite-600 text-xs text-gray-500 dark:text-graphite-400 print:hidden">
          No hay certificados emitidos para este paciente. Completa el formulario superior para generar uno.
        </div>
      )}

      {certAMostrar && createPortal(
        <div className="certificado-print-portal">
          <CertificadoImprimible cert={certAMostrar} paciente={paciente} />
        </div>,
        document.body
      )}

      {papeleraAbierta && (
        <ModalPapeleraCertificados
          alCerrar={cerrarPapelera}
          certificadosEliminados={certificadosEliminados}
          onRestaurar={restaurar}
          onEliminar={eliminarDefinitivo}
          onVaciar={vaciarPapelera}
        />
      )}
    </div>
  )
})

CertificadosSection.displayName = 'CertificadosSection'
