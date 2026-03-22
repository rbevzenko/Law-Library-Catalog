import { useState } from 'react'

export function useSettings() {
  const [yadiskToken, setYadiskTokenState] = useState(
    () => localStorage.getItem('lex_yadisk_token') || ''
  )
  const [githubToken, setGithubTokenState] = useState(
    () => localStorage.getItem('lex_github_token') || ''
  )
  const [anthropicKey, setAnthropicKeyState] = useState(
    () => localStorage.getItem('lex_anthropic_key') || ''
  )
  const [booksFolder, setBooksFolder] = useState(
    () => localStorage.getItem('lex_books_folder') || ''
  )

  function setYadiskToken(value) {
    if (value) localStorage.setItem('lex_yadisk_token', value)
    else localStorage.removeItem('lex_yadisk_token')
    setYadiskTokenState(value)
  }

  function setGithubToken(value) {
    if (value) localStorage.setItem('lex_github_token', value)
    else localStorage.removeItem('lex_github_token')
    setGithubTokenState(value)
  }

  function setAnthropicKey(value) {
    if (value) localStorage.setItem('lex_anthropic_key', value)
    else localStorage.removeItem('lex_anthropic_key')
    setAnthropicKeyState(value)
  }

  function updateBooksFolder(value) {
    if (value) localStorage.setItem('lex_books_folder', value)
    else localStorage.removeItem('lex_books_folder')
    setBooksFolder(value || '')
  }

  return {
    yadiskToken, setYadiskToken,
    githubToken, setGithubToken,
    anthropicKey, setAnthropicKey,
    booksFolder, setBooksFolder: updateBooksFolder,
  }
}
