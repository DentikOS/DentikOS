import { describe, it, expect } from 'vitest'
import { 
  PERMISOS_AGENDA, 
  puedeEditarCita, 
  puedeCancelarCita, 
  puedeArrastrarCita,
  puedeCrearBloqueo,
  obtenerPermisosAgenda
} from './permisosAgenda'

describe('permisosAgenda (BP05 §09)', () => {
  describe('Matriz de permisos', () => {
    it('admin tiene todos los permisos', () => {
      const permisos = PERMISOS_AGENDA.admin
      expect(permisos.verTodasCitas).toBe(true)
      expect(permisos.crearCitas).toBe(true)
      expect(permisos.editarCitas).toBe(true)
      expect(permisos.editarCitasEsterilizacion).toBe(true)
      expect(permisos.cancelarCitas).toBe(true)
      expect(permisos.dragAndDrop).toBe(true)
      expect(permisos.crearBloqueos).toBe(true)
      expect(permisos.gestionarDiasFestivos).toBe(true)
      expect(permisos.gestionarDoctoresAusentes).toBe(true)
    })

    it('dentista solo puede editar sus propias citas', () => {
      const permisos = PERMISOS_AGENDA.dentista
      expect(permisos.editarCitasPropias).toBe(true)
      expect(permisos.editarCitasEsterilizacion).toBe(false)
      expect(permisos.cancelarCitasPropias).toBe(true)
      expect(permisos.dragAndDropPropio).toBe(true)
      expect(permisos.crearBloqueosPersonales).toBe(true)
    })

    it('asistente puede editar citas de esterilización pero no citas normales', () => {
      const permisos = PERMISOS_AGENDA.asistente
      expect(permisos.editarCitasEsterilizacion).toBe(true)
      expect(permisos.editarCitas).toBe(false)
      expect(permisos.cancelarCitas).toBe(false)
      expect(permisos.dragAndDrop).toBe(false)
    })

    it('asistente puede crear bloqueos de mantenimiento', () => {
      const permisos = PERMISOS_AGENDA.asistente
      expect(permisos.crearBloqueos).toBe(true)
      expect(permisos.crearBloqueosPersonales).toBe(false)
    })

    it('recepción puede crear citas y drag&drop pero no bloqueos ni detalles clínicos', () => {
      const permisos = PERMISOS_AGENDA.recepcion
      expect(permisos.crearCitas).toBe(true)
      expect(permisos.dragAndDrop).toBe(true)
      expect(permisos.crearBloqueos).toBe(false)
      expect(permisos.verDetallesClinicos).toBe(false)
    })

    it('obtenerPermisosAgenda hace fallback seguro a recepcion', () => {
      expect(obtenerPermisosAgenda()).toEqual(PERMISOS_AGENDA.recepcion)
      expect(obtenerPermisosAgenda('desconocido')).toEqual(PERMISOS_AGENDA.recepcion)
      expect(obtenerPermisosAgenda('ADMIN')).toEqual(PERMISOS_AGENDA.admin)
    })
  })

  describe('puedeEditarCita', () => {
    it('dentista puede editar sus propias citas', () => {
      const permisos = PERMISOS_AGENDA.dentista
      const citaPropia = { doctor: 'doc-1' }
      
      expect(puedeEditarCita(permisos, citaPropia, 'user-1', 'doc-1')).toBe(true)
    })

    it('dentista NO puede editar citas de otros doctores', () => {
      const permisos = PERMISOS_AGENDA.dentista
      const citaAjena = { doctor: 'doc-2' }
      
      expect(puedeEditarCita(permisos, citaAjena, 'user-1', 'doc-1')).toBe(false)
    })

    it('dentista NO puede editar bloqueos de esterilización', () => {
      const permisos = PERMISOS_AGENDA.dentista
      const citaEsterilizacion = { esBloqueo: true, motivoBloqueo: 'Esterilización autoclave' }
      
      expect(puedeEditarCita(permisos, citaEsterilizacion, 'user-1', 'doc-1')).toBe(false)
    })

    it('asistente SÍ puede editar bloqueos de esterilización', () => {
      const permisos = PERMISOS_AGENDA.asistente
      const citaEsterilizacion = { esBloqueo: true, motivoBloqueo: 'Esterilización autoclave' }
      
      expect(puedeEditarCita(permisos, citaEsterilizacion, 'user-1', 'doc-1')).toBe(true)
    })

    it('admin puede editar cualquier cita', () => {
      const permisos = PERMISOS_AGENDA.admin
      const citaAjena = { doctor: 'doc-2' }
      const citaEsterilizacion = { esBloqueo: true, motivoBloqueo: 'Esterilización' }
      
      expect(puedeEditarCita(permisos, citaAjena, 'user-1', 'doc-1')).toBe(true)
      expect(puedeEditarCita(permisos, citaEsterilizacion, 'user-1', 'doc-1')).toBe(true)
    })

    it('admin puede editar CUALQUIER cita (propias y ajenas)', () => {
      const permisos = PERMISOS_AGENDA.admin
      const citaAjena = { doctor: 'doc-999' }
      
      expect(puedeEditarCita(permisos, citaAjena, 'admin-user-1', 'admin-user-1')).toBe(true)
      expect(puedeCancelarCita(permisos, citaAjena, 'admin-user-1', 'admin-user-1')).toBe(true)
      expect(puedeArrastrarCita(permisos, citaAjena, 'admin-user-1', 'admin-user-1')).toBe(true)
    })

    it('recepcionista puede editar CUALQUIER cita', () => {
      const permisos = PERMISOS_AGENDA.recepcion
      const citaAjena = { doctor: 'doc-999' }
      
      expect(puedeEditarCita(permisos, citaAjena, 'recep-user-1', 'recep-user-1')).toBe(true)
    })
  })

  describe('puedeCancelarCita', () => {
    it('dentista solo puede cancelar sus propias citas', () => {
      const permisos = PERMISOS_AGENDA.dentista
      const citaPropia = { doctor: 'doc-1' }
      const citaAjena = { doctor: 'doc-2' }

      expect(puedeCancelarCita(permisos, citaPropia, 'user-1', 'doc-1')).toBe(true)
      expect(puedeCancelarCita(permisos, citaAjena, 'user-1', 'doc-1')).toBe(false)
    })

    it('asistente NO puede cancelar citas', () => {
      const permisos = PERMISOS_AGENDA.asistente
      const cita = { doctor: 'doc-1' }

      expect(puedeCancelarCita(permisos, cita, 'user-1', 'doc-1')).toBe(false)
    })

    it('admin puede cancelar cualquier cita', () => {
      const permisos = PERMISOS_AGENDA.admin
      const citaAjena = { doctor: 'doc-2' }

      expect(puedeCancelarCita(permisos, citaAjena, 'user-1', 'doc-1')).toBe(true)
    })
  })

  describe('puedeArrastrarCita', () => {
    it('dentista solo puede arrastrar sus propias citas', () => {
      const permisos = PERMISOS_AGENDA.dentista
      const citaPropia = { doctor: 'doc-1' }
      const citaAjena = { doctor: 'doc-2' }
      
      expect(puedeArrastrarCita(permisos, citaPropia, 'user-1', 'doc-1')).toBe(true)
      expect(puedeArrastrarCita(permisos, citaAjena, 'user-1', 'doc-1')).toBe(false)
    })

    it('asistente NO puede arrastrar citas', () => {
      const permisos = PERMISOS_AGENDA.asistente
      const cita = { doctor: 'doc-1' }
      
      expect(puedeArrastrarCita(permisos, cita, 'user-1', 'doc-1')).toBe(false)
    })

    it('admin puede arrastrar cualquier cita', () => {
      const permisos = PERMISOS_AGENDA.admin
      const cita = { doctor: 'doc-1' }

      expect(puedeArrastrarCita(permisos, cita, 'user-1', 'doc-1')).toBe(true)
    })
  })

  describe('puedeCrearBloqueo', () => {
    it('asistente puede crear bloqueos de mantenimiento', () => {
      const permisos = PERMISOS_AGENDA.asistente
      expect(puedeCrearBloqueo(permisos, 'Mantenimiento')).toBe(true)
    })

    it('recepcionista NO puede crear bloqueos', () => {
      const permisos = PERMISOS_AGENDA.recepcion
      expect(puedeCrearBloqueo(permisos, 'Almuerzo')).toBe(false)
    })

    it('dentista puede crear bloqueos personales', () => {
      const permisos = PERMISOS_AGENDA.dentista
      expect(puedeCrearBloqueo(permisos, 'Almuerzo')).toBe(true)
    })
  })

  describe('puedeEditarCita - comparación por nombre (FIX-4)', () => {
    it('dentista puede editar cita cuando cita.doctor coincide con userProfile.nombreCompleto', () => {
      const permisos = PERMISOS_AGENDA.dentista
      const cita = { doctor: 'Dr. Miguel Díaz' }
      const userProfile = {
        id: 'user-1',
        nombreCompleto: 'Dr. Miguel Díaz',
        nombre: 'Miguel',
        rol: 'dentista'
      }
      
      expect(puedeEditarCita(permisos, cita, userProfile)).toBe(true)
    })

    it('dentista NO puede editar cita de otro doctor (nombre distinto)', () => {
      const permisos = PERMISOS_AGENDA.dentista
      const cita = { doctor: 'Dra. Carolina Soto' }
      const userProfile = {
        id: 'user-1',
        nombreCompleto: 'Dr. Miguel Díaz',
        nombre: 'Miguel',
        rol: 'dentista'
      }
      
      expect(puedeEditarCita(permisos, cita, userProfile)).toBe(false)
    })

    it('admin puede editar CUALQUIER cita independientemente del nombre', () => {
      const permisos = PERMISOS_AGENDA.admin
      const cita = { doctor: 'Dr. Ajeno' }
      const userProfile = {
        id: 'admin-1',
        nombreCompleto: 'Dueño de Clínica',
        rol: 'admin'
      }
      
      expect(puedeEditarCita(permisos, cita, userProfile)).toBe(true)
    })

    it('admin puede editar cita sin doctor asignado', () => {
      const permisos = PERMISOS_AGENDA.admin
      const cita = { doctor: undefined }
      const userProfile = {
        id: 'admin-1',
        nombreCompleto: 'Dueño',
        rol: 'admin'
      }
      
      expect(puedeEditarCita(permisos, cita, userProfile)).toBe(true)
    })

    it('recepcionista puede editar cualquier cita', () => {
      const permisos = PERMISOS_AGENDA.recepcion
      const cita = { doctor: 'Dr. Ajeno' }
      const userProfile = {
        id: 'recep-1',
        nombreCompleto: 'Recepcionista',
        rol: 'recepcion'
      }
      
      expect(puedeEditarCita(permisos, cita, userProfile)).toBe(true)
    })

    it('usePermisosAgenda acepta variaciones del rol admin', () => {
      const rolesAdmin = ['admin', 'Admin', 'ADMIN', 'dueño', 'dueno', 'owner', 'administrador']
      rolesAdmin.forEach(rol => {
        const permisos = obtenerPermisosAgenda(rol)
        expect(permisos.editarCitasPropias).toBeUndefined() // Admin: sin restricción
        expect(permisos.gestionarDiasFestivos).toBe(true) // Admin: puede festivos
      })
    })
  })
})
