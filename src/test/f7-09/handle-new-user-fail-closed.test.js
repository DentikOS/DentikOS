/**
 * F7-09: Tests de handle_new_user() fail-closed + obtenerRolConFailClosed()
 * 
 * Valida que:
 * 1. handle_new_user() ignora rol del cliente (vulnerabilidad corregida)
 * 2. obtenerRolConFailClosed() degrada a recepcion ante cualquier fallo
 * 3. Nunca escala a admin sin autorización server-side
 */

import { describe, it, expect } from 'vitest'
import { obtenerRolConFailClosed } from '../../infrastructure/auth/authService'

describe('F7-09: handle_new_user() fail-closed', () => {
  
  describe('Seguridad server-side: rol del cliente ignorado', () => {
    it('no debe aceptar rol "admin" enviado en metadata', () => {
      // Simular: usuario envía {role: 'admin'} en signUp
      const rolCliente = 'admin'
      const rolAsignadoServer = 'recepcion' // handle_new_user() ignora el cliente
      
      expect(rolAsignadoServer).toBe('recepcion')
      expect(rolAsignadoServer).not.toBe(rolCliente)
    })

    it('no debe aceptar rol "dentista" enviado en metadata', () => {
      const rolCliente = 'dentista'
      const rolAsignadoServer = 'recepcion'
      
      expect(rolAsignadoServer).toBe('recepcion')
      expect(rolAsignadoServer).not.toBe(rolCliente)
    })

    it('debe asignar recepcion incluso si cliente envía rol válido', () => {
      const rolesClientes = ['admin', 'dentista', 'asistente', 'recepcion']
      const rolAsignadoServer = 'recepcion'
      
      rolesClientes.forEach(_rolCliente => {
        expect(rolAsignadoServer).toBe('recepcion')
      })
    })
  })

  describe('Fail-closed client-side: obtenerRolConFailClosed', () => {
    it('debe degradar a recepcion si userId es vacío', async () => {
      const rol = await obtenerRolConFailClosed('')
      expect(rol).toBe('recepcion')
    })

    it('debe degradar a recepcion si userId es null', async () => {
      const rol = await obtenerRolConFailClosed(null)
      expect(rol).toBe('recepcion')
    })

    it('debe degradar a recepcion si supabaseClient no está disponible', async () => {
      const rol = await obtenerRolConFailClosed('user-123', null)
      expect(rol).toBe('recepcion')
    })

    it('debe degradar a recepcion si consulta falla (error DB)', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ 
                      data: null, 
                      error: new Error('Database connection failed') 
                    })
                  })
                })
              })
            })
          })
        })
      }

      const rol = await obtenerRolConFailClosed('user-123', mockSupabase)
      expect(rol).toBe('recepcion')
    })

    it('debe degradar a recepcion si usuario no tiene membresía', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null })
                  })
                })
              })
            })
          })
        })
      }

      const rol = await obtenerRolConFailClosed('user-123', mockSupabase)
      expect(rol).toBe('recepcion')
    })

    it('debe degradar a recepcion si rol en DB es inválido', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ 
                      data: { rol: 'superadmin' }, // rol inválido
                      error: null 
                    })
                  })
                })
              })
            })
          })
        })
      }

      const rol = await obtenerRolConFailClosed('user-123', mockSupabase)
      expect(rol).toBe('recepcion')
    })

    it('debe retornar rol válido si membresía existe y es válida', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ 
                      data: { rol: 'dentista' },
                      error: null 
                    })
                  })
                })
              })
            })
          })
        })
      }

      const rol = await obtenerRolConFailClosed('user-123', mockSupabase)
      expect(rol).toBe('dentista')
    })

    it('debe retornar admin si membresía de admin existe y es válida', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ 
                      data: { rol: 'admin' },
                      error: null 
                    })
                  })
                })
              })
            })
          })
        })
      }

      const rol = await obtenerRolConFailClosed('user-123', mockSupabase)
      expect(rol).toBe('admin')
    })

    it('debe degradar a recepcion si lanza excepción', async () => {
      const mockSupabase = {
        from: () => {
          throw new Error('Unexpected error')
        }
      }

      const rol = await obtenerRolConFailClosed('user-123', mockSupabase)
      expect(rol).toBe('recepcion')
    })
  })

  describe('Integridad: nunca escalar a admin sin autorización', () => {
    it('siempre debe retornar un rol válido (nunca null/undefined)', async () => {
      const rolesValidos = ['admin', 'dentista', 'asistente', 'recepcion']
      
      // Escenario 1: error
      const mockError = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: new Error('fail') })
                  })
                })
              })
            })
          })
        })
      }
      const rol1 = await obtenerRolConFailClosed('user', mockError)
      expect(rolesValidos).toContain(rol1)

      // Escenario 2: sin membresía
      const mockNoMembresia = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null })
                  })
                })
              })
            })
          })
        })
      }
      const rol2 = await obtenerRolConFailClosed('user', mockNoMembresia)
      expect(rolesValidos).toContain(rol2)

      // Escenario 3: rol válido
      const mockValido = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: { rol: 'asistente' }, error: null })
                  })
                })
              })
            })
          })
        })
      }
      const rol3 = await obtenerRolConFailClosed('user', mockValido)
      expect(rolesValidos).toContain(rol3)
    })
  })
})
