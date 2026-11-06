import { useState, useCallback } from 'react'
import type React from 'react'
import { bootstrapClinica, invitarMiembro, supabaseSignOut } from '../../infrastructure/auth/authService'
import { sedesService } from '../../domains/organization/clinic/services/sedesService'
import { clinicStorageService } from '../../domains/organization/clinic/services/clinicStorageService'
import { useSesionStore } from '../../app/stores/sesionStore'
import { createLogger } from '../../infrastructure/logging/logger'
import { useBootstrapSedes, crearSedePrincipal } from './useBootstrapSedes'
import { obtenerPlantillaCatalogo, type PlantillaCatalogoId } from '../../domains/organization/prestations/constants/prestacionesPlantillas'
import { prestacionesSupabaseService } from '../../domains/organization/prestations/services/prestacionesSupabaseService'
import { boxesClinicosService } from '../../domains/organization/clinic/services/boxesClinicosService'
import { crearConfiguracionConveniosVacia } from '../../domains/organization/clinic/schemas/configuracionConveniosSchema'
import { crearConfiguracionFinancieraPredeterminada } from '../../domains/organization/clinic/schemas/configuracionFinancieraSchema'
import type { BoxPlantillaBootstrap } from '../types/bootstrapClinica'
import type {
  TipoActividad,
  MiembroInvitacionOnboarding,
  ExtendedBootstrapDatos,
  UseBootstrapClinicaReturn,
} from '../types/bootstrapClinica'

export type { TipoActividad, MiembroInvitacionOnboarding, ExtendedBootstrapDatos, UseBootstrapClinicaReturn }

const log = createLogger('useBootstrapClinica')

const DATOS_INIT: ExtendedBootstrapDatos = {
  nombre: '', rutEmpresa: '', direccion: '', comuna: '', region: '', telefono: '', emailContacto: '',
  giroComercial: 'Servicios odontológicos', zonaHoraria: 'America/Santiago', idiomaDocumentos: 'es-CL', moneda: 'CLP', especialidad: '',
}

const crearBoxesDePlantilla = (id: PlantillaCatalogoId): BoxPlantillaBootstrap[] => {
  const definir = (nombre: string, tipo: BoxPlantillaBootstrap['tipo']): BoxPlantillaBootstrap => ({
    nombre, tipo, unidadDental: 'Unidad dental',
    notas: 'Completa y confirma el equipamiento instalado desde Administración > Sucursales.',
  })
  if (id === 'ortodoncia') return [definir('Box General', 'general'), definir('Box Ortodoncia 1', 'ortodoncia'), definir('Box Ortodoncia 2', 'ortodoncia')]
  if (id === 'cirugia_rehabilitacion') return [definir('Box General', 'general'), definir('Box Cirugía', 'cirugia'), definir('Box Rehabilitación', 'general')]
  return [definir('Box 1', 'general'), definir('Box 2', 'general')]
}

export const useBootstrapClinica = (
  onComplete?: (clinicaId?: string | number) => void
): UseBootstrapClinicaReturn => {
  const [paso, setPaso] = useState<number>(1)
  const [tipoActividad, setTipoActividad] = useState<TipoActividad>('clinica')
  const [datos, setDatos] = useState<ExtendedBootstrapDatos>(DATOS_INIT)
  const { sedes, agregarSede, eliminarSede, asegurarSedePrincipal } = useBootstrapSedes([])
  const [equipo, setEquipo] = useState<MiembroInvitacionOnboarding[]>([])
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<PlantillaCatalogoId | null>(null)
  const [preciosPlantilla, setPreciosPlantilla] = useState<Record<string, string>>({})
  const [boxesPlantilla, setBoxesPlantilla] = useState<BoxPlantillaBootstrap[]>([])
  const [boxesCreados, setBoxesCreados] = useState(0)
  const [catalogoPlantillaAplicado, setCatalogoPlantillaAplicado] = useState(false)
  const [advertenciasConfiguracion, setAdvertenciasConfiguracion] = useState<string[]>([])
  const [errores, setErrores] = useState<Record<string, string | null>>({})
  const [procesando, setProcesando] = useState<boolean>(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [completado, setCompletado] = useState<boolean>(false)
  const [invitacionesCreadas, setInvitacionesCreadas] = useState(0)
  const [invitacionesPendientes, setInvitacionesPendientes] = useState(0)
  const [sucursalesRegistradas, setSucursalesRegistradas] = useState(0)
  const [sucursalesSincronizadas, setSucursalesSincronizadas] = useState(false)
  const [errorSincronizacionSedes, setErrorSincronizacionSedes] = useState<string | null>(null)

  const actualizarCampo = (campo: keyof ExtendedBootstrapDatos, valor: string): void => {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: null }))
    if (campo === 'moneda' && plantillaSeleccionada) {
      const prestaciones = obtenerPlantillaCatalogo(plantillaSeleccionada)
      setPreciosPlantilla(Object.fromEntries(prestaciones.map((item) => [
        item.codigoInterno,
        valor === 'CLP' ? String(item.precioParticular) : '',
      ])))
    }
  }

  const validarPaso = (p: number): boolean => {
    const errs: Record<string, string | null> = {}
    if (p === 1) {
      if (!datos.nombre || datos.nombre.trim().length < 3) errs.nombre = 'Nombre obligatorio (mínimo 3 caracteres)'
      if (!datos.rutEmpresa?.trim()) errs.rutEmpresa = 'RUT de la clínica obligatorio'
      if (!datos.giroComercial?.trim()) errs.giroComercial = 'Giro comercial obligatorio'
      if (!datos.direccion || datos.direccion.trim().length < 3) errs.direccion = 'Dirección obligatoria'
      if (!datos.comuna?.trim()) errs.comuna = 'Comuna obligatoria'
      if (!datos.region?.trim()) errs.region = 'Región obligatoria'
      if (!datos.telefono?.trim()) errs.telefono = 'Teléfono obligatorio'
      if (!datos.emailContacto?.trim() || !/^\S+@\S+\.\S+$/.test(datos.emailContacto.trim())) errs.emailContacto = 'Ingresa un email válido'
    }
    if (p === 3 && sedes.length === 0) asegurarSedePrincipal(datos)
    if (p === 6 && plantillaSeleccionada) {
      for (const prestacion of obtenerPlantillaCatalogo(plantillaSeleccionada)) {
        const precioTexto = preciosPlantilla[prestacion.codigoInterno]?.trim() ?? ''
        const precio = Number(precioTexto)
        if (!precioTexto || !Number.isSafeInteger(precio) || precio < 0 || precio > 2147483647) {
          errs.preciosPlantilla = 'Revisa todos los precios particulares; cada prestación necesita un valor entero no negativo en la moneda de la clínica.'
          break
        }
      }
    }
    if (p === 4 && boxesPlantilla.length > 0) {
      const nombres = boxesPlantilla.map((box) => box.nombre.trim().toLocaleLowerCase('es-CL'))
      if (nombres.some((nombre) => nombre.length < 2)) {
        errs.boxesPlantilla = 'Cada box necesita un nombre de al menos 2 caracteres.'
      } else if (new Set(nombres).size !== nombres.length) {
        errs.boxesPlantilla = 'Los nombres de los boxes deben ser distintos dentro de la sucursal.'
      }
    }
    setErrores(errs)
    return Object.keys(errs).length === 0
  }

  const avanzarPaso = (): void => {
    if (validarPaso(paso)) {
      if (paso === 3 && sedes.length === 0) asegurarSedePrincipal(datos)
      setPaso((prev) => Math.min(prev + 1, 7))
      setErrorGeneral(null)
    }
  }

  const retrocederPaso = (): void => {
    if (paso > 1) {
      setPaso((prev) => prev - 1)
      setErrorGeneral(null)
    }
  }

  const cancelarConfiguracion = async (): Promise<void> => {
    try {
      await supabaseSignOut()
    } catch (e: unknown) {
      log.warn('Error al cerrar sesión durante cancelación:', e)
    }
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload()
    }
  }

  const agregarMiembro = (m: MiembroInvitacionOnboarding) => setEquipo((prev) => [...prev, m])
  const eliminarMiembro = (idx: number) => setEquipo((prev) => prev.filter((_, i) => i !== idx))

  const seleccionarPlantilla = (id: PlantillaCatalogoId | null): void => {
    setPlantillaSeleccionada(id)
    if (!id) {
      setPreciosPlantilla({})
      setBoxesPlantilla([])
      return
    }
    const prestaciones = obtenerPlantillaCatalogo(id)
    const moneda = datos.moneda || 'CLP'
    setPreciosPlantilla(Object.fromEntries(prestaciones.map((item) => [
      item.codigoInterno,
      moneda === 'CLP' ? String(item.precioParticular) : '',
    ])))
    setBoxesPlantilla(crearBoxesDePlantilla(id))
  }

  const actualizarPrecioPlantilla = (codigo: string, valor: string): void => {
    setPreciosPlantilla((actual) => ({ ...actual, [codigo]: valor }))
    setErrores((actual) => ({ ...actual, preciosPlantilla: null }))
  }

  const actualizarNombreBoxPlantilla = (index: number, nombre: string): void => {
    setBoxesPlantilla((actual) => actual.map((box, i) => i === index ? { ...box, nombre } : box))
    setErrores((actual) => ({ ...actual, boxesPlantilla: null }))
  }

  const handleSubmit = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault()
    setProcesando(true)
    setErrorGeneral(null)
    const advertencias: string[] = []
    try {
      const res = await bootstrapClinica(datos)
      if (!res.success) {
        setErrorGeneral(res.error || 'Error al crear la clínica')
        setProcesando(false)
        return
      }
      const clinicaId = res.clinicaId as string | undefined
      if (clinicaId) {
        await clinicStorageService.sincronizarClinicaDesdeSupabase(clinicaId)
      }
      useSesionStore.getState().actualizarPerfil({ clinicaId, rol: 'admin' })
      if (clinicaId) {
        const clinicaGuardada = await clinicStorageService.guardarClinicaCompleta(clinicaId, {
          nombreClinica: datos.nombre.trim(), razonSocial: datos.nombre.trim(), rutClinica: datos.rutEmpresa?.trim(),
          giroComercial: datos.giroComercial?.trim(), direccion: datos.direccion?.trim(), comuna: datos.comuna?.trim(),
          region: datos.region?.trim(), telefono: datos.telefono?.trim(), emailContacto: datos.emailContacto?.trim(),
          zonaHoraria: datos.zonaHoraria || 'America/Santiago', idiomaDocumentos: datos.idiomaDocumentos || 'es-CL',
          moneda: datos.moneda || 'CLP',
        })
        if (!clinicaGuardada) advertencias.push('No se pudieron sincronizar todos los datos y preferencias de la clínica.')

        const clinicaActual = clinicStorageService.obtenerClinica()
        const convenios = await clinicStorageService.guardarConfiguracionConvenios(
          clinicaId,
          clinicaActual?.configuracionConvenios || crearConfiguracionConveniosVacia(),
        )
        if (!convenios) advertencias.push('La configuración de convenios quedó pendiente; podrás guardarla desde Administración > Convenios.')

        const financiera = await clinicStorageService.guardarConfiguracionFinanciera(
          clinicaId,
          clinicaActual?.configuracionFinanciera || crearConfiguracionFinancieraPredeterminada(),
        )
        if (!financiera) advertencias.push('La configuración financiera inicial quedó pendiente; podrás revisarla en Administración.')
      }
      if (typeof window !== 'undefined') {
        const nombreReal = clinicStorageService.obtenerClinica()?.nombreClinica || datos.nombre.trim()
        window.dispatchEvent(new CustomEvent('clinica_actualizada', { detail: { nombre: nombreReal } }))
      }

      const sedesAGuardar = sedes.length > 0 ? sedes : [crearSedePrincipal(datos)]
      const copiaLocalGuardada = sedesService.guardarSedes(sedesAGuardar)
      setSucursalesRegistradas(sedesAGuardar.length)
      setSucursalesSincronizadas(false)
      setErrorSincronizacionSedes(null)
      try {
        if (!copiaLocalGuardada) throw new Error('No se pudo guardar la sucursal en este dispositivo.')
        const sedesConfirmadas = await sedesService.sincronizarSedesDesdeSupabase(clinicaId)
        if (sedesConfirmadas.length < sedesAGuardar.length) {
          throw new Error('La nube no confirmó todas las sucursales configuradas.')
        }
        const sedeParaGestion = sedesConfirmadas.find((sede) => sede.esPrincipal && sede.estado === 'activa')
          || sedesConfirmadas.find((sede) => sede.estado === 'activa')
        if (!sedeParaGestion?.id) throw new Error('No se encontró una sucursal activa para iniciar la agenda.')
        sedesService.establecerSedeActiva(sedeParaGestion.id)
        setSucursalesRegistradas(sedesConfirmadas.length)
        setSucursalesSincronizadas(true)
        if (sedeParaGestion?.id && plantillaSeleccionada) {
          let creados = 0
          for (const box of boxesPlantilla) {
            try {
              await boxesClinicosService.crear(sedeParaGestion.id, { ...box, estado: 'activo', equipamiento: [] })
              creados += 1
            } catch {
              advertencias.push(`No se pudo crear el box “${box.nombre}”. Revisa los boxes desde Administración > Sucursales.`)
            }
          }
          setBoxesCreados(creados)
        }
      } catch (cause) {
        setErrorSincronizacionSedes(cause instanceof Error
          ? cause.message
          : 'No se pudieron sincronizar las sucursales de la clínica.')
      }

      if (clinicaId && plantillaSeleccionada) {
        try {
          const prestaciones = obtenerPlantillaCatalogo(plantillaSeleccionada).map((item) => ({
            ...item,
            precioParticular: Number(preciosPlantilla[item.codigoInterno]),
            precioFonasa: null,
          }))
          await prestacionesSupabaseService.importarPlantilla(plantillaSeleccionada, prestaciones)
          setCatalogoPlantillaAplicado(true)
        } catch (cause) {
          advertencias.push(cause instanceof Error
            ? `No se pudo cargar el catálogo revisado: ${cause.message}`
            : 'No se pudo cargar el catálogo revisado; podrás importarlo desde Prestaciones.')
        }
      }

      const emailsProcesados = new Set<string>()
      let creadas = 0
      let pendientes = 0
      for (const miembro of equipo) {
        const email = miembro.email.trim().toLowerCase()
        if (!email || emailsProcesados.has(email)) {
          pendientes += 1
          continue
        }
        emailsProcesados.add(email)
        try {
          const resultado = await invitarMiembro(email, miembro.rol)
          if (resultado.success) creadas += 1
          else pendientes += 1
        } catch {
          pendientes += 1
        }
      }
      setInvitacionesCreadas(creadas)
      setInvitacionesPendientes(pendientes)
      setAdvertenciasConfiguracion(advertencias)

      setPaso(8)
      setCompletado(true)
    } catch (err: unknown) {
      log.error('Error en bootstrap:', err)
      setErrorGeneral('Error inesperado al inicializar la clínica')
    } finally {
      setProcesando(false)
    }
  }

  const finalizarBienvenida = useCallback(() => {
    if (onComplete) onComplete()
  }, [onComplete])

  return {
    paso, tipoActividad, datos, sedes, equipo, errores, procesando, errorGeneral, completado,
    plantillaSeleccionada, preciosPlantilla, boxesPlantilla, boxesCreados, catalogoPlantillaAplicado, advertenciasConfiguracion,
    invitacionesCreadas, invitacionesPendientes,
    sucursalesRegistradas, sucursalesSincronizadas, errorSincronizacionSedes,
    setTipoActividad, actualizarCampo, agregarSede, eliminarSede, agregarMiembro, eliminarMiembro,
    seleccionarPlantilla, actualizarPrecioPlantilla, actualizarNombreBoxPlantilla,
    avanzarPaso, retrocederPaso, cancelarConfiguracion, handleSubmit, finalizarBienvenida,
  }
}
