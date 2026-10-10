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
      className={`flex flex-col rounded-2xl bg-surface border border-surface-border shadow-xs overflow-hidden transition-all hover:shadow-md ${className}`}
      style={borderColor ? { borderTop: `3px solid ${borderColor}` } : undefined}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle}
          {icono && <div className="text-slate-600 dark:text-slate-300 shrink-0">{icono}</div>}
          <h3
            onClick={onHeaderClick}
            className={`text-xs font-bold text-[#0F172A] dark:text-white uppercase tracking-wider truncate ${
              onHeaderClick ? 'cursor-pointer hover:text-[#B88E3A] transition-colors' : ''
            }`}
          >
            {titulo}
          </h3>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      <div className="flex-1 p-4">{children}</div>

      {footer && (
        <div className="px-4 py-2.5 bg-surface-muted/20 border-t border-surface-border text-xs text-slate-500">
          {footer}
        </div>
      )}
    </div>
  )
}
