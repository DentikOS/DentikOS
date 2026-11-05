import { beforeEach, describe, expect, it, vi } from 'vitest'
import { persistenceStorageService } from './services/persistenceStorageService'

const CLINICA_ACTIVA = 'clinic-a'
const CLINICA_SECUNDARIA = 'clinic-b'

const activarClinica = (clinicaId = CLINICA_ACTIVA): void => {
  localStorage.setItem('clinica_active_user', 'admin@example.test')
  localStorage.setItem('profile_admin@example.test', JSON.stringify({ clinicaId }))
}

describe('persistenceStorageService', () => {
  beforeEach(() => {
    localStorage.clear()
    activarClinica()
  })

  it('exporta solo claves de la clínica activa y omite sesión y otras clínicas', () => {
    localStorage.setItem(`sd_${CLINICA_ACTIVA}_studio_dental_pacientes_v3`, '[{"id":"p-1"}]')
    localStorage.setItem(`sd_${CLINICA_SECUNDARIA}_studio_dental_pacientes_v3`, '[{"id":"p-2"}]')
    localStorage.setItem('sb-project-auth-token', '{"access_token":"secret"}')
    localStorage.setItem('otra_aplicacion', 'preservar')

    const backup = persistenceStorageService.exportarBaseDeDatosCompleta()

    expect(backup.versionBackup).toBe(2)
    expect(backup.clinicaId).toBe(CLINICA_ACTIVA)
    expect(backup.localStorageData).toEqual({
      [`sd_${CLINICA_ACTIVA}_studio_dental_pacientes_v3`]: '[{"id":"p-1"}]'
    })
  })

  it('no exporta sin clínica activa', () => {
    localStorage.removeItem('clinica_active_user')

    expect(() => persistenceStorageService.exportarBaseDeDatosCompleta())
      .toThrow('Selecciona una clínica activa antes de crear un respaldo.')
  })

  it('restaura solo la clínica indicada y conserva sesión, otros tenants y claves externas', () => {
    const claveActual = `sd_${CLINICA_ACTIVA}_actual`
    const claveAntigua = `sd_${CLINICA_ACTIVA}_obsoleta`
    const claveOtraClinica = `sd_${CLINICA_SECUNDARIA}_pacientes`
    localStorage.setItem(claveActual, 'antes')
    localStorage.setItem(claveAntigua, 'se elimina')
    localStorage.setItem(claveOtraClinica, 'no cambia')
    localStorage.setItem('sb-project-auth-token', 'sesion')
    localStorage.setItem('otra_aplicacion', 'externa')

    persistenceStorageService.importarBaseDeDatosCompleta({
      versionSystem: '3.0.0',
      versionBackup: 2,
      fechaExportacion: new Date().toISOString(),
      clinicaId: CLINICA_ACTIVA,
      localStorageData: { [claveActual]: 'restaurado', [`sd_${CLINICA_ACTIVA}_nuevo`]: 'nuevo' }
    })

    expect(localStorage.getItem(claveActual)).toBe('restaurado')
    expect(localStorage.getItem(claveAntigua)).toBeNull()
    expect(localStorage.getItem(`sd_${CLINICA_ACTIVA}_nuevo`)).toBe('nuevo')
    expect(localStorage.getItem(claveOtraClinica)).toBe('no cambia')
    expect(localStorage.getItem('sb-project-auth-token')).toBe('sesion')
    expect(localStorage.getItem('clinica_active_user')).toBe('admin@example.test')
    expect(localStorage.getItem('otra_aplicacion')).toBe('externa')
  })

  it('rechaza respaldos v2 de otro tenant sin modificar datos', () => {
    const clave = `sd_${CLINICA_ACTIVA}_pacientes`
    localStorage.setItem(clave, 'actual')

    expect(() => persistenceStorageService.importarBaseDeDatosCompleta({
      versionSystem: '3.0.0',
      versionBackup: 2,
      fechaExportacion: new Date().toISOString(),
      clinicaId: CLINICA_SECUNDARIA,
      localStorageData: { [`sd_${CLINICA_SECUNDARIA}_pacientes`]: 'ajeno' }
    })).toThrow('Este respaldo pertenece a otra clínica.')

    expect(localStorage.getItem(clave)).toBe('actual')
    expect(localStorage.getItem(`sd_${CLINICA_SECUNDARIA}_pacientes`)).toBeNull()
  })

  it('acepta respaldos antiguos filtrando entradas de otros tenants y de sesión', () => {
    const actual = `sd_${CLINICA_ACTIVA}_pacientes`
    const otra = `sd_${CLINICA_SECUNDARIA}_pacientes`
    localStorage.setItem(actual, 'antes')
    localStorage.setItem(otra, 'conservar')

    persistenceStorageService.importarBaseDeDatosCompleta({
      versionSystem: '3.0.0',
      fechaExportacion: new Date().toISOString(),
      localStorageData: {
        [actual]: 'restaurado',
        [otra]: 'no importar',
        'sb-project-auth-token': 'no importar'
      }
    })

    expect(localStorage.getItem(actual)).toBe('restaurado')
    expect(localStorage.getItem(otra)).toBe('conservar')
    expect(localStorage.getItem('sb-project-auth-token')).toBeNull()
  })

  it('revierte los cambios locales si falla una escritura durante la restauración', () => {
    const actual = `sd_${CLINICA_ACTIVA}_actual`
    const nuevo = `sd_${CLINICA_ACTIVA}_nuevo`
    localStorage.setItem(actual, 'antes')
    const setItemOriginal = Storage.prototype.setItem
    let debeFallar = true
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === nuevo && debeFallar) {
        debeFallar = false
        throw new DOMException('storage quota exceeded', 'QuotaExceededError')
      }
      return setItemOriginal.call(this, key, value)
    })

    expect(() => persistenceStorageService.importarBaseDeDatosCompleta({
      versionSystem: '3.0.0',
      versionBackup: 2,
      fechaExportacion: new Date().toISOString(),
      clinicaId: CLINICA_ACTIVA,
      localStorageData: { [nuevo]: 'valor nuevo' }
    })).toThrow('No se pudo restaurar el respaldo.')

    expect(localStorage.getItem(actual)).toBe('antes')
    expect(localStorage.getItem(nuevo)).toBeNull()
    setItem.mockRestore()
  })
})
