export type DisenoMembrete = 'clasico' | 'moderno' | 'minimalista'

export interface ConfiguracionMembrete {
  diseno: DisenoMembrete
  colorPrincipal: string
  colorLinea: string
  colorTitulos: string
  colorTextoSecundario: string
  logoMonocromatico: boolean
  mostrar: {
    logo: boolean
    nombre: boolean
    rut: boolean
    direccion: boolean
    telefono: boolean
    email: boolean
    sitioWeb: boolean
    registroSeremi: boolean
    registroIsp: boolean
  }
}

export const CONFIGURACION_MEMBRETE_DEFAULT: ConfiguracionMembrete = {
  diseno: 'clasico',
  colorPrincipal: '#0F172A',
  colorLinea: '#B88E3A',
  colorTitulos: '#0F172A',
  colorTextoSecundario: '#64748B',
  logoMonocromatico: false,
  mostrar: {
    logo: true,
    nombre: true,
    rut: true,
    direccion: true,
    telefono: true,
    email: false,
    sitioWeb: false,
    registroSeremi: false,
    registroIsp: false,
  },
}

const COLOR_HEX_RE = /^#[0-9A-Fa-f]{6}$/
const DISENOS_MEMBRETE: DisenoMembrete[] = ['clasico', 'moderno', 'minimalista']
const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor)

const normalizarColor = (valor: unknown, defecto: string): string =>
  typeof valor === 'string' && COLOR_HEX_RE.test(valor) ? valor.toUpperCase() : defecto

export const normalizarConfiguracionMembrete = (valor: unknown): ConfiguracionMembrete => {
  const entrada = esObjeto(valor) ? valor : {}
  const mostrarEntrada = esObjeto(entrada.mostrar) ? entrada.mostrar : {}

  return {
    diseno: DISENOS_MEMBRETE.includes(entrada.diseno as DisenoMembrete)
      ? entrada.diseno as DisenoMembrete
      : CONFIGURACION_MEMBRETE_DEFAULT.diseno,
    colorPrincipal: normalizarColor(entrada.colorPrincipal, CONFIGURACION_MEMBRETE_DEFAULT.colorPrincipal),
    colorLinea: normalizarColor(entrada.colorLinea, CONFIGURACION_MEMBRETE_DEFAULT.colorLinea),
    colorTitulos: normalizarColor(entrada.colorTitulos, CONFIGURACION_MEMBRETE_DEFAULT.colorTitulos),
    colorTextoSecundario: normalizarColor(entrada.colorTextoSecundario, CONFIGURACION_MEMBRETE_DEFAULT.colorTextoSecundario),
    logoMonocromatico: typeof entrada.logoMonocromatico === 'boolean'
      ? entrada.logoMonocromatico
      : CONFIGURACION_MEMBRETE_DEFAULT.logoMonocromatico,
    mostrar: {
      logo: typeof mostrarEntrada.logo === 'boolean' ? mostrarEntrada.logo : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.logo,
      nombre: typeof mostrarEntrada.nombre === 'boolean' ? mostrarEntrada.nombre : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.nombre,
      rut: typeof mostrarEntrada.rut === 'boolean' ? mostrarEntrada.rut : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.rut,
      direccion: typeof mostrarEntrada.direccion === 'boolean' ? mostrarEntrada.direccion : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.direccion,
      telefono: typeof mostrarEntrada.telefono === 'boolean' ? mostrarEntrada.telefono : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.telefono,
      email: typeof mostrarEntrada.email === 'boolean' ? mostrarEntrada.email : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.email,
      sitioWeb: typeof mostrarEntrada.sitioWeb === 'boolean' ? mostrarEntrada.sitioWeb : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.sitioWeb,
      registroSeremi: typeof mostrarEntrada.registroSeremi === 'boolean' ? mostrarEntrada.registroSeremi : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.registroSeremi,
      registroIsp: typeof mostrarEntrada.registroIsp === 'boolean' ? mostrarEntrada.registroIsp : CONFIGURACION_MEMBRETE_DEFAULT.mostrar.registroIsp,
    },
  }
}
