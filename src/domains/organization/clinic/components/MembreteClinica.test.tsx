import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MembreteClinica } from './MembreteClinica'
import { normalizarConfiguracionMembrete } from '../schemas/configuracionMembreteSchema'

describe('MembreteClinica', () => {
  it('muestra los datos seleccionados con el diseño clásico', () => {
    render(<MembreteClinica clinica={{
      nombreClinica: 'Clínica Central', rutClinica: '76.123.456-7', direccion: 'Av. Central 100',
      comuna: 'Providencia', telefono: '+56 9 1234 5678',
      configuracionMembrete: normalizarConfiguracionMembrete({ diseno: 'clasico', mostrar: { email: true } }),
    }} />)

    expect(screen.getByText('Clínica Central')).toBeInTheDocument()
    expect(screen.getByText('76.123.456-7')).toBeInTheDocument()
    expect(screen.getByText('Av. Central 100, Providencia')).toBeInTheDocument()
  })

  it('el diseño minimalista no filtra datos adicionales de la clínica', () => {
    render(<MembreteClinica clinica={{
      nombreClinica: 'Clínica Minimal', rutClinica: '76.123.456-7', direccion: 'Av. Central 100',
      configuracionMembrete: normalizarConfiguracionMembrete({ diseno: 'minimalista' }),
    }} />)

    expect(screen.getByText('Clínica Minimal')).toBeInTheDocument()
    expect(screen.queryByText('76.123.456-7')).not.toBeInTheDocument()
    expect(screen.queryByText('Av. Central 100')).not.toBeInTheDocument()
  })
})
