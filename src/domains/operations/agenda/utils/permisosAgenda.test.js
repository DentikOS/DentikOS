import { describe, it, expect } from 'vitest'
import { PERMISOS_AGENDA, obtenerPermisosAgenda } from './permisosAgenda'

describe('permisosAgenda', () => {
  it('define matriz de permisos para los roles clave', () => {
    expect(PERMISOS_AGENDA.admin).toBeDefined()
    expect(PERMISOS_AGENDA.dentista).toBeDefined()
    expect(PERMISOS_AGENDA.asistente).toBeDefined()
    expect(PERMISOS_AGENDA.recepcion).toBeDefined()
  })

  it('admin tiene acceso total a citas y configuraciones', () => {
    const admin = PERMISOS_AGENDA.admin
    expect(admin.verTodasCitas).toBe(true)
    expect(admin.crearCitas).toBe(true)
    expect(admin.editarCitas).toBe(true)
    expect(admin.cancelarCitas).toBe(true)
    expect(admin.dragAndDrop).toBe(true)
    expect(admin.crearBloqueos).toBe(true)
    expect(admin.configurarHorariosSede).toBe(true)
  })

  it('dentista puede ver y gestionar sus citas pero no configurar sede', () => {
    const dentista = PERMISOS_AGENDA.dentista
    expect(dentista.verColumnaPropia).toBe(true)
    expect(dentista.crearCitas).toBe(true)
    expect(dentista.dragAndDrop).toBe(true)
    expect(dentista.configurarHorariosSede).toBe(false)
  })

  it('asistente tiene permisos de solo lectura y bloqueos pero no crea citas ni drag&drop', () => {
    const asistente = PERMISOS_AGENDA.asistente
    expect(asistente.crearCitas).toBe(false)
    expect(asistente.editarCitas).toBe(false)
    expect(asistente.dragAndDrop).toBe(false)
    expect(asistente.crearBloqueos).toBe(true)
  })

  it('recepción puede crear citas y drag&drop pero no detalles clínicos ni sede', () => {
    const recep = PERMISOS_AGENDA.recepcion
    expect(recep.crearCitas).toBe(true)
    expect(recep.dragAndDrop).toBe(true)
    expect(recep.verDetallesClinicos).toBe(false)
    expect(recep.configurarHorariosSede).toBe(false)
  })

  it('obtenerPermisosAgenda retorna rol recepcion como fallback seguro', () => {
    const rolInvalido = obtenerPermisosAgenda('rol_desconocido')
    expect(rolInvalido).toEqual(PERMISOS_AGENDA.recepcion)

    const rolNull = obtenerPermisosAgenda(undefined)
    expect(rolNull).toEqual(PERMISOS_AGENDA.recepcion)

    const rolAdmin = obtenerPermisosAgenda('ADMIN')
    expect(rolAdmin).toEqual(PERMISOS_AGENDA.admin)
  })
})
