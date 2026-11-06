import React, { useState } from 'react'
import { Award, Camera } from 'lucide-react'
import { FirmaDigitalCanvas } from './FirmaDigitalCanvas'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { PerfilUsuario } from '../../infrastructure/auth/authService'

export interface PerfilProfesionalData {
  numeroRegistroISP: string
  especialidad: string
  universidad?: string
  anioTitulacion?: number
  firmaDigital?: string
  fotoPerfil?: string
}

export interface PerfilProfesionalPremiumProps {
  userProfile: PerfilUsuario
  alCompletar: (perfil: PerfilProfesionalData) => void
  alSaltar?: () => void
}

const ESPECIALIDADES_DENTALES = [
  'Cirujano Dentista General',
  'Endodoncia',
  'Periodoncia',
  'Ortodoncia y Ortopedia Dento Maxilofacial',
  'Rehabilitación Oral',
  'Implantología Buco Maxilofacial',
  'Odontopediatría',
  'Cirugía Bucal y Maxilofacial',
  'Radiología Oral y Maxilofacial',
  'Otro',
]

const UNIVERSIDADES_CHILE = [
  'Universidad de Chile',
  'Pontificia Universidad Católica de Chile',
  'Universidad de Concepción',
  'Universidad de los Andes',
  'Universidad del Desarrollo',
  'Universidad Mayor',
  'Universidad Andrés Bello',
  'Universidad Austral de Chile',
  'Universidad de Valparaíso',
  'Universidad de Antofagasta',
]

export const PerfilProfesionalPremium: React.FC<PerfilProfesionalPremiumProps> = ({
  userProfile,
  alCompletar,
  alSaltar,
}) => {
  const [numeroISP, setNumeroISP] = useState('')
  const [especialidad, setEspecialidad] = useState(ESPECIALIDADES_DENTALES[0])
  const [otraEspecialidad, setOtraEspecialidad] = useState('')
  const [universidad, setUniversidad] = useState('')
  const [anioTitulacion, setAnioTitulacion] = useState('')
  const [firmaDigital, setFirmaDigital] = useState<string>('')
  const [fotoPerfil, setFotoPerfil] = useState<string>('')
  const [errorISP, setErrorISP] = useState<string | null>(null)

  const handleValidarISP = (valor: string) => {
    setNumeroISP(valor)
    if (!valor.trim()) {
      setErrorISP('El N° de Registro ISP es obligatorio.')
    } else if (valor.trim().length < 4) {
      setErrorISP('El registro debe contener al menos 4 dígitos.')
    } else {
      setErrorISP(null)
    }
  }

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setFotoPerfil(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!numeroISP.trim() || numeroISP.trim().length < 4) {
      setErrorISP('Ingresa un N° de Registro ISP válido.')
      return
    }

    const especialidadFinal = especialidad === 'Otro' ? otraEspecialidad.trim() || 'Cirujano Dentista' : especialidad

    alCompletar({
      numeroRegistroISP: numeroISP.trim(),
      especialidad: especialidadFinal,
      universidad: universidad.trim() || undefined,
      anioTitulacion: anioTitulacion ? parseInt(anioTitulacion, 10) : undefined,
      firmaDigital: firmaDigital || undefined,
      fotoPerfil: fotoPerfil || undefined,
    })
  }

  const especialidadAMostrar = especialidad === 'Otro' ? otraEspecialidad || 'Odontólogo' : especialidad

  return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-4 text-white">
      <div className="max-w-3xl w-full bg-[#0B132B] border border-[#24334A] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-3 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37]">
            <Award size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Perfil Profesional Quirúrgico</h1>
            <p className="text-xs text-slate-400">
              Configura tus credenciales oficiales de salud para emitir recetas y consentimientos informados.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Foto y N° ISP */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {fotoPerfil ? (
                    <img src={fotoPerfil} alt="Foto perfil" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={20} className="text-slate-400" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-[#D4AF37] font-semibold cursor-pointer hover:underline block">
                    <span>Subir foto profesional</span>
                    <input type="file" accept="image/*" onChange={handleFotoUpload} className="hidden" />
                  </label>
                  <span className="text-[10px] text-slate-500">JPG o PNG (opcional)</span>
                </div>
              </div>

              <div>
                <Input
                  label="N° Registro ISP / Super. de Salud *"
                  id="reg-isp"
                  required
                  value={numeroISP}
                  onChange={(e) => handleValidarISP(e.target.value)}
                  placeholder="Ej: 123456"
                  error={errorISP || undefined}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Especialidad Clínica *</label>
                <select
                  value={especialidad}
                  onChange={(e) => setEspecialidad(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-700 bg-slate-900 text-white focus:ring-1 focus:ring-[#D4AF37]"
                >
                  {ESPECIALIDADES_DENTALES.map((esp) => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                </select>
                {especialidad === 'Otro' && (
                  <input
                    type="text"
                    required
                    placeholder="Especificar especialidad..."
                    value={otraEspecialidad}
                    onChange={(e) => setOtraEspecialidad(e.target.value)}
                    className="w-full mt-2 p-2 text-xs rounded-xl border border-slate-700 bg-slate-900 text-white"
                  />
                )}
              </div>
            </div>

            {/* Universidad y año */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Universidad de Egreso</label>
                <input
                  type="text"
                  list="universidades-lista"
                  value={universidad}
                  onChange={(e) => setUniversidad(e.target.value)}
                  placeholder="Ej: Universidad de Chile"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-700 bg-slate-900 text-white focus:ring-1 focus:ring-[#D4AF37]"
                />
                <datalist id="universidades-lista">
                  {UNIVERSIDADES_CHILE.map((u) => <option key={u} value={u} />)}
                </datalist>
              </div>

              <div>
                <Input
                  label="Año de Titulación"
                  id="anio-titulacion"
                  type="number"
                  value={anioTitulacion}
                  onChange={(e) => setAnioTitulacion(e.target.value)}
                  placeholder="Ej: 2018"
                />
              </div>

              {/* Vista previa en vivo del sello oficial */}
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] block">
                  Vista Previa en Documentos Oficiales
                </span>
                <p className="font-bold text-white text-sm">{userProfile.nombreCompleto || 'Dr. Profesional'}</p>
                <p className="text-slate-300">{especialidadAMostrar}</p>
                <p className="text-slate-400 text-[11px]">
                  Reg. ISP / SIS: <span className="font-mono text-white">{numeroISP || '______'}</span>
                </p>
                {universidad && <p className="text-[10px] text-slate-500">{universidad}</p>}
              </div>
            </div>
          </div>

          {/* Firma digital con 3 modos */}
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <label className="block text-xs font-semibold text-slate-300">
              Firma Digital para Recetas y Certificados (3 modos disponibles)
            </label>
            <FirmaDigitalCanvas alGuardarFirma={(dataUrl) => setFirmaDigital(dataUrl)} />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            {alSaltar ? (
              <Button type="button" variant="ghost" size="sm" onClick={alSaltar} className="text-xs text-slate-400">
                Saltar por ahora
              </Button>
            ) : <div />}

            <Button type="submit" size="md" className="text-xs font-semibold">
              Guardar Perfil Profesional
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
