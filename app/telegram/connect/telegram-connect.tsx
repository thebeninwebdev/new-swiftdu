'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { authClient } from '@/lib/auth-client'

type Preview = {
  account: { name: string; email: string }
  telegram: { name: string; username?: string }
}
type ViewState =
  | { kind: 'loading' }
  | { kind: 'preview'; data: Preview }
  | { kind: 'invalid' }
  | { kind: 'blocked'; message: string }
  | { kind: 'success'; returnUrl: string }

function Card({ children }: { children: React.ReactNode }) {
  return <main className='flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8'>
    <section className='w-full max-w-md rounded-3xl border bg-white p-6 shadow-xl'>
      <Image src='/logo.png' alt='SwiftDU' width={48} height={48} className='mb-8 h-11 w-auto' />
      {children}
    </section>
  </main>
}

export function TelegramConnect() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const { data: session, isPending } = authClient.useSession()
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [confirming, setConfirming] = useState(false)
  const signInPath = useMemo(() => {
    const next = '/telegram/connect?token=' + encodeURIComponent(token)
    return '/auth?next=' + encodeURIComponent(next)
  }, [token])

  useEffect(() => {
    if (isPending || !session?.user) return
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setState({ kind: 'invalid' })
      return
    }
    const controller = new AbortController()
    fetch('/api/telegram/link/preview?token=' + encodeURIComponent(token), {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      const body = await response.json().catch(() => ({})) as Preview & { error?: string }
      if (response.ok) setState({ kind: 'preview', data: body })
      else if (response.status === 410) setState({ kind: 'invalid' })
      else setState({ kind: 'blocked', message: body.error || 'This account cannot be connected to Telegram.' })
    }).catch(error => {
      if (error.name !== 'AbortError') setState({ kind: 'blocked', message: 'We could not check this connection link. Please try again.' })
    })
    return () => controller.abort()
  }, [isPending, session?.user, token])

  async function confirm() {
    setConfirming(true)
    const response = await fetch('/api/telegram/link/confirm', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const body = await response.json().catch(() => ({})) as {
      connected?: boolean
      returnUrl?: string
      error?: string
    }
    setConfirming(false)
    if (response.ok && body.connected) {
      window.history.replaceState({}, '', '/telegram/connect')
      setState({ kind: 'success', returnUrl: body.returnUrl || 'https://t.me' })
    } else if (response.status === 410) {
      setState({ kind: 'invalid' })
    } else {
      setState({ kind: 'blocked', message: body.error || 'We could not connect Telegram. Please try again.' })
    }
  }

  if (isPending) {
    return <Card><div className='flex min-h-64 items-center justify-center'>
      <Loader2 className='h-7 w-7 animate-spin text-indigo-600' aria-label='Loading' />
    </div></Card>
  }
  if (!session?.user) {
    return <Card>
      <ShieldCheck className='h-12 w-12 text-indigo-600' />
      <h1 className='mt-5 text-2xl font-semibold text-slate-950'>Connect Your Telegram Account</h1>
      <p className='mt-3 leading-7 text-slate-600'>Sign in to SwiftDU to connect your Telegram account and access staff operations.</p>
      <Link href={signInPath} className='mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white'>
        Sign in to SwiftDU
      </Link>
      <p className='mt-5 text-center text-sm text-slate-500'>The connection link stays securely within SwiftDU during sign-in.</p>
    </Card>
  }
  if (state.kind === 'loading') {
    return <Card><div className='flex min-h-64 items-center justify-center'>
      <Loader2 className='h-7 w-7 animate-spin text-indigo-600' aria-label='Checking connection' />
    </div></Card>
  }
  if (state.kind === 'invalid') {
    return <Card>
      <TriangleAlert className='h-12 w-12 text-amber-500' />
      <h1 className='mt-5 text-2xl font-semibold text-slate-950'>This connection link has expired</h1>
      <p className='mt-3 leading-7 text-slate-600'>For security, Telegram connection links are valid for 10 minutes.</p>
      <p className='mt-3 leading-7 text-slate-600'>Please return to the bot and request a new link.</p>
    </Card>
  }
  if (state.kind === 'blocked') {
    return <Card>
      <TriangleAlert className='h-12 w-12 text-rose-500' />
      <h1 className='mt-5 text-2xl font-semibold text-slate-950'>Connection unavailable</h1>
      <p className='mt-3 leading-7 text-slate-600'>{state.message}</p>
      <p className='mt-3 text-sm text-slate-500'>If you believe this is a mistake, contact a SwiftDU administrator.</p>
    </Card>
  }
  if (state.kind === 'success') {
    return <Card>
      <CheckCircle2 className='h-12 w-12 text-emerald-600' />
      <h1 className='mt-5 text-2xl font-semibold text-slate-950'>Telegram Connected Successfully</h1>
      <p className='mt-3 leading-7 text-slate-600'>Your Telegram account has been securely linked to SwiftDU.</p>
      <p className='mt-3 leading-7 text-slate-600'>You can now return to Telegram and use the Operations Desk.</p>
      <a href={state.returnUrl} rel='noreferrer' className='mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white'>
        Return to Telegram
      </a>
      <p className='mt-5 text-center text-sm text-slate-500'>If Telegram does not open, return to the bot and send /start.</p>
    </Card>
  }
  return <Card>
    <ShieldCheck className='h-12 w-12 text-indigo-600' />
    <h1 className='mt-5 text-2xl font-semibold text-slate-950'>Connect Telegram to SwiftDU</h1>
    <p className='mt-3 leading-7 text-slate-600'>You are connecting:</p>
    <dl className='mt-5 space-y-4 rounded-2xl bg-slate-50 p-5 text-sm'>
      <div>
        <dt className='text-slate-500'>SwiftDU account</dt>
        <dd className='mt-1 font-semibold text-slate-900'>{state.data.account.name}</dd>
        <dd className='text-slate-600'>{state.data.account.email}</dd>
      </div>
      <div className='border-t border-slate-200 pt-4'>
        <dt className='text-slate-500'>Telegram account</dt>
        <dd className='mt-1 font-semibold text-slate-900'>{state.data.telegram.name}</dd>
        {state.data.telegram.username && <dd className='text-slate-600'>@{state.data.telegram.username}</dd>}
      </div>
    </dl>
    <p className='mt-5 text-sm leading-6 text-slate-600'>Once connected, you can use SwiftDU Operations Desk to assist customers and manage orders directly from Telegram.</p>
    <button type='button' onClick={confirm} disabled={confirming} className='mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 font-semibold text-white disabled:opacity-60'>
      {confirming && <Loader2 className='h-4 w-4 animate-spin' />}
      Confirm Connection
    </button>
  </Card>
}
