import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseDictadoReturn {
  estaDictando: boolean
  textoDictado: string
  iniciarDictado: () => Promise<void>
  detenerDictado: () => void
  limpiarDictado: () => void
}

interface ISpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: unknown) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition

export const useDictado = (): UseDictadoReturn => {
  const [estaDictando, setEstaDictando] = useState<boolean>(false)
  const [textoDictado, setTextoDictado] = useState<string>('')
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // Cleanup seguro
        }
      }
    }
  }, [])

  const iniciarDictado = useCallback(async () => {
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      }
    } catch {
      window.alert('No se pudo acceder al micrófono. Por favor, permite el acceso para dictado.')
      return
    }

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      window.alert('El reconocimiento de voz nativo requiere Chrome o Edge (Web Speech API).')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'es-CL'

      recognition.onresult = (event: unknown) => {
        const ev = event as { resultIndex: number; results: Array<Array<{ transcript: string }>> }
        const currentResult = ev.results[ev.resultIndex]
        if (currentResult && currentResult[0]) {
          const transcript = currentResult[0].transcript
          setTextoDictado(transcript.trim())
        }
      }

      recognition.onerror = () => {
        setEstaDictando(false)
      }

      recognition.onend = () => {
        setEstaDictando(false)
      }

      recognitionRef.current = recognition
      recognition.start()
      setEstaDictando(true)
    } catch {
      setEstaDictando(false)
    }
  }, [])

  const detenerDictado = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Detener silenciosamente
      }
    }
    setEstaDictando(false)
  }, [])

  const limpiarDictado = useCallback(() => {
    setTextoDictado('')
  }, [])

  return {
    estaDictando,
    textoDictado,
    iniciarDictado,
    detenerDictado,
    limpiarDictado,
  }
}
