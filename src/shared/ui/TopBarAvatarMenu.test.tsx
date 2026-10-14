import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TopBarAvatarMenu } from './TopBarAvatarMenu'

describe('TopBarAvatarMenu (Blueprint 03 §06)', () => {
  const defaultProfile = {
    email: 'miguel.diaz@dentikos.cl',
    nombreCompleto: 'Dr. Miguel Díaz',
    rol: 'dentista',
    clinicaNombre: 'Clínica Providencia',
  }

  it('calcula y muestra iniciales de 2 letras cuando no hay foto', () => {
    render(<TopBarAvatarMenu userProfile={defaultProfile} />)
    expect(screen.getByText('MD')).toBeInTheDocument()
  })

  it('muestra imagen cuando fotoUrl está presente', () => {
    const profileWithPhoto = {
      ...defaultProfile,
      fotoUrl: 'https://cdn.dentikos.cl/avatars/miguel.jpg',
    }
    render(<TopBarAvatarMenu userProfile={profileWithPhoto} />)
    const img = screen.getByRole('img', { name: /dr\. miguel díaz/i })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://cdn.dentikos.cl/avatars/miguel.jpg')
  })

  it('abre el menú dropdown con ancho 280px y las 6 secciones al hacer clic', () => {
    render(<TopBarAvatarMenu userProfile={defaultProfile} />)

    const btn = screen.getByRole('button', { name: /menú de usuario/i })
    fireEvent.click(btn)

    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    expect(menu.className).toContain('w-[280px]')

    // 6 secciones de BP03 §06
    expect(screen.getByText('Perfil')).toBeInTheDocument()
    expect(screen.getByText('Preferencias')).toBeInTheDocument()
    expect(screen.getByText('Panel de Atajos')).toBeInTheDocument()
    expect(screen.getByText('Modo Foco')).toBeInTheDocument()
    expect(screen.getByText('Dispositivos')).toBeInTheDocument()
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument()
  })

  it('ejecuta callbacks al pulsar Perfil y Cerrar sesión', () => {
    const onOpenPerfil = vi.fn()
    const onLogout = vi.fn()

    render(
      <TopBarAvatarMenu
        userProfile={defaultProfile}
        onOpenPerfil={onOpenPerfil}
        onLogout={onLogout}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /menú de usuario/i }))

    fireEvent.click(screen.getByText('Perfil'))
    expect(onOpenPerfil).toHaveBeenCalledTimes(1)

    // Reabrir
    fireEvent.click(screen.getByRole('button', { name: /menú de usuario/i }))
    fireEvent.click(screen.getByText('Cerrar sesión'))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('cierra el menú al presionar Escape', async () => {
    render(<TopBarAvatarMenu userProfile={defaultProfile} />)

    fireEvent.click(screen.getByRole('button', { name: /menú de usuario/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })
})
