export interface ResultadoValidacionAlergia {
  contraindicado: boolean
  medicamentoConflictivo?: string
  mensaje?: string
}

export const validarAlergiasMedicamentos = (
  medicamentos: string[],
  alergias: string | string[] | undefined
): ResultadoValidacionAlergia => {
  if (!alergias || medicamentos.length === 0) return { contraindicado: false }
  const txt = Array.isArray(alergias) ? alergias.join(' ').toLowerCase() : alergias.toLowerCase()
  if (txt.includes('penicil')) {
    const penicilinas = ['amoxicilina', 'ampicilina', 'penicilina', 'cloxacilina', 'piperacilina']
    for (const med of medicamentos) {
      if (penicilinas.some((p) => med.toLowerCase().includes(p))) {
        return {
          contraindicado: true,
          medicamentoConflictivo: med,
          mensaje: `¡BLOQUEO DE SEGURIDAD! Fármaco "${med}" contraindicado por alergia a penicilinas.`,
        }
      }
    }
  }
  return { contraindicado: false }
}

export const debePreguntarEmbarazo = (paciente: {
  sexo?: string | null
  genero?: string | null
  edad?: string | number | null
  embarazo?: boolean | null
}): boolean => {
  const sexo = String(paciente.sexo || paciente.genero || '').toLowerCase()
  const esFem = sexo === 'femenino' || sexo === 'f' || sexo === 'mujer'
  const edad = Number(paciente.edad) || 0
  return esFem && edad >= 12 && edad <= 55 && (paciente.embarazo === undefined || paciente.embarazo === null)
}

export const validarAnticoagulantesCirugia = (
  anticoagulantes: boolean,
  esProcedimientoQuirurgico: boolean
): { alertaQuirurgica: boolean; mensaje?: string } => ({
  alertaQuirurgica: Boolean(anticoagulantes && esProcedimientoQuirurgico),
  mensaje: anticoagulantes && esProcedimientoQuirurgico
    ? '¡ALERTA CRÍTICA! Paciente anticoagulado programado para cirugía. Verificar suspensión médica.'
    : undefined,
})
