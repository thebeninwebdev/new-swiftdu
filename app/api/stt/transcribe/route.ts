import { NextResponse } from 'next/server'

const DEFAULT_STT_API_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:8000'
    : 'https://swiftdu-stt.onrender.com'

export async function POST(request: Request) {
  const sttApiUrl = process.env.STT_API_URL?.trim() || DEFAULT_STT_API_URL
  const sttApiKey = process.env.STT_API_KEY?.trim()

  if (!sttApiKey) {
    return NextResponse.json(
      { detail: 'Speech transcription is not configured.' },
      { status: 503 }
    )
  }

  const incomingForm = await request.formData()
  const file = incomingForm.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ detail: 'Audio file is required.' }, { status: 400 })
  }

  const outgoingForm = new FormData()
  outgoingForm.append('file', file, file.name || 'swiftdu-order.webm')

  try {
    const transcribeUrl = new URL('/transcribe', sttApiUrl)
    const response = await fetch(transcribeUrl, {
      method: 'POST',
      headers: {
        'x-api-key': sttApiKey,
      },
      body: outgoingForm,
    })

    const data = (await response.json().catch(() => null)) as
      | { text?: string; detail?: string }
      | null

    if (!response.ok) {
      return NextResponse.json(
        { detail: data?.detail || 'Transcription failed.', status: response.status },
        { status: response.status }
      )
    }

    return NextResponse.json({ text: data?.text || '' })
  } catch (error) {
    console.error('STT service request failed', error)
    return NextResponse.json(
      { detail: 'Speech transcription service is unavailable.' },
      { status: 502 }
    )
  }
}
