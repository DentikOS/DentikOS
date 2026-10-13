import React, { useMemo } from 'react'
import { UsersRound } from 'lucide-react'
import { useGestionMiembros } from './useGestionMiembros'
import { NOMBRES_ROLES } from '../../../constants/rbacConstants'
import type { MiembroItem, InvitacionItem } from '../../../infrastructure/auth/authService'

/**
 * F7-11: Módulo de gestión de miembros de la clínica.
 * Componente puramente presentacional — toda la lógica está en useGestionMiembros.
 */
export const GestionMiembrosModulo: React.FC = () => {
  const {
    miembros,
    invitaciones,
    loading,
    error,
    mensajeExito,
    emailInvitar,
    setEmailInvitar,
    rolInvitar,
    setRolInvitar,
    invitando,
    urlCopiada,
    rolesDisponibles,
    handleInvitar,
    handleRevocar,
    handleCopiarLink
  } = useGestionMiembros()

  // BUG-GESTION-MIEMBROS: Filtrar solo invitaciones pendientes
  const invitacionesPendientes = useMemo<InvitacionItem[]>(() => {
    return invitaciones.filter((i) => i.status === 'pending')
  }, [invitaciones])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-graphite-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-graphite-700 rounded w-3/4 mb-8"></div>
          <div className="h-64 bg-gray-200 dark:bg-graphite-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-900 dark:text-graphite-50 surgical:text-black mb-2 inline-flex items-center gap-3">
          <UsersRound size={28} className="text-primary" />
          Gestión de Miembros
        </h1>
        <p className="text-graphite-600 dark:text-graphite-400 surgical:text-graphite-800">
          Administra el personal de tu clínica. Invita nuevos miembros y gestiona los roles.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-lg">
          <p className="text-rose-800 dark:text-rose-300">{error}</p>
        </div>
      )}

      {mensajeExito && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-lg">
          <p className="text-emerald-800 dark:text-emerald-300">{mensajeExito}</p>
        </div>
      )}

      <div className="bg-surface rounded-lg shadow-sm border border-surface p-6 mb-8">
        <h2 className="text-xl font-semibold text-graphite-900 dark:text-graphite-50 surgical:text-black mb-4">
          Invitar Nuevo Miembro
        </h2>
        <form onSubmit={handleInvitar} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-graphite-700 dark:text-graphite-300 surgical:text-graphite-900 mb-1"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={emailInvitar}
                onChange={(e) => setEmailInvitar(e.target.value)}
                placeholder="ejemplo@clinica.com"
                required
                className="w-full px-3 py-2 border border-surface bg-white dark:bg-graphite-950 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-100 surgical:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                disabled={invitando}
              />
            </div>

            <div>
              <label
                htmlFor="rol"
                className="block text-sm font-medium text-graphite-700 dark:text-graphite-300 surgical:text-graphite-900 mb-1"
              >
                Rol
              </label>
              <select
                id="rol"
                value={rolInvitar}
                onChange={(e) => setRolInvitar(e.target.value)}
                className="w-full px-3 py-2 border border-surface bg-white dark:bg-graphite-950 surgical:bg-graphite-200 text-graphite-900 dark:text-graphite-100 surgical:text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                disabled={invitando}
              >
                {rolesDisponibles.map((rol) => (
                  <option key={rol.key} value={rol.value}>
                    {rol.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-graphite-600 dark:text-graphite-400 surgical:text-graphite-800">
              {rolesDisponibles.find((r) => r.value === rolInvitar)?.descripcion}
            </div>
            <button
              type="submit"
              disabled={invitando || !emailInvitar}
              className="px-6 py-2 bg-primary hover:bg-champagne-600 dark:bg-gold-satin dark:hover:bg-primary text-white dark:text-graphite-950 font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {invitando ? 'Invitando...' : 'Enviar Invitación'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-surface rounded-lg shadow-sm border border-surface mb-8 overflow-hidden">
        <div className="p-6 border-b border-surface">
          <h2 className="text-xl font-semibold text-graphite-900 dark:text-graphite-50 surgical:text-black">
            Miembros Actuales (<span className="tabular-nums">{miembros.length}</span>)
          </h2>
        </div>

        {miembros.length === 0 ? (
          <div className="p-8 text-center text-graphite-500 dark:text-graphite-400">
            No hay miembros en esta clínica
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-elevated border-b border-surface">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-surface">
                {miembros.map((miembro: MiembroItem) => (
                  <tr
                    key={miembro.id || miembro.user_id}
                    className="hover:bg-slate-50 dark:hover:bg-graphite-800/60 surgical:hover:bg-graphite-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-graphite-900 dark:text-graphite-50 surgical:text-black">
                      {miembro.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                        {NOMBRES_ROLES[miembro.rol as keyof typeof NOMBRES_ROLES] || miembro.rol}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                          miembro.activo
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                        }`}
                      >
                        {miembro.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-lg shadow-sm border border-surface overflow-hidden">
        <div className="p-6 border-b border-surface">
          <h2 className="text-xl font-semibold text-graphite-900 dark:text-graphite-50 surgical:text-black">
            Invitaciones Pendientes (<span className="tabular-nums">{invitacionesPendientes.length}</span>)
          </h2>
        </div>

        {invitacionesPendientes.length === 0 ? (
          <div className="p-8 text-center text-graphite-500 dark:text-graphite-400">
            No hay invitaciones pendientes
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-elevated border-b border-surface">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900 uppercase tracking-wider">
                    Enviada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-surface">
                {invitacionesPendientes.map((invitacion: InvitacionItem) => (
                  <tr
                    key={invitacion.id}
                    className="hover:bg-slate-50 dark:hover:bg-graphite-800/60 surgical:hover:bg-graphite-200"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-graphite-900 dark:text-graphite-50 surgical:text-black">
                      {invitacion.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                        {NOMBRES_ROLES[invitacion.rol as keyof typeof NOMBRES_ROLES] || String(invitacion.rol)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        Pendiente
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm tabular-nums text-graphite-600 dark:text-graphite-300 surgical:text-graphite-900">
                      {invitacion.creada_en ? new Date(String(invitacion.creada_en)).toLocaleDateString('es-CL') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      <button
                        onClick={() => invitacion.token && handleCopiarLink(invitacion.token)}
                        className="text-primary hover:text-champagne-600 dark:text-gold-satin transition-colors cursor-pointer"
                        title="Copiar link de invitación"
                      >
                        {urlCopiada === invitacion.token ? 'Copiado' : 'Copiar Link'}
                      </button>
                      <button
                        onClick={() => handleRevocar(invitacion.id)}
                        className="text-rose-600 hover:text-rose-800 dark:text-rose-400 transition-colors cursor-pointer"
                        title="Revocar invitación"
                      >
                        Revocar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
