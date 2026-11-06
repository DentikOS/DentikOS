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
  solicitaUrlDownload,
  eliminaArchivo,
  listaArchivosDePaciente,
  vaciarPapeleraArchivos,
  actualizarMetadataArchivo,
  solicitaUrlUploadPerfil,
  subirLogoClinicaAR2,
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

    it('incluye la orden y el tipo documental al subir un archivo de laboratorio', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'tok-123' } },
      })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ archivo_id: 'arch-lab-1', upload_url: 'https://r2/upload' }),
      })

      await solicitaUrlUpload({
        pacienteId: 'pac-1',
        categoria: 'laboratorio',
        nombreArchivo: 'evidencia.jpg',
        mimeType: 'image/jpeg',
        tamanoBytes: 1024,
        ordenLaboratorioId: 'orden-1',
        tipoDocumento: 'evidencia_garantia',
      })

      const [, request] = global.fetch.mock.calls[0]
      expect(JSON.parse(request.body)).toMatchObject({
        paciente_id: 'pac-1',
        categoria: 'laboratorio',
        orden_laboratorio_id: 'orden-1',
        tipo_documento: 'evidencia_garantia',
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

  describe('subirLogoClinicaAR2', () => {
    it('solicita una URL para la clínica activa y sube el archivo firmado', async () => {
      const xhrs = []
      class MockXMLHttpRequest {
        constructor() {
          this.upload = { addEventListener: vi.fn() }
          this.listeners = {}
          this.headers = {}
          this.status = 200
          xhrs.push(this)
        }
        addEventListener(name, callback) { this.listeners[name] = callback }
        open(method, url) { this.method = method; this.url = url }
        setRequestHeader(name, value) { this.headers[name] = value }
        send(file) { this.file = file; this.listeners.load?.() }
      }

      mockGetSession.mockResolvedValueOnce({ data: { session: { access_token: 'jwt-validado-en-servidor' } } })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          upload_url: 'https://account.r2.cloudflarestorage.com/signed-upload',
          upload_headers: { 'Content-Type': 'image/png' },
          public_url: 'https://pub-account.r2.dev/clinic-logo.png',
          expires_in: 900,
        }),
      })
      vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest)

      try {
        const file = new File(['logo'], 'logo.png', { type: 'image/png' })
        const publicUrl = await subirLogoClinicaAR2('clinica-123', file)

        expect(publicUrl).toBe('https://pub-account.r2.dev/clinic-logo.png')
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/functions/v1/r2-clinic-logo-upload-url'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              clinica_id: 'clinica-123',
              nombre_archivo: 'logo.png',
              mime_type: 'image/png',
              tamano_bytes: file.size,
            }),
          })
        )
        expect(xhrs).toHaveLength(1)
        expect(xhrs[0].method).toBe('PUT')
        expect(xhrs[0].url).toBe('https://account.r2.cloudflarestorage.com/signed-upload')
        expect(xhrs[0].file).toBe(file)
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('rechaza una URL de carga ajena a R2 sin enviar el archivo', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: { access_token: 'jwt-validado-en-servidor' } } })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          upload_url: 'https://upload.evil.example/file',
          upload_headers: { 'Content-Type': 'image/png' },
          public_url: 'https://pub-account.r2.dev/logo.png',
          expires_in: 900,
        }),
      })

      const file = new File(['logo'], 'logo.png', { type: 'image/png' })
      await expect(subirLogoClinicaAR2('clinica-123', file)).resolves.toBeNull()
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
