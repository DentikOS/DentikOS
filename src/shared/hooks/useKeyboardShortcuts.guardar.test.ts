import { describe, it, expect, beforeEach } from 'vitest'
import { useTopBarStore } from '../../app/stores/useTopBarStore'

describe('⌘S Guardar cambios (BP03 §08)', () => {
  beforeEach(() => {
    useTopBarStore.setState({ isDirty: false, savedAt: null })
  })

  it('listener de guardar_cambios llama a markSaved cuando isDirty es true', () => {
    // Simular estado dirty
    useTopBarStore.setState({ isDirty: true })

    // Simular que el listener está registrado (como en App.tsx)
    const handleGuardarCambios = () => {
      const { isDirty, markSaved } = useTopBarStore.getState()
      if (isDirty) {
        markSaved()
      }
    }

    // Disparar evento
    handleGuardarCambios()

    // Verificar que markSaved fue llamado
    const state = useTopBarStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.savedAt).toBeTruthy()
  })

  it('listener no hace nada si isDirty es false', () => {
    useTopBarStore.setState({ isDirty: false, savedAt: null })

    const handleGuardarCambios = () => {
      const { isDirty, markSaved } = useTopBarStore.getState()
      if (isDirty) {
        markSaved()
      }
    }

    handleGuardarCambios()

    const state = useTopBarStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.savedAt).toBeNull()
  })

  it('reacciona a CustomEvent guardar_cambios registrado en window', () => {
    useTopBarStore.setState({ isDirty: true })

    const listener = () => {
      const { isDirty, markSaved } = useTopBarStore.getState()
      if (isDirty) {
        markSaved()
      }
    }

    window.addEventListener('guardar_cambios', listener)
    window.dispatchEvent(new CustomEvent('guardar_cambios'))
    window.removeEventListener('guardar_cambios', listener)

    const state = useTopBarStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.savedAt).toBeTruthy()
  })
})
