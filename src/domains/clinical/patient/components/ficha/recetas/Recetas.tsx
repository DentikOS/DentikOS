import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FileCheck } from 'lucide-react'
import { Button } from '../../../../../../shared/ui/ui/Button'
import { RecetasEmitidasLista, type RecetaEmitidaItem } from './RecetasEmitidasLista'
import { recetasPDFService } from '../../../services/recetasPDFService'
import { VisorPDF } from '../shared/VisorPDF'
import { ModalConfirmarDescargaPDF } from '../shared/ModalConfirmarDescargaPDF'
import { RecetaMedicamentosForm, type MedicamentoCatalogo, type MedicamentoItem } from './RecetaMedicamentosForm'
import { validarAlergiasMedicamentos } from '../../../services/validacionesCruzadasClinicas'
import { sonarAlerta220Hz } from '../../../utils/alertaSonido'
import type { Paciente } from '../../../schemas/pacienteSchema'
import { useClinicaDocumento } from '../../../../../organization/clinic/hooks/useClinicaDocumento'
import { vademecumService, type FarmacoVademecum } from '../../../../../../infrastructure/clinical-data/vademecumService'
import { REALTIME_EVENTS } from '../../../../../../infrastructure/realtime/realtimeEvents'
import { recetasCanonicasStorageService, type NuevaRecetaCanonica } from '../../../services/recetasCanonicasStorageService'
import { generarHashReceta } from '../../../services/recetaHash'

interface RecetasProps { paciente: Paciente; profesional?: string | null }

const mapearCatalogoMedicamentos = (farmacos: FarmacoVademecum[]): MedicamentoCatalogo[] =>
  farmacos.map((farmaco) => ({
    id: typeof farmaco.id === 'string' || typeof farmaco.id === 'number' ? farmaco.id : farmaco.numero,
    nombre: farmaco.nombre_generico,
    nombreComercial: farmaco.nombre_comercial || undefined,
    presentacion: farmaco.presentacion || undefined,
    familia: farmaco.familia,
  }))

const fechaLocalISO = (): string => {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

const mapearRecetaEmitida = (row: Awaited<ReturnType<typeof recetasCanonicasStorageService.guardar>>): RecetaEmitidaItem => ({
  id: row.id,
  fecha: row.fecha,
  profesional: row.profesional,
  medicamentos: row.medicamentos,
  diagnostico: row.diagnostico,
  indicaciones: row.indicaciones,
  firma: row.firma,
  hashForense: row.hash_forense,
  qrToken: row.qr_token,
})

const recetaInicial: MedicamentoItem = { nombre: '', dosis: '', frecuencia: '', duracion: '' }

export const Recetas: React.FC<RecetasProps> = ({ paciente, profesional }) => {
  const clinicaDocumento = useClinicaDocumento()
  const pacienteId = String(paciente.id || '')
  const profesionalActual = profesional?.trim() || ''
  const [medicamentos, setMedicamentos] = useState<MedicamentoItem[]>([{ ...recetaInicial }])
  const [catalogo, setCatalogo] = useState<MedicamentoCatalogo[]>(() => mapearCatalogoMedicamentos(vademecumService.obtenerVademecum()))
  const [indicaciones, setIndicaciones] = useState('')
  const [recetas, setRecetas] = useState<RecetaEmitidaItem[]>([])
  const [cargandoRecetas, setCargandoRecetas] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorEmision, setErrorEmision] = useState<string | null>(null)
  const [recetaParaVer, setRecetaParaVer] = useState<RecetaEmitidaItem | null>(null)
  const [recetaRecienEmitida, setRecetaRecienEmitida] = useState<RecetaEmitidaItem | null>(null)
  const [recetaPendiente, setRecetaPendiente] = useState<NuevaRecetaCanonica | null>(null)
  const [emitiendo, setEmitiendo] = useState(false)
  const [sugerencias, setSugerencias] = useState<{ idx: number; items: MedicamentoCatalogo[] } | null>(null)

  const cargarRecetas = useCallback(async () => {
    if (!pacienteId) {
      setRecetas([])
      setErrorCarga('No se pudo identificar al paciente para consultar sus recetas.')
      setCargandoRecetas(false)
      return
    }

    setCargandoRecetas(true)
    try {
      const rows = await recetasCanonicasStorageService.listar(pacienteId)
      setRecetas(rows.map(mapearRecetaEmitida))
      setErrorCarga(null)
    } catch {
      setRecetas([])
      setErrorCarga('No se pudieron cargar las recetas sincronizadas. Verifica la conexión con Supabase.')
    } finally {
      setCargandoRecetas(false)
    }
  }, [pacienteId])

  useEffect(() => {
    void cargarRecetas()
  }, [cargarRecetas])

  useEffect(() => {
    const actualizarCatalogo = () => setCatalogo(mapearCatalogoMedicamentos(vademecumService.obtenerVademecum()))
    window.addEventListener(REALTIME_EVENTS.VADEMECUM_CHANGED, actualizarCatalogo)
    return () => window.removeEventListener(REALTIME_EVENTS.VADEMECUM_CHANGED, actualizarCatalogo)
  }, [])

  useEffect(() => {
    const actualizarRecetas = (event: Event) => {
      const detail = (event as CustomEvent<{ new?: { paciente_id?: string }; old?: { paciente_id?: string } }>).detail
      const pacienteAfectado = detail?.new?.paciente_id || detail?.old?.paciente_id
      if (pacienteAfectado && pacienteAfectado !== pacienteId) return
      void cargarRecetas()
    }
    window.addEventListener(REALTIME_EVENTS.RECETAS_CHANGED, actualizarRecetas)
    return () => window.removeEventListener(REALTIME_EVENTS.RECETAS_CHANGED, actualizarRecetas)
  }, [cargarRecetas, pacienteId])

  const buscarMedicamentos = (query: string, idx: number) => {
    const termino = query.trim().toLocaleLowerCase()
    if (termino.length < 2) { setSugerencias(null); return }
    const meds = catalogo.filter((med) =>
      [med.nombre, med.nombreComercial, med.presentacion, med.familia]
        .some((campo) => campo?.toLocaleLowerCase().includes(termino))
    )
    setSugerencias({ idx, items: meds.slice(0, 5) })
  }

  const seleccionarMedicamento = (idx: number, med: MedicamentoCatalogo) => {
    handleUpdateMed(idx, 'nombre', med.nombre)
    setSugerencias(null)
  }

  const validacionAlergia = validarAlergiasMedicamentos(
    medicamentos.map((m) => m.nombre).filter(Boolean),
    paciente.alergiasSeveras?.length ? paciente.alergiasSeveras : (paciente.alergias as any)
  )
  const hayConflictoFarmaco = validacionAlergia.contraindicado

  useEffect(() => {
    if (hayConflictoFarmaco) sonarAlerta220Hz()
  }, [hayConflictoFarmaco])

  const handleAgregarMedicamento = () => setMedicamentos((prev) => [...prev, { ...recetaInicial }])
  const handleUpdateMed = (index: number, campo: keyof MedicamentoItem, valor: string) => {
    setMedicamentos((prev) => prev.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)))
  }
  const handleEliminarMed = (index: number) => setMedicamentos((prev) => prev.filter((_, i) => i !== index))

  const handleEmitirReceta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (emitiendo) return

    if (hayConflictoFarmaco) {
      sonarAlerta220Hz()
      window.alert(validacionAlergia.mensaje || 'No se puede emitir la receta por una alergia registrada.')
      return
    }
    if (medicamentos.length === 0 || medicamentos.some((med) =>
      !med.nombre.trim() || !med.dosis.trim() || !med.frecuencia.trim() || !med.duracion.trim()
    )) {
      setErrorEmision('Completa medicamento, dosis, frecuencia y duración para cada fármaco antes de emitir.')
      return
    }
    if (!profesionalActual) {
      setErrorEmision('No se pudo identificar al profesional. Completa el perfil antes de emitir la receta.')
      return
    }

    setEmitiendo(true)
    setErrorEmision(null)
    try {
      let solicitud = recetaPendiente
      if (!solicitud) {
        if (!globalThis.crypto?.randomUUID) throw new Error('Este dispositivo no puede crear un identificador seguro para la receta.')
        const id = globalThis.crypto.randomUUID()
        const qrToken = globalThis.crypto.randomUUID()
        const contenido = {
          id,
          paciente_id: pacienteId,
          fecha: fechaLocalISO(),
          profesional: profesionalActual,
          medicamentos: medicamentos.map((med) => ({ ...med })),
          diagnostico: null,
          indicaciones: indicaciones.trim() || null,
          qr_token: qrToken,
        }
        const hashForense = await generarHashReceta(contenido)
        solicitud = { ...contenido, firma: null, hash_forense: hashForense }
        setRecetaPendiente(solicitud)
      }

      const filaGuardada = await recetasCanonicasStorageService.guardar(solicitud)
      const recetaGuardada = mapearRecetaEmitida(filaGuardada)
      setRecetas((prev) => [recetaGuardada, ...prev.filter((receta) => receta.id !== recetaGuardada.id)])
      setRecetaRecienEmitida(recetaGuardada)
      setRecetaPendiente(null)
      setMedicamentos([{ ...recetaInicial }])
      setIndicaciones('')
      setSugerencias(null)
    } catch (error) {
      setErrorEmision(error instanceof Error
        ? error.message
        : 'No se pudo confirmar el guardado de la receta en Supabase. No se mostrará como emitida.')
    } finally {
      setEmitiendo(false)
    }
  }

  const descargarPDFReceta = async (receta: RecetaEmitidaItem) => {
    try {
      await recetasPDFService.descargarReceta({
        pacienteNombre: paciente.nombreCompleto || paciente.nombre,
        pacienteRut: paciente.rut,
        profesional: receta.profesional,
        medicamentos: receta.medicamentos,
        indicaciones: receta.indicaciones || '',
        fecha: receta.fecha,
        hashForense: receta.hashForense,
        qrToken: receta.qrToken,
        clinica: clinicaDocumento,
      })
    } catch {
      // Entornos sin soporte de canvas no pueden descargar el PDF.
    }
  }

  const formularioBloqueado = emitiendo || Boolean(recetaPendiente)

  return (
    <div className="space-y-6" data-testid="recetas-bp06">
      {hayConflictoFarmaco && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold animate-pulse" role="alert">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{validacionAlergia.mensaje || 'Alerta: el medicamento puede estar contraindicado por una alergia registrada.'}</span>
        </div>
      )}

      {errorCarga && <p className="text-xs text-rose-700 dark:text-rose-300" role="alert">{errorCarga}</p>}

      <form onSubmit={handleEmitirReceta} noValidate className="p-5 bg-surface/90 border border-surface rounded-2xl space-y-4 shadow-xs">
        <RecetaMedicamentosForm
          medicamentos={medicamentos}
          sugerencias={sugerencias}
          onAgregar={handleAgregarMedicamento}
          onEliminar={handleEliminarMed}
          onUpdate={handleUpdateMed}
          onBuscar={buscarMedicamentos}
          onSeleccionarSugerencia={seleccionarMedicamento}
          disabled={formularioBloqueado}
        />

        <div>
          <label htmlFor="receta-indicaciones" className="block text-xs font-semibold mb-1 text-graphite-700 dark:text-graphite-300">
            Indicaciones Adicionales
          </label>
          <textarea
            id="receta-indicaciones"
            rows={2}
            value={indicaciones}
            disabled={formularioBloqueado}
            onChange={(e) => setIndicaciones(e.target.value)}
            className="w-full p-2.5 bg-surface border border-surface rounded-xl text-xs resize-none"
          />
        </div>

        <p className="text-[11px] text-graphite-500" role="note">
          La receta se guarda directamente en Supabase. Este documento no incluye firma electrónica ni QR verificable.
        </p>

        {errorEmision && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300" role="alert">
            <p>{errorEmision}</p>
            {recetaPendiente && (
              <button
                type="button"
                className="mt-2 underline font-semibold"
                onClick={() => { setRecetaPendiente(null); setErrorEmision(null) }}
                disabled={emitiendo}
              >
                Editar los datos y crear un nuevo envío
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-graphite-400 flex items-center gap-1">
            <FileCheck className="w-3.5 h-3.5 text-emerald-500" /> Guardado remoto confirmado antes de mostrar éxito
          </span>
          <Button type="submit" variant="primary" icon={FileCheck} loading={emitiendo}>
            {recetaPendiente ? 'Reintentar guardado' : 'Emitir receta'}
          </Button>
        </div>
      </form>

      {cargandoRecetas && <p className="text-xs text-graphite-400" role="status">Cargando recetas sincronizadas…</p>}
      {!cargandoRecetas && !errorCarga && <RecetasEmitidasLista recetas={recetas} onVerReceta={setRecetaParaVer} />}

      {recetaParaVer && (
        <VisorPDF
          titulo="Receta médica"
          pacienteNombre={paciente.nombreCompleto || paciente.nombre}
          profesional={recetaParaVer.profesional}
          fecha={new Date(`${recetaParaVer.fecha}T12:00:00`).toLocaleDateString('es-CL')}
          hashForense={recetaParaVer.hashForense}
          contenidoTexto={recetaParaVer.medicamentos.map((m) => `• ${m.nombre} (${m.dosis})`).join('\n')}
          onCerrar={() => setRecetaParaVer(null)}
          onDescargar={() => descargarPDFReceta(recetaParaVer)}
        />
      )}

      {recetaRecienEmitida && (
        <ModalConfirmarDescargaPDF
          isOpen={Boolean(recetaRecienEmitida)}
          titulo="Receta guardada en Supabase"
          onDescargar={() => {
            void descargarPDFReceta(recetaRecienEmitida)
            setRecetaRecienEmitida(null)
          }}
          onVerLista={() => setRecetaRecienEmitida(null)}
          onCerrar={() => setRecetaRecienEmitida(null)}
        />
      )}
    </div>
  )
}
