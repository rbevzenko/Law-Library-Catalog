const SALT_KEY = 'law_library_enc_salt'
const PBKDF2_ITERATIONS = 200_000

export async function getOrCreateSalt() {
  const stored = localStorage.getItem(SALT_KEY)
  if (stored) return Uint8Array.from(atob(stored), c => c.charCodeAt(0))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...salt)))
  return salt
}

export function clearSalt() {
  localStorage.removeItem(SALT_KEY)
}

export async function deriveKey(pin, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function encryptText(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  return JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  })
}

export async function decryptText(stored, key) {
  try {
    const { iv, ct } = JSON.parse(stored)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Uint8Array.from(atob(iv), c => c.charCodeAt(0)) },
      key,
      Uint8Array.from(atob(ct), c => c.charCodeAt(0))
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

export async function exportKey(key) {
  return JSON.stringify(await crypto.subtle.exportKey('jwk', key))
}

export async function importKey(jwkStr) {
  return crypto.subtle.importKey('jwk', JSON.parse(jwkStr), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}
