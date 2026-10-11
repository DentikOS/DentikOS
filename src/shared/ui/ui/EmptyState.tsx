/**
 * EmptyState — Componente base del Design System (F10-A4)
 *
 * Estado vacío estándar con icono lucide, título, descripción y CTA opcional.
 * Reemplaza los bloques ad-hoc con iconos grandes.
 *
 * Tokens DS v2 consumidos vía style inline: --ds-text-base, --ds-text-sm,
 * --ds-text-xs, --ds-weight-semibold.
 */
import React from 'react'
import { Icon } from '../Icon'

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ElementType
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconComponent,
  title,
  description,
  action,
  compact = false,
  className = '',
  ...rest
}) => {
  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center
        border border-dashed border-graphite-200 dark:border-graphite-700
        rounded-lg bg-graphite-50/50 dark:bg-graphite-800/30
        ${compact ? 'py-8 px-4' : 'py-14 px-6'}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...rest}
    >
      {/* Icono en círculo sutil */}
      {IconComponent && (
        <div
          className={`
            flex items-center justify-center rounded-full
            bg-graphite-100 dark:bg-graphite-800
            text-graphite-400 dark:text-graphite-500
            ${compact ? 'w-9 h-9 mb-3' : 'w-12 h-12 mb-4'}
          `.trim().replace(/\s+/g, ' ')}
          aria-hidden="true"
        >
          <Icon icon={IconComponent} size={compact ? 'sm' : 'md'} />
        </div>
      )}

      {/* Título */}
      <h3
        className="text-graphite-800 dark:text-graphite-100"
        style={{
          fontSize: compact ? 'var(--ds-text-sm)' : 'var(--ds-text-base)',
          fontWeight: 'var(--ds-weight-semibold)',
        }}
      >
        {title}
      </h3>

      {/* Descripción */}
      {description && (
        <p
          className={`text-graphite-500 dark:text-graphite-400 max-w-sm ${compact ? 'mt-1' : 'mt-2'}`}
          style={{ fontSize: 'var(--ds-text-xs)' }}
        >
          {description}
        </p>
      )}

      {/* CTA opcional */}
      {action && <div className={compact ? 'mt-3' : 'mt-4'}>{action}</div>}
    </div>
  )
}

EmptyState.displayName = 'EmptyState'
