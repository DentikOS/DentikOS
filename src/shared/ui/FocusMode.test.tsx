import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { FocusMode } from './FocusMode'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

describe('FocusMode (Blueprint 03 §09)', () => {
  beforeEach(() => {
    useSidebarStore.setState({ focusMode: false })
  })

  it('permanece como marcador lógico retornando null con focusMode en false', () => {
    const { container } = render(<FocusMode />)
    expect(container.firstChild).toBeNull()
  })

  it('permanece como marcador lógico retornando null con focusMode en true', () => {
    useSidebarStore.setState({ focusMode: true })
    const { container } = render(<FocusMode />)
    expect(container.firstChild).toBeNull()
  })
})
