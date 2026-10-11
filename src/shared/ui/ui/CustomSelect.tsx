/**
 * CustomSelect — Select accesible con iconos lucide (F10-A7)
 *
 * Componente base del Design System v2 que reemplaza <select> nativo
 * cuando se necesitan iconos dentro de las opciones (HTML no permite
 * iconos en <option>).
 *
 * Uso:
 *   <CustomSelect
 *     label="Motivo del Bloqueo"
 *     options={[
 *       { value: 'almuerzo', label: 'Horario de Almuerzo', icon: Utensils },
 *       { value: 'mantenimiento', label: 'Mantenimiento Técnico', icon: Wrench },
 *     ]}
 *     value={form.motivo}
 *     onChange={(value) => setForm({ ...form, motivo: value })}
 *     placeholder="Seleccionar..."
 *   />
 *
 * Accesibilidad (WAI-ARIA combobox):
 * - role="combobox" en trigger, aria-expanded, aria-controls
 * - role="listbox" en dropdown, role="option" en cada item
 * - Keyboard: ↑↓ navega, Enter selecciona, Esc cierra, Tab sale
 * - aria-activedescendant para screen readers
 *
 * Integración con forms:
 * - Emite onChange con el value seleccionado
 * - Compatible con <form onSubmit>
 */
import React, { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, LucideIcon } from 'lucide-react'
import { Icon } from '../Icon'

export interface CustomSelectOption<T extends string | number = string> {
  value: T
  label: string
  icon?: LucideIcon | React.ComponentType<{ className?: string }>
  [key: string]: unknown
}

export interface CustomSelectProps<T extends string | number = string> {
  label?: string
  options?: CustomSelectOption<T>[]
  value?: T | null | ''
  onChange?: (value: T) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-describedby'?: string
}

export const CustomSelect = <T extends string | number = string>({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  className = '',
  'aria-describedby': ariaDescribedBy,
}: CustomSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listboxRef = useRef<HTMLDivElement | null>(null)
  const baseId = useId()
  const listboxId = `${baseId}-listbox`

  const selectedOption = options.find((o) => o.value === value) || null

  // Cerrar con click fuera
  useEffect(() => {
    if (!isOpen) return

    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [isOpen])

  // Navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
        setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)))
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (options[activeIndex]) {
          onChange?.(options[activeIndex].value)
        }
        setIsOpen(false)
        triggerRef.current?.focus()
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
        break
      case 'Tab':
        setIsOpen(false)
        break
      default:
        break
    }
  }

  const handleSelectOption = (optionValue: T) => {
    onChange?.(optionValue)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const activeDescendant = isOpen && options[activeIndex]
    ? `${baseId}-option-${activeIndex}`
    : undefined

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label
          htmlFor={`${baseId}-trigger`}
          className="block text-xs font-semibold text-graphite-700 dark:text-graphite-300 uppercase mb-1.5"
        >
          {label}
        </label>
      )}

      <div ref={containerRef} className="relative">
        {/* Trigger */}
        <button
          ref={triggerRef}
          id={`${baseId}-trigger`}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-describedby={ariaDescribedBy}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={`
            w-full flex items-center justify-between gap-2
            px-3 py-2.5 rounded-lg border
            bg-surface
            text-sm font-medium
            text-graphite-900 dark:text-graphite-50
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-graphite-900
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-surface'}
            ${className}
          `.trim().replace(/\s+/g, ' ')}
        >
          <span className="flex items-center gap-2 flex-1 text-left">
            {selectedOption?.icon && (
              <Icon icon={selectedOption.icon} size="sm" className="text-graphite-500 dark:text-graphite-400" />
            )}
            {selectedOption ? selectedOption.label : (
              <span className="text-graphite-400 dark:text-graphite-500">{placeholder}</span>
            )}
          </span>
          <Icon
            icon={ChevronDown}
            size="sm"
            className={`text-graphite-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={label ? `${baseId}-trigger` : undefined}
            className="absolute z-50 mt-1 w-full bg-surface dark:bg-graphite-800 border border-surface rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto"
          >
            {options.map((option, idx) => {
              const isSelected = option.value === value
              const isActive = idx === activeIndex

              return (
                <div
                  key={option.value}
                  id={`${baseId}-option-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectOption(option.value)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 text-sm
                    cursor-pointer transition-colors
                    ${isActive ? 'bg-graphite-100 dark:bg-graphite-700' : ''}
                    ${isSelected ? 'text-primary font-semibold' : 'text-graphite-900 dark:text-graphite-100'}
                  `.trim().replace(/\s+/g, ' ')}
                >
                  {option.icon && (
                    <Icon icon={option.icon} size="sm" className="text-graphite-500 dark:text-graphite-400" />
                  )}
                  <span className="flex-1">{option.label}</span>
                  {isSelected && <span className="text-primary"></span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

CustomSelect.displayName = 'CustomSelect'
