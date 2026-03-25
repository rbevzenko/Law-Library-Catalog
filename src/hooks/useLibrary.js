import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { downloadCatalogFromGist, uploadCatalogToGist } from '../api/github'
const LOCAL_KEY = 'lex-bibliotheca-catalog'

function saveLocal(books) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(books))
  } catch (e) {
    console.warn('localStorage save failed:', e)
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return Array.isArray(data) && data.length > 0 ? data : null
  } catch (e) {
    return null
  }
}

// Merge: last-write-wins by updatedAt
function mergeBooks(a, b) {
  const map = new Map()
  for (const book of b) map.set(book.id, book)
  for (const book of a) {
    const remote = map.get(book.id)
    if (!remote) {
      map.set(book.id, book)
    } else {
      const tA = new Date(book.updatedAt || 0).getTime()
      const tB = new Date(remote.updatedAt || 0).getTime()
      if (tA >= tB) map.set(book.id, book)
    }
  }
  return Array.from(map.values())
}

export function useLibrary(githubToken) {
  const [books, setBooks] = useState(() => loadLocal() || [])
  const [syncStatus, setSyncStatus] = useState('idle')
  const [syncError, setSyncError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const successTimerRef = useRef(null)

  // Persist to localStorage on every change
  useEffect(() => {
    saveLocal(books)
  }, [books])

  const markSuccess = useCallback(() => {
    setSyncStatus('success')
    setLastSyncedAt(new Date())
    setSyncError('')
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSyncStatus('idle'), 2000)
  }, [])

  // Background sync with GitHub Gist on load
  useEffect(() => {
    setInitialized(true)
    if (!githubToken) return

    let cancelled = false

    async function syncFromCloud() {
      setSyncStatus('syncing')
      try {
        const cloudData = await downloadCatalogFromGist(githubToken)
        if (cancelled) return

        if (Array.isArray(cloudData) && cloudData.length > 0) {
          setBooks(prev => mergeBooks(prev, cloudData))
        } else if (cloudData === null) {
          // No gist yet — upload current local data to create it
          const currentBooks = loadLocal() || SEED_BOOKS
          await uploadCatalogToGist(githubToken, currentBooks)
        }

        if (!cancelled) markSuccess()
      } catch (err) {
        if (cancelled) return
        console.error('Cloud sync failed:', err)
        setSyncStatus('error')
        setSyncError(err.message)
      }
    }

    syncFromCloud()
    return () => { cancelled = true }
  }, [githubToken, markSuccess])

  const syncToCloud = useCallback(async (localBooks) => {
    if (!githubToken) return
    setSyncStatus('syncing')
    try {
      const cloudData = await downloadCatalogFromGist(githubToken)
      const remoteBooks = Array.isArray(cloudData) ? cloudData : []
      const merged = mergeBooks(localBooks, remoteBooks)
      await uploadCatalogToGist(githubToken, merged)
      markSuccess()
    } catch (err) {
      console.error('Sync failed:', err)
      setSyncStatus('error')
      setSyncError(err.message)
    }
  }, [githubToken, markSuccess])

  const addBook = useCallback(async (bookData) => {
    const newBook = {
      id: uuidv4(),
      title: '',
      author: '',
      year: new Date().getFullYear(),
      legalOrder: [],
      topics: [],
      format: 'paper',
      rating: 0,
      description: '',
      tags: [],
      notes: '',
      yaPath: '',
      ...bookData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    let updated
    setBooks(prev => {
      updated = [newBook, ...prev]
      return updated
    })
    if (githubToken && updated) syncToCloud(updated)
    return newBook
  }, [githubToken, syncToCloud])

  const updateBook = useCallback(async (book) => {
    const updatedBook = { ...book, updatedAt: new Date().toISOString() }
    let newBooks
    setBooks(prev => {
      newBooks = prev.map(b => b.id === updatedBook.id ? updatedBook : b)
      return newBooks
    })
    if (githubToken && newBooks) syncToCloud(newBooks)
  }, [githubToken, syncToCloud])

  const deleteBook = useCallback(async (id) => {
    let newBooks
    setBooks(prev => {
      newBooks = prev.filter(b => b.id !== id)
      return newBooks
    })
    if (githubToken && newBooks) syncToCloud(newBooks)
  }, [githubToken, syncToCloud])

  const forceSync = useCallback(async () => {
    const current = loadLocal() || []
    syncToCloud(current)
  }, [syncToCloud])

  const importFromJSON = useCallback((jsonData) => {
    try {
      const imported = Array.isArray(jsonData) ? jsonData : JSON.parse(jsonData)
      let merged
      setBooks(prev => {
        merged = mergeBooks(imported, prev)
        return merged
      })
      if (githubToken && merged) syncToCloud(merged)
      return true
    } catch (err) {
      console.error('Import failed:', err)
      return false
    }
  }, [githubToken, syncToCloud])

  const bulkAddBooks = useCallback(async (pdfFiles) => {
    const newBooks = pdfFiles.map(file => ({
      id: uuidv4(),
      title: file.name.replace(/\.pdf$/i, ''),
      author: '',
      year: new Date().getFullYear(),
      legalOrder: [],
      topics: [],
      format: 'pdf',
      rating: 0,
      description: '',
      tags: [],
      notes: '',
      yaPath: file.path,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    let addedCount = 0
    let updated
    setBooks(prev => {
      const seenPaths  = new Set(prev.map(b => b.yaPath).filter(Boolean))
      const seenTitles = new Set(prev.map(b => b.title.trim().toLowerCase()).filter(Boolean))
      const toAdd = []
      for (const b of newBooks) {
        if (b.yaPath && seenPaths.has(b.yaPath)) continue
        const key = b.title.trim().toLowerCase()
        if (seenTitles.has(key)) continue
        if (b.yaPath) seenPaths.add(b.yaPath)
        seenTitles.add(key)   // deduplicate within the incoming batch too
        toAdd.push(b)
      }
      addedCount = toAdd.length
      updated = [...toAdd, ...prev]
      return updated
    })
    if (githubToken && updated) syncToCloud(updated)
    return addedCount
  }, [githubToken, syncToCloud])

  const importPaperBooks = useCallback((books) => {
    let addedCount = 0
    let updated
    setBooks(prev => {
      const seen = new Set(prev.map(b => b.title.trim().toLowerCase()).filter(Boolean))
      const toAdd = []
      for (const b of books) {
        if (!b.title) continue
        const key = b.title.trim().toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)   // deduplicate within the incoming batch too
        toAdd.push(b)
      }
      addedCount = toAdd.length
      updated = [...toAdd, ...prev]
      return updated
    })
    if (githubToken && updated) syncToCloud(updated)
    return addedCount
  }, [githubToken, syncToCloud])

  const bulkUpdateBooks = useCallback((updates) => {
    // updates: [{id, ...anyFields}] — patches each matched book with given fields
    const now = new Date().toISOString()
    const updateMap = new Map(updates.map(u => [u.id, u]))
    let newBooks
    setBooks(prev => {
      newBooks = prev.map(b => {
        const u = updateMap.get(b.id)
        if (!u) return b
        const { id: _id, ...fields } = u
        return { ...b, ...fields, updatedAt: now }
      })
      return newBooks
    })
    if (githubToken && newBooks) syncToCloud(newBooks)
  }, [githubToken, syncToCloud])

  const fixYearsFromRegex = useCallback(() => {
    // Extract 4-digit year (1800–last year) from title or yaPath, update books with default year
    const currentYear = new Date().getFullYear()
    const yearRe = /\b(1[89]\d{2}|20[012]\d)\b/g
    const now = new Date().toISOString()
    let fixed = 0
    let newBooks
    setBooks(prev => {
      newBooks = prev.map(b => {
        if (b.year && b.year < currentYear) return b // already has a real year
        const hay = (b.title || '') + ' ' + (b.yaPath || '')
        const matches = [...hay.matchAll(yearRe)].map(m => parseInt(m[1], 10))
        if (!matches.length) return b
        // prefer the last match (publication year usually trails edition/volume info)
        const year = matches[matches.length - 1]
        fixed++
        return { ...b, year, updatedAt: now }
      })
      return newBooks
    })
    if (githubToken && newBooks) syncToCloud(newBooks)
    return fixed
  }, [githubToken, syncToCloud])

  const fixCorruptedTitles = useCallback(() => {
    // Remove leading '|' characters from titles corrupted by a previous parsing bug
    const now = new Date().toISOString()
    let fixed = 0
    let newBooks
    setBooks(prev => {
      newBooks = prev.map(b => {
        if (!b.title || !b.title.startsWith('|')) return b
        fixed++
        return { ...b, title: b.title.replace(/^\|+/, '').trim(), updatedAt: now }
      })
      return newBooks
    })
    if (githubToken && newBooks) syncToCloud(newBooks)
    return fixed
  }, [githubToken, syncToCloud])

  const clearAllBooks = useCallback(() => {
    setBooks([])
    localStorage.removeItem(LOCAL_KEY)
    if (githubToken) syncToCloud([])
  }, [githubToken, syncToCloud])

  const exportToJSON = useCallback(() => {
    return JSON.stringify(books, null, 2)
  }, [books])

  const exportToCSV = useCallback(() => {
    const headers = ['title', 'author', 'year', 'legalOrder', 'topics', 'format', 'rating', 'description', 'tags', 'notes', 'yaPath', 'createdAt']
    const rows = books.map(b =>
      headers.map(h => {
        const v = b[h]
        if (Array.isArray(v)) return `"${v.join('; ')}"`
        return `"${String(v || '').replace(/"/g, '""')}"`
      }).join(',')
    )
    return [headers.join(','), ...rows].join('\n')
  }, [books])

  return {
    books,
    syncStatus,
    syncError,
    lastSyncedAt,
    initialized,
    addBook,
    updateBook,
    deleteBook,
    forceSync,
    bulkAddBooks,
    importPaperBooks,
    bulkUpdateBooks,
    fixYearsFromRegex,
    fixCorruptedTitles,
    clearAllBooks,
    importFromJSON,
    exportToJSON,
    exportToCSV,
  }
}
