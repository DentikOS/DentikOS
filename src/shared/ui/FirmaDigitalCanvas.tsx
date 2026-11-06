import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Eraser, Upload, PenTool, Type, Image as ImageIcon } from 'lucide-react'

export type ModoFirma = 'subir' | 'dibujar' | 'tipografica'
export type EstiloFirma = 'elegante' | 'moderno' | 'clasico'

export interface FirmaDigitalCanvasProps {
  modo?: ModoFirma
  alGuardarFirma?: (dataUrl: string) => void
  alLimpiarFirma?: () => void
  resetSignal?: number
}

export const FirmaDigitalCanvas: React.FC<FirmaDigitalCanvasProps> = ({
  modo: modoInicial = 'dibujar',
  alGuardarFirma,
  alLimpiarFirma,
  resetSignal = 0,
}) => {
  const [modo, setModo] = useState<ModoFirma>(modoInicial)
  const [estilo, setEstilo] = useState<EstiloFirma>('elegante')
  const [textoFirma, setTextoFirma] = useState<string>('')
  const [dibujando, setDibujando] = useState<boolean>(false)
  const [previewSubida, setPreviewSubida] = useState<string | null>(null)
  const [errorSubida, setErrorSubida] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const configurarContexto = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#000000'
    }
  }, [])

  useEffect(() => {
    configurarContexto()
  }, [configurarContexto, modo])

  const limpiarCanvas = useCallback((): void => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setPreviewSubida(null)
    setTextoFirma('')
    setErrorSubida(null)
    if (alLimpiarFirma) alLimpiarFirma()
  }, [alLimpiarFirma])

  useEffect(() => {
    if (resetSignal === 0) return
    limpiarCanvas()
  }, [resetSignal, limpiarCanvas])

  const renderizarFirmaTipografica = useCallback((texto: string, estiloSeleccionado: EstiloFirma) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!texto.trim()) return

    if (estiloSeleccionado === 'elegante') {
      ctx.font = 'italic 34px "Brush Script MT", "Caveat", "Segoe Script", cursive'
      ctx.fillStyle = '#0f172a'
    } else if (estiloSeleccionado === 'moderno') {
      ctx.font = 'bold 26px "Inter", "Helvetica Neue", sans-serif'
      ctx.fillStyle = '#1e293b'
    } else {
      ctx.font = 'normal 28px "Georgia", "Times New Roman", serif'
      ctx.fillStyle = '#000000'
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(texto.trim(), canvas.width / 2, canvas.height / 2)

    // Línea sutil decorativa bajo la firma
    ctx.beginPath()
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1
    ctx.moveTo(canvas.width * 0.15, canvas.height * 0.75)
    ctx.lineTo(canvas.width * 0.85, canvas.height * 0.75)
    ctx.stroke()

    const dataUrl = canvas.toDataURL('image/png')
    if (alGuardarFirma) alGuardarFirma(dataUrl)
  }, [alGuardarFirma])

  const handleTextoFirmaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTextoFirma(val)
    renderizarFirmaTipografica(val, estilo)
  }

  const handleCambiarEstilo = (nuevoEstilo: EstiloFirma) => {
    setEstilo(nuevoEstilo)
    renderizarFirmaTipografica(textoFirma, nuevoEstilo)
  }

  const handleSubirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorSubida(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setErrorSubida('La imagen no debe superar los 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setPreviewSubida(dataUrl)
      if (alGuardarFirma) alGuardarFirma(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const obtenerCoordenadas = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const iniciarDibujo = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): void => {
    setDibujando(true)
    const { x, y } = obtenerCoordenadas(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const dibujar = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): void => {
    if (!dibujando) return
    if ('cancelable' in e && e.cancelable) e.preventDefault()
    const { x, y } = obtenerCoordenadas(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const detenerDibujo = (): void => {
    if (dibujando && canvasRef.current) {
      setDibujando(false)
      const dataUrl = canvasRef.current.toDataURL('image/png')
      if (alGuardarFirma) alGuardarFirma(dataUrl)
    }
  }


  return (
    <div className="space-y-3">
      {/* Selector de modo */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl max-w-sm">
        <button
          type="button"
          onClick={() => { setModo('dibujar'); limpiarCanvas() }}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition ${
            modo === 'dibujar' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <PenTool size={13} /> <span>Dibujar</span>
        </button>
        <button
          type="button"
          onClick={() => { setModo('subir'); limpiarCanvas() }}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition ${
            modo === 'subir' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Upload size={13} /> <span>Subir</span>
        </button>
        <button
          type="button"
          onClick={() => { setModo('tipografica'); limpiarCanvas() }}
          className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition ${
            modo === 'tipografica' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Type size={13} /> <span>Escribir</span>
        </button>
      </div>

      {/* Modo 1: Subir imagen */}
      {modo === 'subir' && (
        <div className="space-y-2 max-w-md">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-[#D4AF37] rounded-xl p-4 bg-gray-50 dark:bg-slate-900/50 cursor-pointer transition text-center">
            <ImageIcon size={28} className="text-gray-400 mb-1" />
            <span className="text-xs font-medium text-gray-700 dark:text-slate-300">Seleccionar imagen de tu firma</span>
            <span className="text-[11px] text-gray-400">PNG, JPG o SVG transparente (Máx 2MB)</span>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleSubirArchivo} className="hidden" />
          </label>
          {errorSubida && <p className="text-xs text-red-500">{errorSubida}</p>}
          {previewSubida && (
            <div className="p-3 border rounded-xl bg-white dark:bg-slate-900 flex justify-between items-center">
              <img src={previewSubida} alt="Firma subida" className="h-12 object-contain" />
              <button type="button" onClick={limpiarCanvas} className="text-xs text-red-500 hover:underline">Eliminar</button>
            </div>
          )}
        </div>
      )}

      {/* Modo 3: Firma tipográfica */}
      {modo === 'tipografica' && (
        <div className="space-y-2 max-w-md">
          <input
            type="text"
            value={textoFirma}
            onChange={handleTextoFirmaChange}
            placeholder="Escribe tu nombre (ej. Dr. Miguel Díaz)"
            className="w-full p-2.5 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
          <div className="flex gap-2 text-xs">
            {(['elegante', 'moderno', 'clasico'] as EstiloFirma[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleCambiarEstilo(st)}
                className={`flex-1 py-1 px-2 rounded-lg border text-xs capitalize ${
                  estilo === st ? 'border-[#D4AF37] bg-[#D4AF37]/15 font-semibold text-[#D4AF37]' : 'border-gray-200 dark:border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas interactivo (para Dibujar y renderizado Tipográfico) */}
      <div className={modo === 'subir' ? 'hidden' : 'block'}>
        <div className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-1 bg-white dark:bg-slate-900 inline-block">
          <canvas
            ref={canvasRef}
            width={380}
            height={130}
            className={`touch-none bg-gray-50/50 dark:bg-slate-900/50 rounded-xl ${modo === 'dibujar' ? 'cursor-crosshair' : 'cursor-default'}`}
            onMouseDown={modo === 'dibujar' ? iniciarDibujo : undefined}
            onMouseMove={modo === 'dibujar' ? dibujar : undefined}
            onMouseUp={modo === 'dibujar' ? detenerDibujo : undefined}
            onMouseLeave={modo === 'dibujar' ? detenerDibujo : undefined}
            onTouchStart={modo === 'dibujar' ? iniciarDibujo : undefined}
            onTouchMove={modo === 'dibujar' ? dibujar : undefined}
            onTouchEnd={modo === 'dibujar' ? detenerDibujo : undefined}
          />
        </div>
        <div className="mt-1">
          <button
            type="button"
            onClick={limpiarCanvas}
            className="text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1 rounded-lg transition-colors"
          >
            <span className="inline-flex items-center gap-1"><Eraser size={12} /> Limpiar Firma</span>
          </button>
        </div>
      </div>
    </div>
  )
}

FirmaDigitalCanvas.displayName = 'FirmaDigitalCanvas'
