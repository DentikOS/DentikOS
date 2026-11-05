import type { BoxClinico } from '../../../organization/clinic/schemas/boxSchema'
import type { EquipamientoClinicoId } from '../../../../shared/constants/equipamientoClinico'

export const filtrarBoxesCompatibles = (
  boxes: readonly BoxClinico[],
  equipamientoRequerido: readonly EquipamientoClinicoId[]
): BoxClinico[] => boxes.filter((box) =>
  box.estado === 'activo' && equipamientoRequerido.every((equipo) =>
    box.equipamiento.some((disponible) => disponible.tipo === equipo)
  )
)
