import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ModalDoctorAusente } from './ModalDoctorAusente'

describe('ModalDoctorAusente (Limpieza de UI)', () => {
  it('NO expone texto técnico interno (BP05, Blueprint, CEO)', () => {
    render(
      <ModalDoctorAusente
        isOpen={true}
        doctoresDisponibles={[]}
        citasActuales={[]}
        alCerrar={() => {}}
        alProcesar={() => {}}
      />
    )

    const modal = screen.getByRole('dialog')
    const contenido = modal.textContent || ''

    expect(contenido).not.toContain('BP05')
    expect(contenido).not.toContain('Blueprint')
    expect(contenido).not.toContain('F4:')
    expect(contenido).not.toContain('CEO')
    expect(contenido).toContain('Importante:')
  })
})
