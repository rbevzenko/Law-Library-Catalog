import { useState, useEffect } from 'react'
import { encryptText, decryptText } from '../utils/crypto'

const ENC = {
  yadiskToken:  { enc: 'lex_yadisk_token_enc',  plain: 'lex_yadisk_token',  session: 'lex_yadisk_token_s' },
  githubToken:  { enc: 'lex_github_token_enc',  plain: 'lex_github_token',  session: 'lex_github_token_s' },
  anthropicKey: { enc: 'lex_anthropic_key_enc', plain: 'lex_anthropic_key', session: 'lex_anthropic_key_s' },
}

async function readToken(keys, cryptoKey) {
  const enc = localStorage.getItem(keys.enc)
  if (enc) {
    const val = await decryptText(enc, cryptoKey)
    return val || ''
  }
  // Migrate plaintext → encrypted
  const plain = localStorage.getItem(keys.plain)
  if (plain) {
    localStorage.setItem(keys.enc, await encryptText(plain, cryptoKey))
    localStorage.removeItem(keys.plain)
    return plain
  }
  return ''
}

export function useSettings(cryptoKey, pinSet) {
  const [yadiskToken, setYadiskTokenState] = useState('')
  const [githubToken, setGithubTokenState] = useState('')
  const [anthropicKey, setAnthropicKeyState] = useState('')
  const [booksFolder, setBooksFolder] = useState(
    () => localStorage.getItem('lex_books_folder') || ''
  )

  useEffect(() => {
    if (cryptoKey) {
      Promise.all([
        readToken(ENC.yadiskToken, cryptoKey),
        readToken(ENC.githubToken, cryptoKey),
        readToken(ENC.anthropicKey, cryptoKey),
      ]).then(([yt, gt, ak]) => {
        setYadiskTokenState(yt)
        setGithubTokenState(gt)
        setAnthropicKeyState(ak)
      })
    } else if (!pinSet) {
      // No PIN: use sessionStorage (cleared when browser tab closes)
      setYadiskTokenState(sessionStorage.getItem(ENC.yadiskToken.session) || '')
      setGithubTokenState(sessionStorage.getItem(ENC.githubToken.session) || '')
      setAnthropicKeyState(sessionStorage.getItem(ENC.anthropicKey.session) || '')
    }
    // pinSet && !cryptoKey → app is locked, keep tokens empty
  }, [cryptoKey, pinSet])

  function persist(keys, value) {
    if (cryptoKey) {
      if (value) {
        encryptText(value, cryptoKey).then(enc => localStorage.setItem(keys.enc, enc))
      } else {
        localStorage.removeItem(keys.enc)
      }
      localStorage.removeItem(keys.plain)
    } else {
      // No PIN: sessionStorage only, remove any legacy plaintext
      if (value) sessionStorage.setItem(keys.session, value)
      else sessionStorage.removeItem(keys.session)
      localStorage.removeItem(keys.plain)
    }
  }

  function setYadiskToken(value) {
    setYadiskTokenState(value)
    persist(ENC.yadiskToken, value)
  }

  function setGithubToken(value) {
    setGithubTokenState(value)
    persist(ENC.githubToken, value)
  }

  function setAnthropicKey(value) {
    setAnthropicKeyState(value)
    persist(ENC.anthropicKey, value)
  }

  function updateBooksFolder(value) {
    if (value) localStorage.setItem('lex_books_folder', value)
    else localStorage.removeItem('lex_books_folder')
    setBooksFolder(value || '')
  }

  // Called after changePin: re-encrypt all tokens with new key
  async function reEncryptTokens(newKey) {
    for (const [keys, value] of [
      [ENC.yadiskToken, yadiskToken],
      [ENC.githubToken, githubToken],
      [ENC.anthropicKey, anthropicKey],
    ]) {
      if (value) {
        localStorage.setItem(keys.enc, await encryptText(value, newKey))
      } else {
        localStorage.removeItem(keys.enc)
      }
    }
  }

  // Called after removePin: move in-memory tokens to sessionStorage
  function migrateToSession() {
    for (const [keys, value] of [
      [ENC.yadiskToken, yadiskToken],
      [ENC.githubToken, githubToken],
      [ENC.anthropicKey, anthropicKey],
    ]) {
      if (value) sessionStorage.setItem(keys.session, value)
      else sessionStorage.removeItem(keys.session)
      localStorage.removeItem(keys.enc)
      localStorage.removeItem(keys.plain)
    }
  }

  return {
    yadiskToken, setYadiskToken,
    githubToken, setGithubToken,
    anthropicKey, setAnthropicKey,
    booksFolder, setBooksFolder: updateBooksFolder,
    reEncryptTokens,
    migrateToSession,
  }
}
