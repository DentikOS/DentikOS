/**
 * CommandPalette — Búsqueda omnicanal ⌘K con 6 categorías y backdrop blur [12px]
 * Blueprint 03: Pacientes, Citas, Módulos, Acciones, Configuración y Documentos.
 */
import React, { useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, CornerDownLeft } from 'lucide-react'
import {
  PALETTE_CATEGORIA_ICONS,
  PALETTE_CATEGORIA_LABELS,
  type PaletteResult,
} from '../../constants/commandPaletteConstants'
import { useSidebarStore } from '../../app/stores/useSidebarStore'

export interface CommandPaletteProps {
  isOpen: boolean
  query: string
  setQuery: (q: string) => void
  selectedIndex: number
  allResults: PaletteResult[]
  close: () => void
  selectCurrent: () => void
  handleSelect?: (r: PaletteResult) => void
  moveUp: () => void
  moveDown: () => void
}

const overlayStyles: Record<string, string> = {
  light: 'bg-[rgba(248,250,252,0.6)]',
  dark: 'bg-[rgba(7,11,20,0.5)]',
  surgical: 'bg-[rgba(203,213,225,0.6)]',
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen, query, setQuery, selectedIndex, allResults, close, selectCurrent, handleSelect, moveUp, moveDown,
}) => {
  const theme = useSidebarStore((s) => s.theme)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  // Agrupar resultados por categoría (Blueprint 03 §03)
  const groupedResults = useMemo(() => {
    const groups: Record<string, PaletteResult[]> = {}
    allResults.forEach((res) => {
      const cat = res.categoria || res.tipo || 'otros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(res)
    })
    return groups
  }, [allResults])

  const flatItems = useMemo(() => Object.values(groupedResults).flat(), [groupedResults])

  useEffect(() => {
    const el = itemRefs.current[selectedIndex]
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveDown() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveUp() }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatItems[selectedIndex] || allResults[selectedIndex]
      if (item && handleSelect) handleSelect(item)
      else selectCurrent()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
          {/* Backdrop blur [12px] con overlay específico por tema (BP03 §03) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className={`absolute inset-0 backdrop-blur-[12px] ${overlayStyles[theme] || overlayStyles.dark}`}
            aria-hidden="true"
          />

          {/* Palette container: 560px max */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-[560px] max-w-[90vw] sm:max-w-[92vw] max-h-[70vh] sm:max-h-[420px] bg-white dark:bg-graphite-950 surgical:bg-graphite-200 rounded-2xl shadow-2xl border border-surface flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos"
          >
            {/* Input de búsqueda */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface bg-graphite-50/50 dark:bg-graphite-900/40">
              <Search size={18} className="text-primary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar pacientes, citas, módulos o acciones..."
                className="flex-1 bg-transparent text-sm font-medium text-graphite-900 dark:text-graphite-100 placeholder:text-graphite-400 focus:outline-none"
                aria-label="Entrada de búsqueda"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 text-graphite-400 hover:text-graphite-700 dark:hover:text-graphite-200 rounded"
                >
                  <X size={15} />
                </button>
              ) : (
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-graphite-900 border border-surface rounded text-graphite-400">
                  Esc
                </kbd>
              )}
            </div>

            {/* Lista de resultados agrupada por categoría */}
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {flatItems.length === 0 ? (
                <div className="py-12 text-center text-graphite-400">
                  <p className="text-xs font-semibold">No se encontraron resultados</p>
                  <p className="text-[11px] mt-0.5">Intenta con otro término o abreviatura</p>
                </div>
              ) : (
                Object.entries(groupedResults).map(([categoria, items]) => {
                  const catLabel = PALETTE_CATEGORIA_LABELS[categoria] || categoria

                  return (
                    <div key={categoria} className="space-y-1">
                      {/* Header de categoría */}
                      <div className="px-3 py-1.5 text-[11px] font-medium text-[#94A3B8] dark:text-[#64748B] uppercase tracking-wider">
                        {catLabel}
                      </div>

                      {/* Items de esta categoría */}
                      {items.map((item) => {
                        const globalIndex = flatItems.indexOf(item)
                        const isSelected = globalIndex === selectedIndex
                        const IconComp =
                          item.icono ||
                          PALETTE_CATEGORIA_ICONS[item.tipo] ||
                          PALETTE_CATEGORIA_ICONS[item.categoria || ''] ||
                          Search
                        const description = item.descripcion || item.sublabel

                        return (
                          <button
                            key={item.id}
                            ref={(el) => { itemRefs.current[globalIndex] = el }}
                            type="button"
                            onClick={() => {
                              if (handleSelect) handleSelect(item)
                              else if (item.ejecutar) item.ejecutar()
                              else if (item.action) item.action()
                              else selectCurrent()
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                              isSelected
                                ? 'bg-gold-light/70 dark:bg-graphite-800 text-graphite-900 dark:text-gold-satin shadow-2xs font-semibold'
                                : 'text-graphite-700 dark:text-graphite-300 hover:bg-graphite-100 dark:hover:bg-graphite-900'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${
                                  isSelected
                                    ? 'bg-primary text-black'
                                    : 'bg-graphite-100 dark:bg-graphite-800 text-graphite-500'
                                }`}
                              >
                                <IconComp size={15} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate leading-snug">{item.label}</p>
                                {description && (
                                  <p className="text-[10px] text-graphite-400 truncate mt-0.5 leading-snug">
                                    {description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {isSelected && (
                              <CornerDownLeft size={13} className="text-primary shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer de navegación por teclado */}
            <div className="px-4 py-2 border-t border-surface bg-graphite-50/40 dark:bg-graphite-900/30 flex items-center justify-between text-[11px] text-graphite-400">
              <div className="flex items-center gap-2">
                <span><kbd className="px-1 py-0.5 rounded bg-surface border border-surface font-mono">↑↓</kbd> Navegar</span>
                <span><kbd className="px-1 py-0.5 rounded bg-surface border border-surface font-mono">↵</kbd> Seleccionar</span>
              </div>
              <span>6 Categorías Clínicas</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

CommandPalette.displayName = 'CommandPalette'
