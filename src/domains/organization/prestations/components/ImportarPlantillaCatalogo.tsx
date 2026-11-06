import React, { useMemo, useState } from 'react'
import { clinicStorageService } from '../../clinic/services/clinicStorageService'
import { usePrestacionesStore } from '../../../../app/stores/prestacionesStore'
import { PLANTILLAS_CATALOGO, obtenerPlantillaCatalogo, type PlantillaCatalogoId, type PrestacionPlantilla } from '../constants/prestacionesPlantillas'
import { prestacionesSupabaseService, type PrestacionImportarPlantilla } from '../services/prestacionesSupabaseService'

interface PrestacionBorrador extends PrestacionPlantilla {
  precioParticularTexto: string
}

const precioValido = (valor: string): boolean => {
  if (!/^(0|[1-9][0-9]*)$/.test(valor)) return false
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero <= 2_147_483_647
}

export const ImportarPlantillaCatalogo: React.FC = () => {
  const [plantillaId, setPlantillaId] = useState<PlantillaCatalogoId | ''>('')
  const [borrador, setBorrador] = useState<PrestacionBorrador[]>([])
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState('')
  const moneda = clinicStorageService.obtenerClinica()?.moneda || 'CLP'
  const plantillaSeleccionada = useMemo(
    () => PLANTILLAS_CATALOGO.find((item) => item.id === plantillaId),
    [plantillaId],
  )
  const preciosListos = borrador.length > 0 && borrador.every((item) =>
    precioValido(item.precioParticularTexto)
  )

  const seleccionarPlantilla = (id: PlantillaCatalogoId): void => {
    setPlantillaId(id)
    setError('')
    setBorrador(obtenerPlantillaCatalogo(id).map((item) => ({
      ...item,
      precioParticularTexto: moneda === 'CLP' ? String(item.precioParticular) : '',
    })))
  }

  const actualizarPrecio = (codigo: string, valor: string): void => {
    if (valor !== '' && !/^\d*$/.test(valor)) return
    setBorrador((actual) => actual.map((item) => item.codigoInterno === codigo ? { ...item, precioParticularTexto: valor } : item))
  }

  const importar = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!plantillaId || !preciosListos || importando) return
    setImportando(true)
    setError('')
    try {
      const importadas: PrestacionImportarPlantilla[] = borrador.map((item) => ({
        codigoInterno: item.codigoInterno,
        categoria: item.categoria,
        nombre: item.nombre,
        especialidad: item.especialidad,
        precioParticular: Number(item.precioParticularTexto),
        precioFonasa: null,
      }))
      const confirmadas = await prestacionesSupabaseService.importarPlantilla(plantillaId, importadas)
      usePrestacionesStore.getState().setPrestacionesArancel(confirmadas)
    } catch (cause) {
      await usePrestacionesStore.getState().sincronizarDesdeSupabase()
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar la plantilla. Actualiza el catálogo antes de reintentar.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-primary/20 bg-surface p-4" aria-labelledby="plantilla-catalogo-titulo">
      <div>
        <h2 id="plantilla-catalogo-titulo" className="text-sm font-semibold text-graphite-900 dark:text-white">Cargar prestaciones desde una plantilla BP08</h2>
        <p className="mt-1 text-xs text-graphite-600 dark:text-slate-400">Elige un catálogo, revisa los importes y confirma una única carga compartida con Presupuestos y Plan de Tratamiento.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {PLANTILLAS_CATALOGO.map((plantilla) => (
          <button
            key={plantilla.id}
            type="button"
            aria-pressed={plantillaId === plantilla.id}
            onClick={() => seleccionarPlantilla(plantilla.id)}
            className={`rounded-xl border p-3 text-left transition-colors ${plantillaId === plantilla.id ? 'border-primary bg-primary/5' : 'border-surface hover:border-primary/40'}`}
          >
            <span className="block text-xs font-semibold">{plantilla.nombre}</span>
            <span className="mt-1 block text-[11px] text-graphite-500 dark:text-slate-400">{plantilla.prestaciones.length} prestaciones</span>
            <span className="mt-1 block text-[11px] text-graphite-500 dark:text-slate-400">{plantilla.descripcion}</span>
          </button>
        ))}
      </div>

      {plantillaSeleccionada && (
        <form onSubmit={(event) => void importar(event)} className="space-y-3">
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            Los precios publicados por BP08 son CLP. La clínica usa {moneda}; revisa cada precio base antes de confirmar.
            Los precios de convenios y sucursales se configuran por separado y se aplican al cotizar.
          </div>
          <div className="max-h-[28rem] overflow-auto rounded-xl border border-surface">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="sticky top-0 bg-surface text-[10px] uppercase text-graphite-500">
                <tr>
                  <th className="p-2">Código</th><th className="p-2">Prestación</th><th className="p-2">Categoría</th>
                  <th className="p-2 text-right">Precio base ({moneda})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface">
                {borrador.map((item) => (
                  <tr key={item.codigoInterno}>
                    <td className="p-2 font-mono">{item.codigoInterno}</td>
                    <td className="p-2">{item.nombre}</td>
                    <td className="p-2">{item.categoria}</td>
                    <td className="p-2 text-right">
                      <input aria-label={`${item.codigoInterno} precio base`} type="number" min="0" max="2147483647" step="1" required value={item.precioParticularTexto} onChange={(event) => actualizarPrecio(item.codigoInterno, event.target.value)} className="w-32 rounded-lg border border-surface bg-white px-2 py-1.5 text-right dark:bg-slate-900" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-graphite-500 dark:text-slate-400">Los códigos Fonasa oficiales quedan vacíos: los códigos PRE/ORT/CIR/REH son códigos internos.</p>
            <button type="submit" disabled={!preciosListos || importando} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {importando ? 'Importando…' : `Revisé los precios e importar ${borrador.length} prestaciones`}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
