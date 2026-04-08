import { useState, useEffect } from 'react'

const PIN_KEY = 'law_library_pin_hash'
const SESSION_KEY = 'law_library_session'

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function useAuth() {
  const [pinHash, setPinHash] = useState(() => localStorage.getItem(PIN_KEY))
  const [unlocked, setUnlocked] = useState(() => {
    if (!localStorage.getItem(PIN_KEY)) return true
    return sessionStorage.getItem(SESSION_KEY) === '1'
  })

  // If PIN was removed from another tab/context, re-sync
  useEffect(() => {
    function onStorage(e) {
      if (e.key === PIN_KEY) {
        const h = e.newValue
        setPinHash(h)
        if (!h) setUnlocked(true)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  async function unlock(pin) {
    const hash = await sha256(pin)
    if (hash === pinHash) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setUnlocked(true)
      return true
    }
    return false
  }

  async function setPin(pin) {
    const hash = await sha256(pin)
    localStorage.setItem(PIN_KEY, hash)
    sessionStorage.setItem(SESSION_KEY, '1')
    setPinHash(hash)
    setUnlocked(true)
  }

  async function changePin(currentPin, newPin) {
    const hash = await sha256(currentPin)
    if (hash !== pinHash) return false
    await setPin(newPin)
    return true
  }

  async function removePin(pin) {
    const hash = await sha256(pin)
    if (hash !== pinHash) return false
    localStorage.removeItem(PIN_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setPinHash(null)
    setUnlocked(true)
    return true
  }

  function lock() {
    sessionStorage.removeItem(SESSION_KEY)
    setUnlocked(false)
  }

  return { pinSet: !!pinHash, unlocked, unlock, setPin, changePin, removePin, lock }
}
