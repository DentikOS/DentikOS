import React from 'react'
import type { DatosClinicaConfig } from '../services/clinicStorageService'
import { normalizarConfiguracionMembrete } from '../schemas/configuracionMembreteSchema'

export interface MembreteClinicaProps {
  clinica: DatosClinicaConfig
  className?: string
}

export const MembreteClinica: React.FC<MembreteClinicaProps> = ({ clinica, className = '' }) => {
  const configuracion = normalizarConfiguracionMembrete(clinica.configuracionMembrete)
  const logo = configuracion.mostrar.logo ? clinica.logoUrl?.trim() : ''
  const lineas = [
    configuracion.mostrar.rut ? clinica.rutClinica : '',
    configuracion.mostrar.direccion ? [clinica.direccion, clinica.comuna || clinica.ciudad, clinica.region].filter(Boolean).join(', ') : '',
    configuracion.mostrar.telefono ? clinica.telefono : '',
    configuracion.mostrar.email ? clinica.emailContacto : '',
    configuracion.mostrar.sitioWeb ? clinica.sitioWeb : '',
    configuracion.mostrar.registroSeremi ? clinica.registroSeremi : '',
    configuracion.mostrar.registroIsp ? clinica.registroIsp : '',
  ].map((linea) => linea?.trim()).filter((linea): linea is string => Boolean(linea))
  const nombre = configuracion.mostrar.nombre ? clinica.nombreClinica?.trim() : ''
  const identidad = (
    <>
      {logo && <img src={logo} alt="Logo de la clínica" className="max-h-14 max-w-36 object-contain" style={configuracion.logoMonocromatico ? { filter: 'grayscale(1)' } : undefined} />}
      {nombre && <p className="text-base font-bold" style={{ color: configuracion.colorTitulos }}>{nombre}</p>}
    </>
  )

  if (configuracion.diseno === 'minimalista') {
    return (
      <div className={`flex min-h-14 items-center justify-center gap-3 py-2 text-center ${className}`} style={{ color: configuracion.colorPrincipal }} aria-label="Membrete de la clínica">
        {identidad}
      </div>
    )
  }

  if (configuracion.diseno === 'moderno') {
    return (
      <div className={`border-b-2 pb-3 text-center ${className}`} style={{ borderColor: configuracion.colorLinea, color: configuracion.colorPrincipal }} aria-label="Membrete de la clínica">
        <div className="flex flex-col items-center gap-1">{identidad}</div>
        {lineas.length > 0 && <p className="mt-1 text-[10px]" style={{ color: configuracion.colorTextoSecundario }}>{lineas.join(' · ')}</p>}
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-between gap-4 border-b-2 pb-3 ${className}`} style={{ borderColor: configuracion.colorLinea, color: configuracion.colorPrincipal }} aria-label="Membrete de la clínica">
      <div className="flex min-w-0 items-center gap-3">{logo && <img src={logo} alt="Logo de la clínica" className="max-h-14 max-w-36 object-contain" style={configuracion.logoMonocromatico ? { filter: 'grayscale(1)' } : undefined} />}</div>
      <div className="min-w-0 text-right">
        {nombre && <p className="text-base font-bold" style={{ color: configuracion.colorTitulos }}>{nombre}</p>}
        {lineas.map((linea, index) => <p key={`${index}-${linea}`} className="text-[10px]" style={{ color: configuracion.colorTextoSecundario }}>{linea}</p>)}
      </div>
    </div>
  )
}
