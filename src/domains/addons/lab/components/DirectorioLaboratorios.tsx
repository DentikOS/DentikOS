import React, { memo, useState } from 'react'
import { Input } from '../../../../shared/ui/ui/Input'
import { Button } from '../../../../shared/ui/ui/Button'
import {
  TIPOS_TRABAJO_SUGERIDOS,
  type LaboratorioBase,
  type TarifaLaboratorio
} from '../constants/laboratorioConstants'
import type { LabDataInput } from '../hooks/useLaboratorio'
import { Plus, Settings, Pencil, Trash2, Folder, X } from 'lucide-react'

export interface DirectorioLaboratoriosProps {
  laboratorios: LaboratorioBase[]
  alGuardarLab: (labData: LabDataInput) => void
  alEliminarLab: (idLab: number | string) => void | Promise<void>
}

export const DirectorioLaboratorios: React.FC<DirectorioLaboratoriosProps> = memo(({
  laboratorios,
  alGuardarLab,
  alEliminarLab
}) => {
  const [labEditar, setLabEditar] = useState<LaboratorioBase | null>(null)

  const [nombre, setNombre] = useState<string>('')
  const [contacto, setContacto] = useState<string>('')
  const [telefono, setTelefono] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [direccion, setDireccion] = useState<string>('')

  // Tarifario
  const [trabajoTexto, setTrabajoTexto] = useState<string>('')
  const [precioSel, setPrecioSel] = useState<string>('')
  const [tarifasTemp, setTarifasTemp] = useState<TarifaLaboratorio[]>([])

  const handleAbrirNuevo = (): void => {
    setLabEditar(null)
    setNombre('')
    setContacto('')
    setTelefono('')
    setEmail('')
    setDireccion('')
    setTarifasTemp([])
  }

  const handleAbrirEditar = (lab: LaboratorioBase): void => {
    setLabEditar(lab)
    setNombre(lab.nombre || '')
    setContacto(lab.contacto || '')
    setTelefono(lab.telefono || '')
    setEmail(lab.email || '')
    setDireccion(lab.direccion || '')
    setTarifasTemp(lab.tarifas ? [...lab.tarifas] : [])
  }

  const handleAgregarTarifa = (): void => {
    if (!trabajoTexto.trim() || !precioSel || parseFloat(precioSel) <= 0) return
    const trabajoClean = trabajoTexto.trim()
    const existe = tarifasTemp.some(
      (t) => t.trabajo.toLowerCase() === trabajoClean.toLowerCase()
    )

    if (existe) {
      setTarifasTemp(
        tarifasTemp.map((t) =>
          t.trabajo.toLowerCase() === trabajoClean.toLowerCase()
            ? { ...t, precio: parseFloat(precioSel) }
            : t
        )
      )
    } else {
      setTarifasTemp([
        ...tarifasTemp,
        { trabajo: trabajoClean, precio: parseFloat(precioSel) }
      ])
    }
    setTrabajoTexto('')
    setPrecioSel('')
  }

  const handleEliminarTarifa = (trabajoNombre: string): void => {
    setTarifasTemp(tarifasTemp.filter((t) => t.trabajo !== trabajoNombre))
  }

  const handleGuardarSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (!nombre.trim()) return

    const labObj: LabDataInput = {
      id: labEditar ? labEditar.id : Date.now(),
      nombre: nombre.trim(),
      contacto,
      telefono,
      email,
      direccion,
      tarifas: tarifasTemp
    }

    alGuardarLab(labObj)
    handleAbrirNuevo()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
      {/* Formulario Crear / Editar Lab */}
      <form
        onSubmit={handleGuardarSubmit}
        className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-6 shadow-xs space-y-3"
      >
        <div className="border-b border-gray-200 dark:border-graphite-700 pb-2 flex justify-between items-center">
          <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase">
            {labEditar ? (
              'Editar Proveedor Lab'
            ) : (
              <span className="inline-flex items-center gap-1">
                <Plus size={12} />
                Registrar Nuevo Lab
              </span>
            )}
          </h3>
          {labEditar && (
            <Button type="button" onClick={handleAbrirNuevo} variant="ghost" size="sm">
              Cancelar
            </Button>
          )}
        </div>

        <Input
          label="Nombre Laboratorio"
          type="text"
          required
          placeholder="Ej: Laboratorio Estética & Cerámica"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Contacto / Ceramista"
            type="text"
            placeholder="Ej: Roberto Gómez"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
          />
          <Input
            label="Teléfono"
            type="text"
            placeholder="+56 9 1234 5678"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>

        <div className="border-t border-gray-200 dark:border-graphite-700 pt-3 space-y-2">
          <label className="block font-bold text-gray-800 dark:text-graphite-100 uppercase text-[10px]">
            <span className="inline-flex items-center gap-1">
              <Settings size={12} />
              Tarifario Personalizado del Laboratorio
            </span>
          </label>

          <div className="space-y-2 bg-gray-50 dark:bg-graphite-800 p-3 rounded-xl border border-gray-200 dark:border-graphite-700">
            <input
              type="text"
              list="tarifas-sugeridas-list"
              placeholder="Nombre del trabajo (Ej: Carilla E-Max, Protesis Valplast...)"
              value={trabajoTexto}
              onChange={(e) => setTrabajoTexto(e.target.value)}
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-graphite-600 bg-white dark:bg-graphite-800 font-semibold text-[11px]"
            />
            <datalist id="tarifas-sugeridas-list">
              {TIPOS_TRABAJO_SUGERIDOS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Precio ($ CLP)"
                value={precioSel}
                onChange={(e) => setPrecioSel(e.target.value)}
              />
              <Button type="button" onClick={handleAgregarTarifa} variant="primary">
                + Añadir
              </Button>
            </div>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto pt-1">
            {tarifasTemp.map((t) => (
              <div
                key={t.trabajo}
                className="flex justify-between items-center p-2 bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-lg"
              >
                <span className="font-semibold text-[11px] text-gray-800 dark:text-graphite-100 truncate max-w-[170px]">
                  {t.trabajo}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-emerald-800 dark:text-emerald-400">
                    ${t.precio.toLocaleString('es-CL')}
                  </span>
                  <Button
                    type="button"
                    onClick={() => handleEliminarTarifa(t.trabajo)}
                    variant="danger"
                    size="sm"
                    className="px-2 py-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" fullWidth>
          {labEditar ? 'Guardar Cambios Proveedor' : 'Registrar Laboratorio y Tarifas'}
        </Button>
      </form>

      {/* Directorio de Laboratorios Guardados */}
      <div className="md:col-span-2 space-y-4">
        <h3 className="font-bold text-sm text-gray-900 dark:text-graphite-50 uppercase tracking-wider">
          <span className="inline-flex items-center gap-1">
            <Folder size={12} />
            Directorio de Laboratorios y Aranceles ({laboratorios.length})
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {laboratorios.map((lab) => (
            <div
              key={lab.id}
              className="bg-white dark:bg-graphite-800 border border-gray-200 dark:border-graphite-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex justify-between items-start border-b border-gray-200 dark:border-graphite-700 pb-2">
                  <h4 className="font-black text-sm text-gray-900 dark:text-graphite-50">
                    {lab.nombre}
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => handleAbrirEditar(lab)}
                      variant="ghost"
                      size="sm"
                      className="p-1"
                      title="Editar"
                      aria-label="Editar laboratorio"
                    >
                      <Pencil size={12} />
                    </Button>
                    <Button
                      onClick={() => void alEliminarLab(lab.id)}
                      variant="danger"
                      size="sm"
                      className="p-1"
                      title="Eliminar"
                      aria-label="Eliminar laboratorio"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>

                <div className="text-[11px] text-gray-600 dark:text-graphite-400 mt-2 space-y-1">
                  <p>
                    <span className="font-semibold text-gray-800 dark:text-graphite-100">
                      Contacto:
                    </span>{' '}
                    {lab.contacto || 'N/I'}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-800 dark:text-graphite-100">
                      Teléfono:
                    </span>{' '}
                    {lab.telefono || 'N/I'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-graphite-700 space-y-1">
                  <span className="font-bold text-[10px] text-gray-500 dark:text-graphite-400 uppercase block">
                    Tarifas Registradas ({lab.tarifas?.length || 0}):
                  </span>
                  {lab.tarifas && lab.tarifas.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {lab.tarifas.map((t) => (
                        <div
                          key={t.trabajo}
                          className="flex justify-between text-[10px] bg-gray-50 dark:bg-graphite-800 p-1.5 rounded"
                        >
                          <span className="truncate max-w-[160px] font-medium text-gray-700 dark:text-graphite-300">
                            {t.trabajo}
                          </span>
                          <span className="font-bold text-gray-900 dark:text-graphite-50">
                            ${t.precio.toLocaleString('es-CL')} CLP
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 dark:text-graphite-500 italic text-[10px]">
                      Sin tarifas asignadas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

DirectorioLaboratorios.displayName = 'DirectorioLaboratorios'
