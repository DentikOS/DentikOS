import React from 'react'

export const destacarCoincidencias = (
  texto: string,
  busqueda: string
): React.ReactNode => {
  if (!busqueda.trim() || !texto) return texto

  const escaped = busqueda.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const partes = texto.split(regex)

  return (
    <>
      <span className="sr-only">{texto}</span>
      <span aria-hidden="true">
        {partes.map((parte, i) =>
          regex.test(parte) ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 text-inherit rounded px-0.5">
              {parte}
            </mark>
          ) : (
            parte
          )
        )}
      </span>
    </>
  )
}
