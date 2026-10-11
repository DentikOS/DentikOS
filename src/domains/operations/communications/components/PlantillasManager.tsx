import React, { memo, useState } from 'react'
import { Pencil, Plus, ClipboardList, Trash2, MessageCircle, Mail } from 'lucide-react'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import {
  CANALES_COMUNICACION,
  type PlantillaComunicacion
} from '../constants/comunicacionesConstants'
import type { PlantillaInput } from '../hooks/useComunicaciones'
import { useAppDialog } from '../../../../shared/hooks/useAppDialog'

export interface PlantillasManagerProps {
  plantillas: PlantillaComunicacion[]
  alGuardarPlantilla: (plantillaData: PlantillaInput | PlantillaComunicacion) => void
  alEliminarPlantilla: (id: number | string) => void
}

export const PlantillasManager: React.FC<PlantillasManagerProps> = memo(({
  plantillas,
  alGuardarPlantilla,
  alEliminarPlantilla
}) => {
  const [plantillaEditar, setPlantillaEditar] = useState<PlantillaComunicacion | null>(null)
  const { alert: dialogAlert } = useAppDialog()
  const [nombre, setNombre] = useState<string>('')
  const [canal, setCanal] = useState<string>(CANALES_COMUNICACION[0].id)
  const [asunto, setAsunto] = useState<string>('')
  const [cuerpo, setCuerpo] = useState<string>('')

  const handleAbrirEditar = (pl: PlantillaComunicacion): void => {
    setPlantillaEditar(pl)
    setNombre(pl.nombre || '')
    setCanal(pl.canal || CANALES_COMUNICACION[0].id)
    setAsunto(pl.asunto || '')
    setCuerpo(pl.cuerpo || '')
  }

  const handleCancelarEdicion = (): void => {
    setPlantillaEditar(null)
    setNombre('')
    setAsunto('')
    setCuerpo('')
  }

  const handleInsertarVariable = (variable: string): void => {
    setCuerpo((prev) => prev + ` ${variable} `)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!nombre.trim() || !cuerpo.trim()) {
      await dialogAlert({
        title: 'Campos requeridos',
        description: 'Debes ingresar el nombre identificador y el cuerpo del mensaje.',
        variant: 'warning',
        confirmText: 'Entendido'
      })
      return
    }

    alGuardarPlantilla({
      id: plantillaEditar ? plantillaEditar.id : undefined,
      nombre: nombre.trim(),
      canal,
      asunto: asunto.trim(),
      cuerpo: cuerpo.trim()
    })

    handleCancelarEdicion()
    await dialogAlert({
      title: 'Plantilla guardada',
      description: plantillaEditar
        ? 'Plantilla modificada exitosamente.'
        : 'Nueva plantilla creada exitosamente.',
      variant: 'success',
      confirmText: 'Entendido'
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-6 shadow-xs space-y-3"
      >
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-graphite-700 pb-2">
          <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase">
            {plantillaEditar ? (
              <span className="inline-flex items-center gap-1">
                <Pencil size={12} />
                Editar Plantilla
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Plus size={12} />
                Crear Plantilla
              </span>
            )}
          </h3>
          {plantillaEditar && (
            <Button type="button" onClick={handleCancelarEdicion} variant="ghost" size="sm">
              Cancelar
            </Button>
          )}
        </div>

        <Input
          label="Nombre Identificador"
          type="text"
          placeholder="Ej: Confirmación de Cita"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <div>
          <label className="block font-semibold text-gray-700 dark:text-graphite-300 mb-1">
            Canal Predeterminado
          </label>
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-semibold"
          >
            {CANALES_COMUNICACION.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {canal === 'email' && (
          <Input
            label="Asunto del Correo"
            type="text"
            placeholder="Ej: Su Atención Odontológica"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
          />
        )}

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block font-semibold text-gray-700 dark:text-graphite-300">
              Cuerpo del Mensaje *
            </label>
          </div>

          <textarea
            rows={4}
            placeholder="Ej: Hola {paciente}, le recordamos su cita el {fecha} a las {hora} hrs..."
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-graphite-600 font-mono text-[11px]"
          />

          {/* Chips de inserción rápida de variables */}
          <div className="pt-2 flex flex-wrap gap-1">
            <span
              className="text-[10px] text-gray-500 dark:text-graphite-400 w-full block"
              title="Estas variables se reemplazan automáticamente con los datos del paciente al enviar el mensaje"
            >
              Variables dinámicas (se reemplazan al enviar):
            </span>
            {['{paciente}', '{fecha}', '{hora}', '{doctor}', '{clinica}'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleInsertarVariable(v)}
                className="bg-gray-100 dark:bg-graphite-800 hover:bg-black hover:text-white px-2 py-0.5 rounded border border-gray-200 dark:border-graphite-700 text-[10px] font-mono font-bold transition-colors duration-150"
                title={`Insertar ${v} en el mensaje`}
              >
                + {v}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" fullWidth>
          {plantillaEditar ? 'Guardar Cambios' : 'Guardar Plantilla'}
        </Button>
      </form>

      <div className="md:col-span-2 space-y-4">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase tracking-wider inline-flex items-center gap-2">
          <ClipboardList size={16} />
          Plantillas Registradas ({plantillas.length})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plantillas.map((pl) => (
            <div
              key={pl.id}
              className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex justify-between items-start border-b border-gray-200 dark:border-graphite-700 pb-2">
                  <h4 className="font-black text-sm text-gray-900 dark:text-graphite-50">
                    {pl.nombre}
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => handleAbrirEditar(pl)}
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      aria-label="Editar plantilla"
                    >
                      <Pencil size={12} />
                    </Button>
                    <Button
                      onClick={() => alEliminarPlantilla(pl.id)}
                      variant="danger"
                      size="sm"
                      className="p-1"
                      aria-label="Eliminar plantilla"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-graphite-400 mt-2 font-mono text-[10px] leading-relaxed">
                  {pl.cuerpo}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-graphite-700 text-right">
                <span className="bg-gray-100 dark:bg-graphite-800 text-gray-800 dark:text-graphite-100 px-2 py-0.5 rounded font-bold text-[10px]">
                  {pl.canal === 'whatsapp' ? (
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle size={10} />
                      WhatsApp
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={10} />
                      Email
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

PlantillasManager.displayName = 'PlantillasManager'
