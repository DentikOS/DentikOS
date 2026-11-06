import React, { useState } from 'react'
import { Building2, Plus, Trash2, MapPin, Clock3, Globe2, ClipboardList, Check } from 'lucide-react'
import { useBootstrapClinica } from '../hooks/useBootstrapClinica'
import { useAppDialog } from '../hooks/useAppDialog'
import { PantallaBienvenida } from './PantallaBienvenida'
import { OnboardingStepper } from './OnboardingStepper'
import { PasoTipoActividad } from './PasoTipoActividad'
import { PasoEquipo } from './PasoEquipo'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { PLANTILLAS_CATALOGO, obtenerPlantillaCatalogo } from '../../domains/organization/prestations/constants/prestacionesPlantillas'
import { IDIOMAS_DOCUMENTO, MONEDAS_DOCUMENTO } from '../utils/formatoDocumento'
import { obtenerZonasHorariasIana } from '../../domains/organization/clinic/utils/timeZoneUtils'

export interface BootstrapClinicaProps {
  onComplete?: () => void
}

export const BootstrapClinica: React.FC<BootstrapClinicaProps> = ({ onComplete }) => {
  const {
    paso,
    tipoActividad,
    datos,
    sedes,
    equipo,
    plantillaSeleccionada,
    preciosPlantilla,
    boxesPlantilla = [],
    boxesCreados = 0,
    catalogoPlantillaAplicado = false,
    advertenciasConfiguracion = [],
    errores,
    procesando,
    errorGeneral,
    completado,
    invitacionesCreadas,
    invitacionesPendientes,
    sucursalesRegistradas,
    sucursalesSincronizadas,
    errorSincronizacionSedes,
    setTipoActividad,
    actualizarCampo,
    agregarSede,
    eliminarSede,
    agregarMiembro,
    eliminarMiembro,
    seleccionarPlantilla,
    actualizarPrecioPlantilla,
    actualizarNombreBoxPlantilla,
    avanzarPaso,
    retrocederPaso,
    cancelarConfiguracion,
    handleSubmit,
    finalizarBienvenida,
  } = useBootstrapClinica(onComplete)

  const { confirm } = useAppDialog()

  const [nuevaSedeNombre, setNuevaSedeNombre] = useState('')
  const [nuevaSedeDir, setNuevaSedeDir] = useState('')

  if (completado) {
    return (
      <PantallaBienvenida
        nombreClinica={datos.nombre || 'Tu Clínica'}
        tipoActividad={tipoActividad}
        totalSedes={sucursalesRegistradas || sedes.length}
        invitacionesCreadas={invitacionesCreadas}
        invitacionesPendientes={invitacionesPendientes}
        sucursalesSincronizadas={sucursalesSincronizadas}
        errorSincronizacionSedes={errorSincronizacionSedes}
        boxesCreados={boxesCreados}
        catalogoPlantillaAplicado={catalogoPlantillaAplicado}
        advertenciasConfiguracion={advertenciasConfiguracion}
        alFinalizar={finalizarBienvenida}
      />
    )
  }

  const handleCancelar = async (): Promise<void> => {
    const ok = await confirm({
      title: '¿Cancelar configuración?',
      message: 'Se cerrará tu sesión y podrás retomarla más tarde. No se perderá tu cuenta.',
      description: 'Se cerrará tu sesión y podrás retomarla más tarde. No se perderá tu cuenta.',
      variant: 'warning',
    })
    if (ok) await cancelarConfiguracion()
  }

  const handleCrearSedeManual = () => {
    if (!nuevaSedeNombre.trim() || !nuevaSedeDir.trim()) return
    agregarSede({
      nombre: nuevaSedeNombre.trim(),
      direccion: nuevaSedeDir.trim(),
      comuna: datos.comuna || 'Comuna Central',
      region: datos.region || 'Región Metropolitana',
      zonaHoraria: datos.zonaHoraria || 'America/Santiago',
      activa: true,
    })
    setNuevaSedeNombre('')
    setNuevaSedeDir('')
  }

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-graphite-50 px-4 py-6 text-graphite-900 dark:bg-graphite-950 dark:text-slate-100">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-graphite-200/80 bg-white p-5 shadow-lg shadow-graphite-900/5 ring-1 ring-graphite-900/5 sm:p-8 dark:border-graphite-800 dark:bg-graphite-900 dark:shadow-black/20 dark:ring-white/5">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-champagne-300 via-gold-satin to-gold-solid" />

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-champagne-50 text-champagne-700 ring-1 ring-inset ring-champagne-200 dark:bg-gold-satin/10 dark:text-gold-satin dark:ring-gold-satin/20">
              <Building2 size={23} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-champagne-700 dark:text-gold-satin">DentikOS · Configuración inicial</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-graphite-900 sm:text-2xl dark:text-white">
                {tipoActividad === 'individual' ? 'Crear tu Consulta' : 'Crear tu Clínica'}
              </h1>
              <p className="mt-0.5 text-xs text-graphite-500 dark:text-graphite-400">Paso {paso} de 8 · Configura tu espacio odontológico</p>
            </div>
          </div>

          <div className="flex justify-end sm:pt-1">
            <button
              type="button"
              onClick={handleCancelar}
              className="min-h-9 rounded-lg px-2 text-xs font-medium text-graphite-500 underline decoration-graphite-300 underline-offset-4 transition-colors hover:text-graphite-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-satin dark:text-graphite-400 dark:hover:text-white"
              data-testid="bootstrap-cancelar"
            >
              Cancelar y cerrar sesión
            </button>
          </div>
        </div>

        {/* Barra de progreso */}
        <OnboardingStepper paso={paso} />

        {errorGeneral && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300">
            {errorGeneral}
          </div>
        )}

        {/* Paso 1: Datos de la clínica */}
        {paso === 1 && (
          <div className="space-y-4">
            <PasoTipoActividad tipoActividad={tipoActividad} setTipoActividad={setTipoActividad} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Nombre de la clínica o consulta" id="bootstrap-nombre" required value={datos.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} placeholder="Ej. Clínica Dental Sonrisas" error={errores.nombre || undefined} />
              <Input label="RUT" id="bootstrap-rut" required value={datos.rutEmpresa || ''} onChange={(e) => actualizarCampo('rutEmpresa', e.target.value)} placeholder="76.123.456-7" error={errores.rutEmpresa || undefined} />
              <Input label="Giro comercial" id="bootstrap-giro" required value={datos.giroComercial || ''} onChange={(e) => actualizarCampo('giroComercial', e.target.value)} placeholder="Servicios odontológicos" error={errores.giroComercial || undefined} />
              <Input label="Dirección" id="bootstrap-direccion" required value={datos.direccion || ''} onChange={(e) => actualizarCampo('direccion', e.target.value)} placeholder="Av. Providencia 1234" error={errores.direccion || undefined} />
              <Input label="Comuna" id="bootstrap-comuna" required value={datos.comuna || ''} onChange={(e) => actualizarCampo('comuna', e.target.value)} placeholder="Providencia" error={errores.comuna || undefined} />
              <Input label="Región" id="bootstrap-region" required value={datos.region || ''} onChange={(e) => actualizarCampo('region', e.target.value)} placeholder="Región Metropolitana" error={errores.region || undefined} />
              <Input label="Teléfono" id="bootstrap-telefono" required value={datos.telefono || ''} onChange={(e) => actualizarCampo('telefono', e.target.value)} placeholder="+56 9 1234 5678" error={errores.telefono || undefined} />
              <Input label="Email de contacto" id="bootstrap-email" type="email" required value={datos.emailContacto || ''} onChange={(e) => actualizarCampo('emailContacto', e.target.value)} placeholder="contacto@clinica.cl" error={errores.emailContacto || undefined} />
            </div>
          </div>
        )}

        {/* Paso 2: Zona horaria, idioma y moneda */}
        {paso === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-graphite-500 dark:text-graphite-400">Estas preferencias se guardan en la clínica y determinan la zona horaria de documentos y agenda, su idioma y moneda.</p>
            <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-200">
              <span className="inline-flex items-center gap-2"><Clock3 size={14} />Zona horaria</span>
              <select aria-label="Zona horaria" value={datos.zonaHoraria || 'America/Santiago'} onChange={(e) => actualizarCampo('zonaHoraria', e.target.value)} className="mt-1 w-full rounded-xl border border-graphite-300 bg-white p-2.5 dark:border-graphite-700 dark:bg-graphite-950">
                {obtenerZonasHorariasIana().map((zona) => <option key={zona} value={zona}>{zona}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-200">
                <span className="inline-flex items-center gap-2"><Globe2 size={14} />Idioma de documentos</span>
                <select aria-label="Idioma de documentos" value={datos.idiomaDocumentos || 'es-CL'} onChange={(e) => actualizarCampo('idiomaDocumentos', e.target.value)} className="mt-1 w-full rounded-xl border border-graphite-300 bg-white p-2.5 dark:border-graphite-700 dark:bg-graphite-950">
                  {IDIOMAS_DOCUMENTO.map((idioma) => <option key={idioma} value={idioma}>{idioma}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-graphite-700 dark:text-graphite-200">
                <span className="inline-flex items-center gap-2"><Globe2 size={14} />Moneda de la clínica</span>
                <select aria-label="Moneda de la clínica" value={datos.moneda || 'CLP'} onChange={(e) => actualizarCampo('moneda', e.target.value)} className="mt-1 w-full rounded-xl border border-graphite-300 bg-white p-2.5 dark:border-graphite-700 dark:bg-graphite-950">
                  {MONEDAS_DOCUMENTO.map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Paso 3: Plantilla */}
        {paso === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-graphite-900 dark:text-white">Elige un punto de partida</h2>
              <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">La plantilla no aplica tarifas Fonasa; se incorporarán como pendientes para revisión.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PLANTILLAS_CATALOGO.map((plantilla) => (
                <button key={plantilla.id} type="button" aria-pressed={plantillaSeleccionada === plantilla.id} onClick={() => seleccionarPlantilla(plantilla.id)} className={`rounded-2xl border p-4 text-left transition-colors ${plantillaSeleccionada === plantilla.id ? 'border-champagne-500 bg-champagne-50 dark:bg-gold-satin/10' : 'border-graphite-200 bg-white hover:border-champagne-300 dark:border-graphite-700 dark:bg-graphite-950'}`}>
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold text-graphite-900 dark:text-white"><span>{plantilla.nombre}</span>{plantillaSeleccionada === plantilla.id && <Check size={16} aria-hidden="true" />}</span>
                  <span className="mt-1 block text-xs text-graphite-500 dark:text-graphite-400">{plantilla.prestaciones.length} prestaciones · {plantilla.id === 'general' ? 2 : 3} boxes sugeridos</span>
                  <span className="mt-2 block text-xs text-graphite-600 dark:text-graphite-300">{plantilla.descripcion}</span>
                </button>
              ))}
              <button type="button" aria-pressed={plantillaSeleccionada === null} onClick={() => seleccionarPlantilla(null)} className={`rounded-2xl border p-4 text-left transition-colors ${plantillaSeleccionada === null ? 'border-champagne-500 bg-champagne-50 dark:bg-gold-satin/10' : 'border-graphite-200 bg-white hover:border-champagne-300 dark:border-graphite-700 dark:bg-graphite-950'}`}>
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-graphite-900 dark:text-white"><span>Configurar desde cero</span>{plantillaSeleccionada === null && <Check size={16} aria-hidden="true" />}</span>
                <span className="mt-1 block text-xs text-graphite-500 dark:text-graphite-400">Sin catálogo ni boxes preseleccionados</span>
              </button>
            </div>
            <p className="text-[11px] text-graphite-500 dark:text-graphite-400">Podrás editar la configuración después. Las plantillas no crean ni activan convenios automáticamente.</p>
          </div>
        )}

        {/* Paso 4: Sedes y boxes */}
        {paso === 4 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-graphite-900 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-champagne-50 text-champagne-700 dark:bg-gold-satin/10 dark:text-gold-satin"><MapPin size={16} aria-hidden="true" /></span>
                Sedes registradas
              </h3>
              <span className="text-xs text-graphite-500 dark:text-graphite-400">Podrás agregar más en Administración</span>
            </div>
            <div className="space-y-2">
              {sedes.map((s, idx) => (
                <div key={idx} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-graphite-200 bg-graphite-50/70 p-3 dark:border-graphite-800 dark:bg-graphite-950/50">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-graphite-900 dark:text-white">{s.nombre}</span>
                    <span className="mt-0.5 block break-words text-xs text-graphite-500 dark:text-graphite-400">{s.direccion}</span>
                  </div>
                  {sedes.length > 1 && (
                    <button type="button" onClick={() => eliminarSede(idx)} aria-label={`Eliminar ${s.nombre}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/40">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl border border-dashed border-graphite-300 bg-graphite-50/50 p-4 dark:border-graphite-700 dark:bg-graphite-950/40">
              <span className="text-sm font-semibold text-graphite-800 dark:text-graphite-200">Agregar otra sede</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Nombre de sede"
                  id="bootstrap-sede-nombre"
                  value={nuevaSedeNombre}
                  onChange={(e) => setNuevaSedeNombre(e.target.value)}
                  placeholder="Ej. Sede Oriente"
                  size="sm"
                />
                <Input
                  label="Dirección"
                  id="bootstrap-sede-direccion"
                  value={nuevaSedeDir}
                  onChange={(e) => setNuevaSedeDir(e.target.value)}
                  placeholder="Av. Providencia 1234"
                  size="sm"
                />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleCrearSedeManual} disabled={!nuevaSedeNombre.trim() || !nuevaSedeDir.trim()} className="text-xs cursor-pointer">
                <Plus size={14} className="mr-1" /> Agregar Sede
              </Button>
            </div>
            <section className="space-y-3 rounded-2xl border border-graphite-200 p-4 dark:border-graphite-700" aria-label="Boxes iniciales">
              <div className="flex items-start gap-2">
                <ClipboardList size={16} className="mt-0.5 text-champagne-700 dark:text-gold-satin" />
                <div>
                  <h3 className="text-sm font-semibold text-graphite-900 dark:text-white">Boxes iniciales</h3>
                  <p className="text-xs text-graphite-500 dark:text-graphite-400">Se crearán en la sucursal principal. El equipamiento queda sin marcar hasta que confirmes qué equipos están instalados.</p>
                </div>
              </div>
              {boxesPlantilla.length === 0
                ? <p className="text-xs text-graphite-500 dark:text-graphite-400">No hay boxes de plantilla. Puedes agregarlos más tarde desde Administración &gt; Sucursales.</p>
                : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {boxesPlantilla.map((box, index) => (
                    <Input key={`${box.tipo}-${index}`} label={`Box ${box.tipo}`} id={`bootstrap-box-${index}`} value={box.nombre} onChange={(event) => actualizarNombreBoxPlantilla(index, event.target.value)} />
                  ))}
                </div>}
              {errores.boxesPlantilla && <p role="alert" className="text-xs text-red-700">{errores.boxesPlantilla}</p>}
            </section>
          </div>
        )}

        {/* Paso 5: Equipo */}
        {paso === 5 && (
          <PasoEquipo
            equipo={equipo}
            agregarMiembro={agregarMiembro}
            eliminarMiembro={eliminarMiembro}
          />
        )}

        {/* Paso 6: Revisar y ajustar catálogo */}
        {paso === 6 && (
          <div className="space-y-4">
            {!plantillaSeleccionada ? (
              <p className="rounded-xl border border-graphite-200 bg-graphite-50 p-4 text-xs text-graphite-600 dark:border-graphite-700 dark:bg-graphite-950 dark:text-graphite-300">Elegiste configurar desde cero. El catálogo quedará vacío y podrás crear prestaciones desde Administración &gt; Prestaciones.</p>
            ) : (
              <>
                <div>
                  <h2 className="text-sm font-semibold text-graphite-900 dark:text-white">{PLANTILLAS_CATALOGO.find((item) => item.id === plantillaSeleccionada)?.nombre}: revisa los precios particulares</h2>
                  <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">Los valores de BP08 están expresados en CLP. Ajusta cada valor a la moneda configurada antes de importarlos.</p>
                </div>
                {errores.preciosPlantilla && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{errores.preciosPlantilla}</p>}
                <div className="max-h-[50vh] overflow-auto rounded-xl border border-graphite-200 dark:border-graphite-700">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-graphite-50 text-graphite-600 dark:bg-graphite-800 dark:text-graphite-300">
                      <tr><th className="p-2">Código</th><th className="p-2">Prestación</th><th className="p-2 text-right">Particular ({datos.moneda || 'CLP'})</th><th className="p-2">Fonasa</th></tr>
                    </thead>
                    <tbody className="divide-y divide-graphite-100 dark:divide-graphite-800">
                      {obtenerPlantillaCatalogo(plantillaSeleccionada).map((item) => (
                        <tr key={item.codigoInterno}>
                          <td className="p-2 font-mono">{item.codigoInterno}</td>
                          <td className="p-2">{item.nombre}</td>
                          <td className="p-2 text-right"><input aria-label={`${item.codigoInterno} precio particular`} type="number" min="0" max="2147483647" step="1" required value={preciosPlantilla[item.codigoInterno] ?? ''} onChange={(event) => actualizarPrecioPlantilla(item.codigoInterno, event.target.value)} className="w-32 rounded-lg border border-graphite-300 bg-white px-2 py-1.5 text-right dark:border-graphite-700 dark:bg-graphite-950" /></td>
                          <td className="p-2 text-amber-700 dark:text-amber-300">Pendiente de revisión</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Paso 7: Convenios */}
        {paso === 7 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-950">
              <h2 className="text-sm font-semibold text-graphite-900 dark:text-white">Convenios sin tarifas inventadas</h2>
              <p className="mt-2 text-xs leading-relaxed text-graphite-600 dark:text-graphite-300">La clínica comenzará sin descuentos de ISAPRE/FONASA. Las categorías y porcentajes se pueden configurar y sincronizar después en Administración &gt; Convenios. Mientras tanto, cada presupuesto nuevo usará el precio particular revisado.</p>
            </div>
            <div className="rounded-xl border border-graphite-200 bg-graphite-50 p-4 text-xs text-graphite-600 dark:border-graphite-700 dark:bg-graphite-950 dark:text-graphite-300">
              <h3 className="font-semibold text-graphite-900 dark:text-white">Parámetros financieros iniciales</h3>
              <p className="mt-1">15 días de validez · hasta 6 cuotas mensuales · descuento máximo 50% con motivo requerido.</p>
              <p className="mt-2">Puedes revisar medios de pago y recordatorios en Administración después de crear la clínica.</p>
            </div>
          </div>
        )}

        {/* Navegación botones */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-graphite-200 pt-4 dark:border-graphite-800">
          {paso > 1 ? (
            <Button type="button" variant="outline" size="sm" onClick={retrocederPaso}>
              ← Anterior
            </Button>
          ) : <div />}

          {paso < 7 ? (
            <Button type="button" size="sm" onClick={avanzarPaso}>
              Continuar
            </Button>
          ) : (
            <Button type="button" size="sm" loading={procesando} onClick={() => handleSubmit()}>
              Crear y sincronizar clínica
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
