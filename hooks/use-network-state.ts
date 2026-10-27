'use client'

import { useCallback, useEffect, useState } from 'react'

export type LowDataPreference = 'automatic' | 'on' | 'off'

type NetworkInformationLike = EventTarget & {
  saveData?: boolean
  effectiveType?: string
}

const LOW_DATA_STORAGE_KEY = 'swiftdu-low-data-mode'

function connection() {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection
}

export function prefersLowData(preference: LowDataPreference, info?: { saveData?: boolean; effectiveType?: string }) {
  if (preference === 'on') return true
  if (preference === 'off') return false
  return Boolean(info?.saveData === true || info?.effectiveType === 'slow-2g' || info?.effectiveType === '2g')
}

function savedPreference(): LowDataPreference {
  if (typeof window === 'undefined') return 'automatic'
  try {
    const value = window.localStorage.getItem(LOW_DATA_STORAGE_KEY)
    return value === 'on' || value === 'off' ? value : 'automatic'
  } catch {
    return 'automatic'
  }
}

export function useNetworkState() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [preference, setPreferenceState] = useState<LowDataPreference>('automatic')
  const [lowData, setLowData] = useState(false)

  useEffect(() => {
    const info = connection()
    const update = () => {
      const nextPreference = savedPreference()
      setOnline(navigator.onLine)
      setPreferenceState(nextPreference)
      setLowData(prefersLowData(nextPreference, info))
    }
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('storage', update)
    info?.addEventListener('change', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('storage', update)
      info?.removeEventListener('change', update)
    }
  }, [])

  const setPreference = useCallback((value: LowDataPreference) => {
    try {
      if (value === 'automatic') window.localStorage.removeItem(LOW_DATA_STORAGE_KEY)
      else window.localStorage.setItem(LOW_DATA_STORAGE_KEY, value)
    } catch { /* Private browsing can block storage. */ }
    setPreferenceState(value)
    setLowData(prefersLowData(value, connection()))
  }, [])

  return { online, lowData, preference, setPreference }
}

export function useLowDataMode() {
  return useNetworkState().lowData
}
