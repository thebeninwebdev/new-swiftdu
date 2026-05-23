'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'phrases-not-supported'
  | 'service-not-allowed'

interface SpeechRecognitionAlternative {
  transcript: string
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent {
  readonly error: SpeechRecognitionErrorCode
  readonly message?: string
}

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  continuous: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface UseSpeechRecognitionOptions {
  onTranscript: (value: string) => void
  onStart?: () => void
  onCaptured?: () => void
  onError?: (error: SpeechRecognitionErrorCode) => void
}

function combineTranscript(baseText: string, transcript: string) {
  const nextTranscript = transcript.trim()
  if (!baseText) return nextTranscript
  if (!nextTranscript) return baseText
  return `${baseText}\n${nextTranscript}`
}

export function useSpeechRecognition({
  onTranscript,
  onStart,
  onCaptured,
  onError,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const baseTextRef = useRef('')
  const capturedTextRef = useRef('')
  const reportedErrorRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(Boolean(SpeechRecognition))

    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const startListening = useCallback(
    (initialText = '') => {
      if (typeof window === 'undefined') return

      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition

      if (!SpeechRecognition) {
        setIsSupported(false)
        onError?.('language-not-supported')
        return
      }

      recognitionRef.current?.abort()

      const recognition = new SpeechRecognition()
      recognition.lang = 'en-NG'
      recognition.interimResults = true
      recognition.continuous = false

      baseTextRef.current = initialText.trim()
      capturedTextRef.current = ''
      reportedErrorRef.current = false

      recognition.onstart = () => {
        setIsListening(true)
        onStart?.()
      }

      recognition.onresult = (event) => {
        let transcript = ''

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          transcript += result[0]?.transcript || ''
        }

        capturedTextRef.current = transcript
        onTranscript(combineTranscript(baseTextRef.current, transcript))
      }

      recognition.onerror = (event) => {
        reportedErrorRef.current = true
        setIsListening(false)
        onError?.(event.error)
      }

      recognition.onend = () => {
        setIsListening(false)
        recognitionRef.current = null

        if (capturedTextRef.current.trim() && !reportedErrorRef.current) {
          onTranscript(combineTranscript(baseTextRef.current, capturedTextRef.current))
          onCaptured?.()
        }
      }

      recognitionRef.current = recognition

      try {
        recognition.start()
      } catch {
        reportedErrorRef.current = true
        setIsListening(false)
        recognitionRef.current = null
        onError?.('aborted')
      }
    },
    [onCaptured, onError, onStart, onTranscript]
  )

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  }
}
