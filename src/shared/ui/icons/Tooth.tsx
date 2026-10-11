/**
 * Tooth — Icono custom del dominio dental (F10-B1)
 *
 * Lucide-react no incluye un icono de diente, y el diente es central en la UI
 * clínica (odontograma, piezas, hallazgos). Este componente replica la
 * API de lucide (size/color/strokeWidth/className) para ser intercambiable
 * vía <Icon icon={Tooth} />.
 *
 * Diseño: molar outline de trazo continuo (corona + 2 raíces),
 * coherente con el peso visual de lucide (strokeWidth 1.75 por defecto
 * aplicado por <Icon>).
 *
 * Uso:
 *   import { Tooth } from '@/shared/ui/icons/Tooth'
 *   <Icon icon={Tooth} size="md" />
 *   <Icon icon={Tooth} size="sm" color="primary" />
 */
import React, { forwardRef } from 'react'

export interface ToothProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  color?: string
  strokeWidth?: number | string
  className?: string
}

export const Tooth = forwardRef<SVGSVGElement, ToothProps>(({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.75,
  className = '',
  ...props
}, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 5.5c-1.6-1.7-3.9-2.3-5.6-1.6C4.1 4.8 2.8 7 2.8 9.4c0 1.9.7 3.4 1.4 5 .6 1.4 1 2.9 1.2 4.5.1 1 .9 1.8 1.9 1.8.9 0 1.6-.6 1.8-1.5l.5-2.4c.2-1 1-1.7 2-1.7h.8c1 0 1.8.7 2 1.7l.5 2.4c.2.9.9 1.5 1.8 1.5 1 0 1.8-.8 1.9-1.8.2-1.6.6-3.1 1.2-4.5.7-1.6 1.4-3.1 1.4-5 0-2.4-1.3-4.6-3.6-5.5-1.7-.7-4-.1-5.6 1.6z" />
  </svg>
))

Tooth.displayName = 'Tooth'
