import React from 'react'

export interface WidgetBaseProps {
  titulo: string
  icono?: React.ReactNode
  borderColor?: string
  onHeaderClick?: () => void
  headerAction?: React.ReactNode
  dragHandle?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const WidgetBase: React.FC<WidgetBaseProps> = ({
  titulo,
  icono,
  borderColor,
  onHeaderClick,
  headerAction,
  dragHandle,
  footer,
  children,
  className = ''
}) => {
  return (
    <div
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-surface-border/75 bg-surface shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-gold-satin/30 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${className}`}
      style={borderColor ? { borderTop: `2px solid ${borderColor}` } : undefined}
    >
      <div className="flex items-center justify-between gap-3 border-b border-surface-border/80 bg-surface-muted/45 px-5 py-4">
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle}
          {icono && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-champagne-700 shadow-xs ring-1 ring-inset ring-surface-border/70 dark:text-gold-satin">{icono}</div>}
          <h3
            onClick={onHeaderClick}
            className={`truncate text-sm font-semibold tracking-tight text-graphite-900 dark:text-white ${
              onHeaderClick ? 'cursor-pointer hover:text-[#B88E3A] transition-colors' : ''
            }`}
          >
            {titulo}
          </h3>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      <div className="flex-1 p-5">{children}</div>

      {footer && (
        <div className="border-t border-surface-border px-5 py-3 text-xs text-slate-500">
          {footer}
        </div>
      )}
    </div>
  )
}
