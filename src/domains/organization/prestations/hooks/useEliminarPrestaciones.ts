import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  prestacionesStorageService,
  type Prestacion,
  type PaqueteClinico
} from '../services/prestacionesStorageService'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'
import { USE_SUPABASE } from '../../../../infrastructure/supabase/supabaseClient'
import { prestacionesSupabaseService } from '../services/prestacionesSupabaseService'

export interface UseEliminarPrestacionesOptions {
  prestaciones: Prestacion[]
  guardarYSincronizarGlobal: (nuevasPrestaciones: Prestacion[]) => void
  setPaquetes: Dispatch<SetStateAction<PaqueteClinico[]>>
}

export interface UseEliminarPrestacionesReturn {
  eliminarPrestacion: (id: number | string) => Promise<void>
  eliminarPaquete: (id: number | string) => Promise<void>
}

export const useEliminarPrestaciones = ({
  prestaciones,
  guardarYSincronizarGlobal,
  setPaquetes
}: UseEliminarPrestacionesOptions): UseEliminarPrestacionesReturn => {
  const { confirm } = useAppDialog()

  const eliminarPrestacion = useCallback(
    async (id: number | string) => {
      const ok = await confirm({
        title: 'Eliminar procedimiento',
        description: '¿Estás seguro de eliminar este procedimiento del arancel?',
        variant: 'danger',
        confirmText: 'Eliminar'
      })
      if (ok) {
        if (USE_SUPABASE) await prestacionesSupabaseService.eliminar(id)
        const actualizadas = prestaciones.filter(p => String(p.id) !== String(id))
        guardarYSincronizarGlobal(actualizadas)
      }
    },
    [prestaciones, guardarYSincronizarGlobal, confirm]
  )

  const eliminarPaquete = useCallback(
    async (id: number | string) => {
      const ok = await confirm({
        title: 'Eliminar paquete',
        description: '¿Estás seguro de eliminar este paquete o promoción?',
        variant: 'danger',
        confirmText: 'Eliminar'
      })
      if (ok) {
        if (USE_SUPABASE && typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
          await prestacionesSupabaseService.eliminar(id)
        }
        setPaquetes(prev => {
          const actualizados = prev.filter(p => String(p.id) !== String(id))
          prestacionesStorageService.guardarPaquetes(actualizados)
          return actualizados
        })

        const actualizadasArancel = prestaciones.filter(
          p => String(p.id) !== String(id)
        )
        guardarYSincronizarGlobal(actualizadasArancel)
      }
    },
    [prestaciones, guardarYSincronizarGlobal, setPaquetes, confirm]
  )

  return { eliminarPrestacion, eliminarPaquete }
}
