import React from 'react'

export interface CargandoModuloProps {
  titulo?: string
}

export const CargandoModulo: React.FC<CargandoModuloProps> = ({ titulo = 'módulo' }) => (
  <section
    className="loading-skeleton space-y-5 print:hidden"
    role="status"
    aria-label={'Cargando ' + titulo}
    aria-busy="true"
  >
    <span className="sr-only">Cargando {titulo}…</span>
    <div className="rounded-2xl border border-surface-border bg-surface/90 p-5 shadow-xs">
      <div className="flex items-start gap-4">
        <div data-skeleton className="h-12 w-12 shrink-0 rounded-2xl bg-graphite-200 dark:bg-graphite-800 animate-pulse" />
        <div className="min-w-0 flex-1 space-y-3">
          <div data-skeleton className="h-6 w-2/3 rounded-lg bg-graphite-200 dark:bg-graphite-800 animate-pulse" />
          <div data-skeleton className="h-3 w-full max-w-xl rounded bg-graphite-100 dark:bg-graphite-800 animate-pulse" />
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} data-skeleton className="h-24 rounded-2xl border border-surface-border bg-surface/80 animate-pulse" />
      ))}
    </div>
    <div data-skeleton className="h-64 rounded-2xl border border-surface-border bg-surface/80 animate-pulse" />
  </section>
)

CargandoModulo.displayName = 'CargandoModulo'
