/**
 * usePresupuestoItems — Hook para gestión de items del presupuesto (F7-25)
 * 
 * Extraído de usePresupuestoForm.js para cumplir límite arquitectónico (F3-02).
 * Gestiona la selección de prestaciones, descuentos por convenio y CRUD de items.
 */
import { useState } from 'react'
import type React from 'react'
import { obtenerPrecioPrestacionConvenio } from '../utils/pacientesCalculations'
import { pacientesStorageService } from '../services/pacientesStorageService'

export interface ItemPresupuesto {
  id: string | number
  pieza: string
  prestacion: string
  convenio?: string
  precioBase: number
  descuentoPct: number
  precioOrigen?: string
  sucursalIdPrecio?: string | null
  valor: number
  estado: string
  [key: string]: unknown
}

export interface PrestacionArancel {
  id: string | number
  nombre: string
  especialidad?: string
  precio?: number | string
  precioParticular?: number | string
  [key: string]: unknown
}

export interface PacientePresupuestoRef {
  id: string | number
  prevision?: string | null
  [key: string]: unknown
}

export interface UsePresupuestoItemsOptions {
  paciente: PacientePresupuestoRef
  arancelActualizado: PrestacionArancel[]
  convenioAplicado: string
  itemsPresupuesto: ItemPresupuesto[]
  setItemsPresupuesto: (items: ItemPresupuesto[]) => void
}

export interface UsePresupuestoItemsReturn {
  piezaPresupuesto: string
  prestacionSeleccionadaId: string | number
  nombrePrestacion: string
  valorPrestacion: number | string
  precioBaseOriginal: number
  porcentajeDescuentoAplicado: number
  origenPrecioAplicado: string | null
  sucursalPrecioAplicada: string | null
  handleSeleccionarPrestacion: (id: string | number, convenioNombre?: string) => void
  handleCambiarConvenioSelect: (nuevoConvenio: string) => void
  handleAgregarItemPresupuesto: (e: React.FormEvent) => void
  handleEliminarItem: (id: string | number) => void
  setPiezaPresupuesto: (pieza: string) => void
  setNombrePrestacion: (nombre: string) => void
  setValorPrestacion: (valor: string | number) => void
}

export const usePresupuestoItems = ({
  paciente,
  arancelActualizado,
  convenioAplicado,
  itemsPresupuesto,
  setItemsPresupuesto
}: UsePresupuestoItemsOptions): UsePresupuestoItemsReturn => {
  const [piezaPresupuesto, setPiezaPresupuesto] = useState<string>('')
  const [prestacionSeleccionadaId, setPrestacionSeleccionadaId] = useState<string | number>('')
  const [nombrePrestacion, setNombrePrestacion] = useState<string>('')
  const [valorPrestacion, setValorPrestacion] = useState<number | string>('')
  const [precioBaseOriginal, setPrecioBaseOriginal] = useState<number>(0)
  const [porcentajeDescuentoAplicado, setPorcentajeDescuentoAplicado] = useState<number>(0)
  const [origenPrecioAplicado, setOrigenPrecioAplicado] = useState<string | null>(null)
  const [sucursalPrecioAplicada, setSucursalPrecioAplicada] = useState<string | null>(null)

  const handleSeleccionarPrestacion = (id: string | number, convenioNombre: string = convenioAplicado): void => {
    setPrestacionSeleccionadaId(id)
    if (!id) return
    const prest = arancelActualizado.find(p => String(p.id) === String(id))
    if (prest) {
      const precioParticularRaw = Number(prest.precioParticular ?? prest.precio ?? 0)
      const precioFonasaOriginal = prest.precioFonasa
      const precioFonasaRaw = Number(precioFonasaOriginal)
      const precioParticular = Number.isFinite(precioParticularRaw) && precioParticularRaw >= 0 ? Math.round(precioParticularRaw) : 0
      const precioFonasa = precioFonasaOriginal !== undefined && precioFonasaOriginal !== null && precioFonasaOriginal !== '' && Number.isFinite(precioFonasaRaw) && precioFonasaRaw >= 0
        ? Math.round(precioFonasaRaw)
        : undefined
      setNombrePrestacion(prest.nombre)
      const calculo = obtenerPrecioPrestacionConvenio({
        prestacionId: prest.id,
        especialidad: typeof prest.especialidad === 'string' ? prest.especialidad : null,
        convenioIdentificador: convenioNombre,
        precioParticular,
        precioFonasa,
      })
      setPrecioBaseOriginal(calculo.precioBase)
      setPorcentajeDescuentoAplicado(calculo.descuentoPct)
      setOrigenPrecioAplicado(calculo.origen)
      setSucursalPrecioAplicada(calculo.sucursalId)
      setValorPrestacion(calculo.precio)
    }
  }

  const handleCambiarConvenioSelect = (nuevoConvenio: string): void => {
    if (prestacionSeleccionadaId) {
      handleSeleccionarPrestacion(prestacionSeleccionadaId, nuevoConvenio)
    }
  }

  const handleAgregarItemPresupuesto = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!nombrePrestacion || valorPrestacion === '' || !Number.isFinite(Number(valorPrestacion)) || Number(valorPrestacion) < 0) return
    const valorNum = parseInt(String(valorPrestacion), 10) || 0
    const nuevoItem: ItemPresupuesto = {
      id: Date.now(),
      pieza: piezaPresupuesto || 'General',
      prestacion: nombrePrestacion,
      convenio: convenioAplicado,
      precioBase: precioBaseOriginal,
      descuentoPct: porcentajeDescuentoAplicado,
      precioOrigen: origenPrecioAplicado || undefined,
      sucursalIdPrecio: sucursalPrecioAplicada,
      valor: valorNum,
      estado: 'Pendiente'
    }
    const actualizados = [...itemsPresupuesto, nuevoItem]
    setItemsPresupuesto(actualizados)
    pacientesStorageService.guardarItem(`presupuesto_items_${paciente.id}`, actualizados)
    setPiezaPresupuesto('')
    setPrestacionSeleccionadaId('')
    setNombrePrestacion('')
    setValorPrestacion('')
    setPrecioBaseOriginal(0)
    setPorcentajeDescuentoAplicado(0)
    setOrigenPrecioAplicado(null)
    setSucursalPrecioAplicada(null)
  }

  const handleEliminarItem = (id: string | number): void => {
    const actualizados = itemsPresupuesto.filter(i => String(i.id) !== String(id))
    setItemsPresupuesto(actualizados)
    pacientesStorageService.guardarItem(`presupuesto_items_${paciente.id}`, actualizados)
  }

  return {
    piezaPresupuesto,
    prestacionSeleccionadaId,
    nombrePrestacion,
    valorPrestacion,
    precioBaseOriginal,
    porcentajeDescuentoAplicado,
    origenPrecioAplicado,
    sucursalPrecioAplicada,
    handleSeleccionarPrestacion,
    handleCambiarConvenioSelect,
    handleAgregarItemPresupuesto,
    handleEliminarItem,
    setPiezaPresupuesto,
    setNombrePrestacion,
    setValorPrestacion
  }
}
