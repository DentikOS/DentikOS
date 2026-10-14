import { describe, it, expect, vi, beforeEach } from 'vitest'
import { profileService } from './profileService'
import { supabase } from '../supabase/supabaseClient'
import { solicitaUrlUploadPerfil, subeArchivoAR2 } from '../storage/r2ArchivosService'

vi.mock('../supabase/supabaseClient', () => ({
  USE_SUPABASE: true,
  supabase: {
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
      refreshSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

vi.mock('../logging/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('../storage/r2ArchivosService', () => ({
  solicitaUrlUploadPerfil: vi.fn(),
  subeArchivoAR2: vi.fn(),
}))

describe('profileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('obtenerPerfil', () => {
    it('retorna el perfil estructurado cuando el RPC responde exitosamente', async () => {
      vi.mocked(supabase!.rpc).mockResolvedValue({
        data: {
          id: 'user-uuid-1',
          email: 'doctor@dentikos.cl',
          full_name: 'Dr. Roberto Gómez',
          especialidad: 'Ortodoncia',
          telefono: '+56 9 1234 5678',
          rut: '12.345.678-9',
          foto_url: 'https://example.com/avatar.jpg',
          biografia: 'Cirujano dentista especialista',
          redes_sociales: { instagram: '@dr.gomez' },
        },
        error: null,
      } as any)

      const result = await profileService.obtenerPerfil()

      expect(supabase!.rpc).toHaveBeenCalledWith('obtener_perfil')
      expect(result).toEqual({
        id: 'user-uuid-1',
        email: 'doctor@dentikos.cl',
        fullName: 'Dr. Roberto Gómez',
        especialidad: 'Ortodoncia',
        telefono: '+56 9 1234 5678',
        rut: '12.345.678-9',
        fotoUrl: 'https://example.com/avatar.jpg',
        biografia: 'Cirujano dentista especialista',
        redesSociales: { instagram: '@dr.gomez' },
      })
    })

    it('retorna null en caso de error del RPC', async () => {
      vi.mocked(supabase!.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      } as any)

      const result = await profileService.obtenerPerfil()
      expect(result).toBeNull()
    })
  })

  describe('actualizarPerfil', () => {
    it('ejecuta RPC actualizar_perfil y refresca la sesión', async () => {
      vi.mocked(supabase!.rpc).mockResolvedValue({
        data: {
          id: 'user-uuid-1',
          email: 'doctor@dentikos.cl',
          full_name: 'Dr. Roberto Gómez Modificado',
          especialidad: 'Endodoncia',
          telefono: '+56 9 9999 8888',
          rut: '12.345.678-9',
          foto_url: 'https://example.com/nueva_foto.jpg',
          biografia: null,
          redes_sociales: {},
        },
        error: null,
      } as any)

      const result = await profileService.actualizarPerfil({
        fullName: 'Dr. Roberto Gómez Modificado',
        especialidad: 'Endodoncia',
        telefono: '+56 9 9999 8888',
        fotoUrl: 'https://example.com/nueva_foto.jpg',
      })

      expect(supabase!.rpc).toHaveBeenCalledWith(
        'actualizar_perfil',
        expect.objectContaining({
          p_full_name: 'Dr. Roberto Gómez Modificado',
          p_especialidad: 'Endodoncia',
          p_telefono: '+56 9 9999 8888',
          p_foto_url: 'https://example.com/nueva_foto.jpg',
        })
      )
      expect(supabase!.auth.refreshSession).toHaveBeenCalled()
      expect(result?.fullName).toBe('Dr. Roberto Gómez Modificado')
      expect(result?.especialidad).toBe('Endodoncia')
    })
  })

  describe('subirFoto', () => {
    it('solicita URL firmada a R2 y sube archivo directo', async () => {
      vi.mocked(solicitaUrlUploadPerfil).mockResolvedValue({
        upload_url: 'https://r2.cloudflarestorage.com/upload-signed',
        r2_object_key: 'usr-123/12345.png',
        expires_in: 900,
        upload_headers: { 'Content-Type': 'image/png' },
        public_url: 'https://pub-r2.dev/usr-123/12345.png',
      })
      vi.mocked(subeArchivoAR2).mockResolvedValue(true)

      const file = new File(['dummy'], 'foto.png', { type: 'image/png' })
      const url = await profileService.subirFoto(file)

      expect(solicitaUrlUploadPerfil).toHaveBeenCalledWith({
        nombreArchivo: 'foto.png',
        mimeType: 'image/png',
        tamanoBytes: file.size,
      })
      expect(subeArchivoAR2).toHaveBeenCalledWith({
        uploadUrl: 'https://r2.cloudflarestorage.com/upload-signed',
        uploadHeaders: { 'Content-Type': 'image/png' },
        file,
      })
      expect(url).toBe('https://pub-r2.dev/usr-123/12345.png')
    })

    it('retorna null si falla la solicitud de URL firmada', async () => {
      vi.mocked(solicitaUrlUploadPerfil).mockResolvedValue(null)

      const file = new File(['dummy'], 'foto.png', { type: 'image/png' })
      const url = await profileService.subirFoto(file)

      expect(url).toBeNull()
      expect(subeArchivoAR2).not.toHaveBeenCalled()
    })
  })

  describe('eliminarFoto', () => {
    it('actualiza profiles con foto_url en null', async () => {
      vi.mocked(supabase!.auth.getUser).mockResolvedValue({
        data: { user: { id: 'usr-123' } as any },
        error: null,
      })

      const mockEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
      vi.mocked(supabase!.from).mockReturnValue({ update: mockUpdate } as any)

      const ok = await profileService.eliminarFoto()

      expect(ok).toBe(true)
      expect(supabase!.from).toHaveBeenCalledWith('profiles')
      expect(mockUpdate).toHaveBeenCalledWith({ foto_url: null })
      expect(mockEq).toHaveBeenCalledWith('id', 'usr-123')
    })
  })
})
