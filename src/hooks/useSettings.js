import { useState } from 'react'

export function useSettings() {
  const [yadiskToken, setYadiskTokenState] = useState(
    () => localStorage.getItem('lex_yadisk_token') || ''
  )
  const [anthropicKey, setAnthropicKeyState] = useState(
    () => localStorage.getItem('lex_anthropic_key') || ''
  )

  function setYadiskToken(value) {
    if (value) {
      localStorage.setItem('lex_yadisk_token', value)
    } else {
      localStorage.removeItem('lex_yadisk_token')
    }
    setYadiskTokenState(value)
  }

  function setAnthropicKey(value) {
    if (value) {
      localStorage.setItem('lex_anthropic_key', value)
    } else {
      localStorage.removeItem('lex_anthropic_key')
    }
    setAnthropicKeyState(value)
  }

  return { yadiskToken, setYadiskToken, anthropicKey, setAnthropicKey }
}
