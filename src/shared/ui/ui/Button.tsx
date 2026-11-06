/**
 * Button — Componente base del Design System (F7-25 Fase 3)
 *
 * Botón reutilizable con 5 variantes, 3 tamaños, soporte de iconos,
 * estado loading y dark mode automático.
 */
import React, { forwardRef } from 'react'
import { Icon, type IconSize } from '../Icon'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonIconPosition = 'left' | 'right'

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-primary hover:bg-champagne-400 dark:bg-champagne-300 dark:hover:bg-champagne-200 text-primary-foreground shadow-sm',
  secondary: 'bg-graphite-100 hover:bg-graphite-200 dark:bg-graphite-800 dark:hover:bg-graphite-700 text-graphite-800 dark:text-graphite-100',
  danger: 'bg-clinical-error hover:bg-red-700 text-white shadow-sm',
  ghost: 'bg-transparent hover:bg-graphite-100 dark:hover:bg-graphite-800 text-graphite-700 dark:text-graphite-300',
  outline: 'bg-transparent border border-graphite-300 dark:border-graphite-600 hover:bg-gold-light/20 hover:border-primary dark:hover:border-primary text-graphite-700 dark:text-graphite-300',
}

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'min-h-10 sm:min-h-9 px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'min-h-11 sm:min-h-10 px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'min-h-12 sm:min-h-11 px-5 py-2.5 text-base rounded-lg gap-2.5',
}

const ICON_SIZES: Record<ButtonSize, IconSize> = {
  sm: 'xs',
  md: 'sm',
  lg: 'md',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ElementType
  iconPosition?: ButtonIconPosition
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  children?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  icon: IconComponent,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  className = '',
  onClick,
  onKeyDown,
  'aria-label': ariaLabel,
  ...rest
}, ref) => {
  const isDisabled = disabled || loading

  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.primary
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      return
    }
    onKeyDown?.(e)
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-semibold
        transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-focus focus-visible:ring-offset-2 dark:focus-visible:ring-offset-graphite-900
        motion-reduce:transition-none motion-reduce:active:scale-100
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none

        ${fullWidth ? 'w-full' : ''}
        ${variantStyle}
        ${sizeStyle}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...rest}
    >
      {loading && (
        <Icon icon={Loader2} size={iconSize} className="animate-spin" />
      )}

      {!loading && IconComponent && iconPosition === 'left' && (
        <Icon icon={IconComponent} size={iconSize} />
      )}

      {children && <span>{children}</span>}

      {!loading && IconComponent && iconPosition === 'right' && (
        <Icon icon={IconComponent} size={iconSize} />
      )}
    </button>
  )
})

Button.displayName = 'Button'
