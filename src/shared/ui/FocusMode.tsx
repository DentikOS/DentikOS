import React from 'react'

/**
 * FocusMode — Marcador lógico para Modo Foco (Blueprint 03 §09)
 *
 * Este componente es un marcador lógico. La UI del Modo Foco
 * (TopBar mínimo con timer + guardar + salir) se renderiza en App.tsx
 * vía FocusModeTopBar cuando focusMode=true.
 *
 * Se mantiene exportado por compatibilidad con imports existentes
 * y para futuras extensiones (ej: overlays contextuales).
 *
 * Elementos del Modo Foco según Blueprint 03 §09:
 * - Timer de atención (en FocusModeTopBar)
 * - Botón Guardar (en FocusModeTopBar)
 * - Botón "Salir" (Esc) (en FocusModeTopBar)
 * - Estado de guardado (●/✓) (en FocusModeTopBar)
 * - Búsqueda ⌘K (oculta)
 * - Sede / Notif / Avatar (ocultos)
 * - Sidebar (oculto automáticamente)
 *
 * Notificaciones críticas: siguen apareciendo como toasts flotantes
 * vía ToastContainer (ya montado en App.tsx), con borde rojo #E11D48
 * y sonido 220Hz. No actualizan el badge porque el icono está oculto.
 */
export const FocusMode: React.FC = () => {
  // No renderiza UI propia — el TopBar mínimo está en App.tsx
  // Este componente existe como marcador lógico y punto de extensión
  return null
}

FocusMode.displayName = 'FocusMode'
