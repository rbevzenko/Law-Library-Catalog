import { useState, useEffect } from 'react'
import { getOrCreateSalt, clearSalt, deriveKey, exportKey, importKey } from '../utils/crypto'

const PIN_KEY = 'law_library_pin_hash'
const SESSION_KEY = 'law_library_session'
const CRYPTO_SESSION_KEY = 'law_library_crypto_key'

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function deriveAndStore(pin) {
  const salt = await getOrCreateSalt()
  const key = await deriveKey(pin, salt)
  sessionStorage.setItem(CRYPTO_SESSION_KEY, await exportKey(key))
  return key
}

export function useAuth() {
  const [pinHash, setPinHash] = useState(() => localStorage.getItem(PIN_KEY))
  const [unlocked, setUnlocked] = useState(() => {
    if (!localStorage.getItem(PIN_KEY)) return true
    return sessionStorage.getItem(SESSION_KEY) === '1'
  })
  const [cryptoKey, setCryptoKey] = useState(null)

  // Restore crypto key from sessionStorage on page reload
  useEffect(() => {
    const pinH = localStorage.getItem(PIN_KEY)
    const sessionActive = sessionStorage.getItem(SESSION_KEY) === '1'
    if (pinH && sessionActive) {
      const jwkStr = sessionStorage.getItem(CRYPTO_SESSION_KEY)
      if (jwkStr) {
        importKey(jwkStr).then(key => setCryptoKey(key)).catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    function onStorage(e) {
      if (e.key === PIN_KEY) {
        const h = e.newValue
        setPinHash(h)
        if (!h) { setUnlocked(true); setCryptoKey(null) }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  async function unlock(pin) {
    const hash = await sha256(pin)
    if (hash !== pinHash) return false
    sessionStorage.setItem(SESSION_KEY, '1')
    setUnlocked(true)
    const key = await deriveAndStore(pin)
    setCryptoKey(key)
    return true
  }

  async function setPin(pin) {
    const hash = await sha256(pin)
    localStorage.setItem(PIN_KEY, hash)
    sessionStorage.setItem(SESSION_KEY, '1')
    setPinHash(hash)
    setUnlocked(true)
    const key = await deriveAndStore(pin)
    setCryptoKey(key)
  }

  // Returns new CryptoKey on success, null on wrong current PIN
  async function changePin(currentPin, newPin) {
    const hash = await sha256(currentPin)
    if (hash !== pinHash) return null
    clearSalt()
    const newHash = await sha256(newPin)
    localStorage.setItem(PIN_KEY, newHash)
    setPinHash(newHash)
    const key = await deriveAndStore(newPin)
    setCryptoKey(key)
    return key
  }

  async function removePin(pin) {
    const hash = await sha256(pin)
    if (hash !== pinHash) return false
    localStorage.removeItem(PIN_KEY)
    clearSalt()
    sessionStorage.removeItem(CRYPTO_SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setPinHash(null)
    setCryptoKey(null)
    setUnlocked(true)
    return true
  }

  function lock() {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(CRYPTO_SESSION_KEY)
    setCryptoKey(null)
    setUnlocked(false)
  }

  return { pinSet: !!pinHash, unlocked, unlock, setPin, changePin, removePin, lock, cryptoKey }
}
