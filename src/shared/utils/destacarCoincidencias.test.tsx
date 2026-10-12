import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { destacarCoincidencias } from './destacarCoincidencias'

describe('destacarCoincidencias', () => {
  it('retorna el texto intacto si la búsqueda está vacía', () => {
    const { container } = render(<div>{destacarCoincidencias('Juan Perez', '')}</div>)
    expect(container.textContent).toBe('Juan Perez')
    expect(container.querySelector('mark')).toBeNull()
  })

  it('resalta la coincidencia en amarillo dentro de un elemento mark', () => {
    const { container } = render(<div>{destacarCoincidencias('Camila Silva', 'Camila')}</div>)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe('Camila')
    expect(mark?.className).toContain('bg-yellow-200')
    expect(container.textContent).toContain('Camila Silva')
  })

  it('soporta búsquedas insensible a mayúsculas y minúsculas', () => {
    const { container } = render(<div>{destacarCoincidencias('Carlos Mendoza', 'carlos')}</div>)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe('Carlos')
  })

  it('escapa caracteres especiales en la expresión regular', () => {
    const { container } = render(<div>{destacarCoincidencias('Doctor (Dr.) Silva', '(Dr.)')}</div>)
    const mark = container.querySelector('mark')
    expect(mark).not.toBeNull()
    expect(mark?.textContent).toBe('(Dr.)')
  })
})
