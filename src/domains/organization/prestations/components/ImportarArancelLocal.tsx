import React, { useMemo, useState } from 'react'
import { usePrestacionesStore } from '../../../../app/stores/prestacionesStore'
import { formatearCLP } from '../../../../shared/utils/formatoMoneda'
import { ARANCEL_DEFAULT } from '../constants/prestacionesConstants'
import { prestacionesStorageService, type Prestacion } from '../services/prestacionesStorageService'
import { prestacionesSupabaseService } from '../services/prestacionesSupabaseService'

const esEjemploSinCambios = (prestacion: Prestacion): boolean => {
  const ejemplo = ARANCEL_DEFAULT.find((item) => String(item.id) === String(prestacion.id))
  return Boolean(ejemplo && ejemplo.nombre === prestacion.nombre &&
    ejemplo.especialidad === prestacion.especialidad &&
    ejemplo.precioParticular === prestacion.precioParticular &&
    ejemplo.precioFonasa === prestacion.precioFonasa &&
    ejemplo.codigoFonasa === prestacion.codigoFonasa)
}

export const candidatosArancelLocal = (locales: Prestacion[], remotas: Prestacion[]): Prestacion[] =>
  locales.filter((prestacion) => !esEjemploSinCambios(prestacion) &&
    !remotas.some((remota) => remota.nombre === prestacion.nombre &&
      remota.especialidad === prestacion.especialidad &&
      remota.precioParticular === prestacion.precioParticular &&
      remota.precioFonasa === prestacion.precioFonasa &&
      remota.codigoFonasa === prestacion.codigoFonasa))

export const ImportarArancelLocal: React.FC = () => {
  const remotas = usePrestacionesStore((state) => state.prestacionesArancel)
  const estadoRemoto = usePrestacionesStore((state) => state.estadoRemoto)
  const [locales] = useState<Prestacion[]>(() => prestacionesStorageService.obtenerPrestaciones(undefined) ?? [])
  const [importando, setImportando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const candidatos = useMemo(() => candidatosArancelLocal(locales, remotas), [locales, remotas])

  if (candidatos.length === 0) return null

  const importar = async (prestacion: Prestacion) => {
    setImportando(String(prestacion.id))
    setError('')
    try {
      // Un id legado local nunca autoriza UPDATE de una fila remota.
      const guardada = await prestacionesSupabaseService.guardar({ ...prestacion, id: Date.now() })
      usePrestacionesStore.getState().setPrestacionesArancel((actuales) => [guardada, ...actuales])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo importar la prestación.')
    } finally {
      setImportando(null)
    }
  }

  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs space-y-3">
    <h3 className="font-bold">Prestaciones anteriores de este navegador</h3>
    <p>Revisa cada precio antes de incorporarlo al arancel compartido. Los ejemplos sin modificar no se importan automáticamente.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="space-y-2">
      {candidatos.map((prestacion) => <div key={String(prestacion.id)} className="flex items-center justify-between gap-3 border-t border-amber-200 pt-2">
        <span>{prestacion.nombre} · {prestacion.especialidad} · particular {formatearCLP(prestacion.precioParticular)} · convenio {formatearCLP(prestacion.precioFonasa)}</span>
        <button type="button" className="rounded-lg bg-black px-3 py-1.5 text-white disabled:opacity-50"
          disabled={estadoRemoto !== 'listo' || importando !== null}
          onClick={() => void importar(prestacion)}>
          {importando === String(prestacion.id) ? 'Importando…' : 'Importar'}
        </button>
      </div>)}
    </div>
  </section>
}
