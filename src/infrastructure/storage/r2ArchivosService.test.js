import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSession, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../supabase/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
  },
}))

import {
  solicitaUrlUpload,
  subeArchivoAR2,
  solicitaUrlDownload,
  descargaArchivoDeR2,
  abrirArchivoDeR2,
  eliminaArchivo,
  listaArchivosDePaciente,
  listaArchivosEliminados,
  restaurarArchivo,
  vaciarPapeleraArchivos,
  actualizarMetadataArchivo,
  solicitaUrlUploadPerfil,
} from './r2ArchivosService'

describe('r2ArchivosService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('solicitaUrlUpload', () => {
    it('retorna null si no hay sesión activa', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })
      const res = await solicitaUrlUpload({
        pacienteId: 'pac-1',
        categoria: 'radiografia',
        nombreArchivo: 'rx.png',
        mimeType: 'image/png',
        tamanoBytes: 1024,
      })
      expect(res).toBeNull()
    })

    it('solicita URL de upload exitosamente', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok-123' } },
      })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          archivo_id: 'arch-1',
          r2_object_key: 'key-1',
          upload_url: 'https://r2/upload',
          upload_headers: { 'Content-Type': 'image/png' },
          expires_in: 300,
        }),
      })

      const res = await solicitaUrlUpload({
        pacienteId: 'pac-1',
        categoria: 'radiografia',
        nombreArchivo: 'rx.png',
        mimeType: 'image/png',
        tamanoBytes: 1024,
      })
      expect(res).toEqual({
        archivo_id: 'arch-1',
        r2_object_key: 'key-1',
        upload_url: 'https://r2/upload',
        upload_headers: { 'Content-Type': 'image/png' },
        expires_in: 300,
      })
    })

    it('retorna null si la respuesta no es ok', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok-123' } },
      })
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      const res = await solicitaUrlUpload({
        pacienteId: 'pac-1',
        categoria: 'radiografia',
        nombreArchivo: 'rx.png',
        mimeType: 'image/png',
        tamanoBytes: 1024,
      })
      expect(res).toBeNull()
    })
  })

  describe('solicitaUrlDownload', () => {
    it('retorna null si no hay sesión activa', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })
      const res = await solicitaUrlDownload('arch-1')
      expect(res).toBeNull()
    })

    it('retorna URL de download exitosamente', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok-123' } },
      })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          archivo_id: 'arch-1',
          download_url: 'https://r2/download',
          download_headers: {},
          expires_in: 300,
        }),
      })

      const res = await solicitaUrlDownload('arch-1')
      expect(res).toEqual({
        archivo_id: 'arch-1',
        download_url: 'https://r2/download',
        download_headers: {},
        expires_in: 300,
      })
    })
  })

  describe('eliminaArchivo', () => {
    it('retorna null si no hay sesión activa', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })
      const res = await eliminaArchivo('arch-1')
      expect(res).toBeNull()
    })

    it('retorna true si el borrado fue exitoso', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok-123' } },
      })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      const res = await eliminaArchivo('arch-1')
      expect(res).toBe(true)
    })
  })

  describe('listaArchivosDePaciente', () => {
    it('consulta archivos activos de un paciente en Supabase', async () => {
      const mockOrder = vi.fn().mockResolvedValue({
        data: [{ id: 'arch-1', paciente_id: 'pac-1', estado: 'activo' }],
        error: null,
      })
      const mockEqEstado = vi.fn(() => ({ order: mockOrder }))
      const mockEqPaciente = vi.fn(() => ({ eq: mockEqEstado }))
      const mockSelect = vi.fn(() => ({ eq: mockEqPaciente }))
      mockFrom.mockReturnValue({ select: mockSelect })

      const res = await listaArchivosDePaciente('pac-1')
      expect(res).toHaveLength(1)
      expect(res[0].id).toBe('arch-1')
    })
  })

  describe('vaciarPapeleraArchivos', () => {
    it('retorna purgados vacíos si el array está vacío', async () => {
      const res = await vaciarPapeleraArchivos([])
      expect(res).toEqual({ purgados: [], rechazados: [] })
    })

    it('purga archivos llamando a Edge Function', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok-123' } },
      })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ purgados: ['arch-1'], rechazados: [] }),
      })

      const res = await vaciarPapeleraArchivos(['arch-1'])
      expect(res).toEqual({ purgados: ['arch-1'], rechazados: [] })
    })
  })

  describe('actualizarMetadataArchivo', () => {
    it('retorna false con parámetros inválidos', async () => {
      const res = await actualizarMetadataArchivo('', {})
      expect(res).toBe(false)
    })

    it('actualiza metadata en Supabase', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok-123' } },
      })
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn(() => ({ eq: mockEq }))
      mockFrom.mockReturnValue({ update: mockUpdate })

      const res = await actualizarMetadataArchivo('arch-1', { tipo: 'consentimiento' })
      expect(res).toBe(true)
    })
  })

  describe('solicitaUrlUploadPerfil', () => {
    it('retorna null si no hay sesión activa', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })
      const res = await solicitaUrlUploadPerfil({
        nombreArchivo: 'avatar.jpg',
        mimeType: 'image/jpeg',
        tamanoBytes: 2048,
      })
      expect(res).toBeNull()
    })

    it('solicita URL de upload de perfil exitosamente', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok-abc' } },
      })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          upload_url: 'https://r2/upload/avatar',
          r2_object_key: 'usr-1/avatar.jpg',
          expires_in: 900,
          upload_headers: { 'Content-Type': 'image/jpeg' },
          public_url: 'https://pub-r2.dev/usr-1/avatar.jpg',
        }),
      })

      const res = await solicitaUrlUploadPerfil({
        nombreArchivo: 'avatar.jpg',
        mimeType: 'image/jpeg',
        tamanoBytes: 2048,
      })

      expect(res).toEqual({
        upload_url: 'https://r2/upload/avatar',
        r2_object_key: 'usr-1/avatar.jpg',
        expires_in: 900,
        upload_headers: { 'Content-Type': 'image/jpeg' },
        public_url: 'https://pub-r2.dev/usr-1/avatar.jpg',
      })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/r2-profile-upload-url'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer tok-abc',
          }),
        })
      )
    })
  })
})
