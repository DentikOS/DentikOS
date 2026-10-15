import React from 'react'
import { useDroppable } from '@dnd-kit/core'

export interface DroppableSlotProps {
  slotId: string
  data: Record<string, unknown>
  className?: string
  onClick?: () => void
  children?: React.ReactNode
}

export const DroppableSlot: React.FC<DroppableSlotProps> = ({
  slotId,
  data,
  className = '',
  onClick,
  children,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: slotId, data })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`${className} transition-colors ${
        isOver ? 'bg-[#B88E3A]/10 ring-2 ring-inset ring-[#B88E3A]' : ''
      }`}
    >
      {children}
    </div>
  )
}
