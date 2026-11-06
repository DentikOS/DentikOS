/**
 * PageHeader — Componente base del Design System (F10-A3)
 *
 * Header estándar de módulo/página con breadcrumb, título sentence case,
 * descripción y slot de acciones. Reemplaza los headers ad-hoc de cada módulo.
 *
 * Tokens DS v2 consumidos vía style inline: --ds-text-2xl, --ds-text-base,
 * --ds-text-xs, --ds-weight-semibold.
 */
import React from 'react'
import { ChevronRight } from 'lucide-react'
import { Icon } from '../Icon'

export interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  breadcrumb?: BreadcrumbItem[]
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  icon?: React.ElementType
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  breadcrumb = [],
  title,
  description,
  actions,
  icon,
  className = '',
  ...rest
}) => {
  return (
    <header
      className={`mb-7 rounded-2xl border border-surface-border bg-surface ${className}`.trim()}
      {...rest}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:gap-4">
          {icon && (
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-champagne-50 text-champagne-700 ring-1 ring-inset ring-champagne-200 dark:bg-graphite-800 dark:text-gold-satin dark:ring-gold-satin/20    sm:h-12 sm:w-12"
            >
              <Icon icon={icon} size="lg" />
            </span>
          )}

          <div className="min-w-0">
            {breadcrumb.length > 0 && (
              <nav aria-label="breadcrumb" className="mb-2">
                <ol
                  className="flex flex-wrap items-center gap-1 text-graphite-500 dark:text-graphite-400"
                  style={{ fontSize: 'var(--ds-text-xs)' }}
                >
                  {breadcrumb.map((crumb, idx) => {
                    const isLast = idx === breadcrumb.length - 1
                    return (
                      <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1">
                        {idx > 0 && (
                          <Icon icon={ChevronRight} size="xs" className="text-graphite-400 dark:text-graphite-600" />
                        )}
                        {isLast || !crumb.onClick ? (
                          <span
                            aria-current={isLast ? 'page' : undefined}
                            className={isLast ? 'font-medium text-graphite-700 dark:text-graphite-300' : 'text-graphite-500 dark:text-graphite-400'}
                          >
                            {crumb.label}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={crumb.onClick}
                            className="text-graphite-500 transition-colors hover:text-graphite-900 dark:text-graphite-400 dark:hover:text-graphite-100"
                          >
                            {crumb.label}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </nav>
            )}

            <h1
              className="flex items-center gap-2 text-[1.55rem] font-semibold leading-tight tracking-tight text-graphite-900 dark:text-graphite-50 sm:text-[1.8rem]"
              style={{ fontWeight: 'var(--ds-weight-semibold)' }}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-graphite-600 dark:text-graphite-300">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto xl:max-w-[60%] xl:flex-shrink-0 xl:justify-end [&>*]:min-w-0 [&>*]:max-w-full">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

PageHeader.displayName = 'PageHeader'
