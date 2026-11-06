import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createLogger, logger, sanitizePHI } from './logger'

/**
 * Tests del logger centralizado (F6-03).
 * 
 * Estrategia: capturar logs en un array en memoria para evitar
 * contaminación de spies entre tests. Esto es más robusto que
 * usar vi.spyOn directamente.
 */

describe('logger (F6-03)', () => {
  let capturedLogs
  let originalConsoleDebug
  let originalConsoleLog
  let originalConsoleWarn
  let originalConsoleError
  
  beforeEach(() => {
    capturedLogs = []
    
    // Guardar originales
    originalConsoleDebug = console.debug
    originalConsoleLog = console.log
    originalConsoleWarn = console.warn
    originalConsoleError = console.error
    
    // Reemplazar con funciones que capturan
    console.debug = (...args) => capturedLogs.push({ level: 'debug', args })
    console.log = (...args) => capturedLogs.push({ level: 'log', args })
    console.warn = (...args) => capturedLogs.push({ level: 'warn', args })
    console.error = (...args) => capturedLogs.push({ level: 'error', args })
    
    // Limpiar override antes de cada test
    delete globalThis.__LOG_LEVEL__
  })
  
  afterEach(() => {
    // Restaurar originales
    console.debug = originalConsoleDebug
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    console.error = originalConsoleError
    
    delete globalThis.__LOG_LEVEL__
  })
  
  describe('createLogger', () => {
    it('retorna un objeto con los 4 métodos de log', () => {
      const log = createLogger('test')
      expect(log).toHaveProperty('debug')
      expect(log).toHaveProperty('info')
      expect(log).toHaveProperty('warn')
      expect(log).toHaveProperty('error')
      expect(typeof log.debug).toBe('function')
      expect(typeof log.info).toBe('function')
      expect(typeof log.warn).toBe('function')
      expect(typeof log.error).toBe('function')
    })
    
    it('agrega el prefijo [nombreModulo] a todos los logs', () => {
      const log = createLogger('miModulo')
      log.warn('mensaje de prueba')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0]).toEqual({
        level: 'warn',
        args: ['[miModulo]', 'mensaje de prueba']
      })
    })
    
    it('pasa múltiples argumentos correctamente', () => {
      const log = createLogger('test')
      const data = { id: 1, nombre: 'test' }
      log.warn('mensaje', data, 'extra')
      expect(capturedLogs[0].args).toEqual(['[test]', 'mensaje', data, 'extra'])
    })
  })
  
  describe('nivel por defecto (WARN en tests)', () => {
    it('debug() NO se muestra con nivel por defecto', () => {
      const log = createLogger('test')
      log.debug('mensaje debug')
      expect(capturedLogs).toHaveLength(0)
    })
    
    it('info() NO se muestra con nivel por defecto', () => {
      const log = createLogger('test')
      log.info('mensaje info')
      expect(capturedLogs).toHaveLength(0)
    })
    
    it('warn() SÍ se muestra con nivel por defecto', () => {
      const log = createLogger('test')
      log.warn('mensaje warn')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe('warn')
    })
    
    it('error() SÍ se muestra con nivel por defecto', () => {
      const log = createLogger('test')
      log.error('mensaje error')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe('error')
    })
  })
  
  describe('override por globalThis.__LOG_LEVEL__', () => {
    it('__LOG_LEVEL__="DEBUG" permite todos los niveles', () => {
      globalThis.__LOG_LEVEL__ = 'DEBUG'
      const log = createLogger('test')
      log.debug('mensaje debug')
      log.info('mensaje info')
      log.warn('mensaje warn')
      log.error('mensaje error')
      
      expect(capturedLogs).toHaveLength(4)
      expect(capturedLogs[0]).toEqual({ level: 'debug', args: ['[test]', 'mensaje debug'] })
      expect(capturedLogs[1]).toEqual({ level: 'log', args: ['[test]', 'mensaje info'] })
      expect(capturedLogs[2]).toEqual({ level: 'warn', args: ['[test]', 'mensaje warn'] })
      expect(capturedLogs[3]).toEqual({ level: 'error', args: ['[test]', 'mensaje error'] })
    })
    
    it('__LOG_LEVEL__="INFO" permite info/warn/error pero no debug', () => {
      globalThis.__LOG_LEVEL__ = 'INFO'
      const log = createLogger('test')
      log.debug('mensaje debug')
      log.info('mensaje info')
      log.warn('mensaje warn')
      log.error('mensaje error')
      
      expect(capturedLogs).toHaveLength(3)
      expect(capturedLogs[0].level).toBe('log')
      expect(capturedLogs[1].level).toBe('warn')
      expect(capturedLogs[2].level).toBe('error')
    })
    
    it('__LOG_LEVEL__="WARN" permite warn/error pero no debug/info', () => {
      globalThis.__LOG_LEVEL__ = 'WARN'
      const log = createLogger('test')
      log.debug('mensaje debug')
      log.info('mensaje info')
      log.warn('mensaje warn')
      log.error('mensaje error')
      
      expect(capturedLogs).toHaveLength(2)
      expect(capturedLogs[0]).toEqual({ level: 'warn', args: ['[test]', 'mensaje warn'] })
      expect(capturedLogs[1]).toEqual({ level: 'error', args: ['[test]', 'mensaje error'] })
    })
    
    it('__LOG_LEVEL__="ERROR" solo permite error', () => {
      globalThis.__LOG_LEVEL__ = 'ERROR'
      const log = createLogger('test')
      log.debug('mensaje debug')
      log.info('mensaje info')
      log.warn('mensaje warn')
      log.error('mensaje error')
      
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0]).toEqual({ level: 'error', args: ['[test]', 'mensaje error'] })
    })
    
    it('__LOG_LEVEL__="NONE" silencia todos los logs', () => {
      globalThis.__LOG_LEVEL__ = 'NONE'
      const log = createLogger('test')
      log.debug('mensaje debug')
      log.info('mensaje info')
      log.warn('mensaje warn')
      log.error('mensaje error')
      
      expect(capturedLogs).toHaveLength(0)
    })
    
    it('__LOG_LEVEL__ acepta valores en minúsculas', () => {
      globalThis.__LOG_LEVEL__ = 'debug'
      const log = createLogger('test')
      log.debug('mensaje debug')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe('debug')
    })
    
    it('__LOG_LEVEL__ con valor inválido usa el nivel por defecto (WARN)', () => {
      globalThis.__LOG_LEVEL__ = 'valor_invalido'
      const log = createLogger('test')
      log.debug('mensaje debug')
      log.info('mensaje info')
      log.warn('mensaje warn')
      
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0].level).toBe('warn')
    })
  })
  
  describe('logger por defecto', () => {
    it('exporta un logger con prefijo [app]', () => {
      logger.warn('mensaje de prueba')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0]).toEqual({
        level: 'warn',
        args: ['[app]', 'mensaje de prueba']
      })
    })
    
    it('logger por defecto respeta __LOG_LEVEL__', () => {
      globalThis.__LOG_LEVEL__ = 'DEBUG'
      logger.debug('mensaje debug')
      expect(capturedLogs).toHaveLength(1)
      expect(capturedLogs[0]).toEqual({
        level: 'debug',
        args: ['[app]', 'mensaje debug']
      })
    })
  })
})

describe('sanitizePHI (F7-23)', () => {
  it('enmascara campos sensibles en objetos', () => {
    const paciente = {
      id: 'abc-123',
      nombre: 'Juan Pérez',
      rut: '12345678-9',
      telefono: '+56912345678',
      email: 'juan@example.com',
      diagnostico: 'Caries dental',
    }
    
    const sanitized = sanitizePHI(paciente)
    
    expect(sanitized.id).toBe('abc-123')
    expect(sanitized.nombre).toBe('***REDACTED***')
    expect(sanitized.rut).toBe('***REDACTED***')
    expect(sanitized.telefono).toBe('***REDACTED***')
    expect(sanitized.email).toBe('***REDACTED***')
    expect(sanitized.diagnostico).toBe('***REDACTED***')
  })
  
  it('preserva campos no sensibles', () => {
    const data = {
      id: 'abc-123',
      estado: 'activo',
      clinica_id: 'xyz-789',
      created_at: '2026-01-01',
    }
    
    const sanitized = sanitizePHI(data)
    
    expect(sanitized).toEqual(data)
  })
  
  it('maneja arrays de objetos', () => {
    const pacientes = [
      { id: '1', nombre: 'Juan' },
      { id: '2', nombre: 'María' },
    ]
    
    const sanitized = sanitizePHI(pacientes)
    
    expect(sanitized).toHaveLength(2)
    expect(sanitized[0].nombre).toBe('***REDACTED***')
    expect(sanitized[1].nombre).toBe('***REDACTED***')
  })
  
  it('maneja valores primitivos (no los modifica)', () => {
    expect(sanitizePHI('string')).toBe('string')
    expect(sanitizePHI(123)).toBe(123)
    expect(sanitizePHI(null)).toBe(null)
    expect(sanitizePHI(undefined)).toBe(undefined)
  })
  
  it('no muta el objeto original', () => {
    const original = { nombre: 'Juan', id: '123' }
    const sanitized = sanitizePHI(original)
    
    expect(original.nombre).toBe('Juan')
    expect(sanitized.nombre).toBe('***REDACTED***')
  })
})
