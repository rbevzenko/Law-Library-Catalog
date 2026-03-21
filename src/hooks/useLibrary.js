import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { checkFileExists, downloadCatalog, uploadCatalog, createFolder } from '../api/yandex'
import { SEED_BOOKS } from '../constants'

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

// Merge helper: last-write-wins by updatedAt
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

export function useLibrary(token) {
  // Primary store: localStorage. Always start with real data immediately.
  const [books, setBooks] = useState(() => loadLocal() || SEED_BOOKS)
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
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSyncStatus('idle'), 2000)
  }, [])

  // Background sync with Yandex.Disk on load
  useEffect(() => {
    setInitialized(true) // local data already loaded, app is usable immediately
    if (!token) return

    let cancelled = false

    async function syncFromCloud() {
      setSyncStatus('syncing')
      try {
        const catalogPath = '/Lex Bibliotheca/catalog.json'
        const exists = await checkFileExists(token, catalogPath)
        if (cancelled) return

        if (exists) {
          const cloudData = await downloadCatalog(token)
          if (cancelled) return
          if (Array.isArray(cloudData) && cloudData.length > 0) {
            // Merge cloud with local (local wins on conflicts by updatedAt)
            setBooks(prev => {
              const merged = mergeBooks(prev, cloudData)
              return merged
            })
          }
          markSuccess()
        } else {
          // No cloud catalog yet — upload current local data
          const currentBooks = loadLocal() || SEED_BOOKS
          try {
            await createFolder(token, '/Lex Bibliotheca')
          } catch (e) {
            // Folder may already exist (409) — continue
            if (!e.message.includes('409')) throw e
          }
          await uploadCatalog(token, currentBooks)
          if (!cancelled) markSuccess()
        }
      } catch (err) {
        if (cancelled) return
        console.error('Cloud sync failed:', err)
        setSyncStatus('error')
        setSyncError('Нет соединения с Яндекс.Диском — изменения не сохранены: ' + err.message)
      }
    }

    syncFromCloud()
    return () => { cancelled = true }
  }, [token, markSuccess])

  const syncToCloud = useCallback(async (localBooks) => {
    if (!token) return
    setSyncStatus('syncing')
    try {
      const catalogPath = '/Lex Bibliotheca/catalog.json'
      let remoteBooks = []
      const exists = await checkFileExists(token, catalogPath)
      if (exists) {
        const data = await downloadCatalog(token)
        if (Array.isArray(data)) remoteBooks = data
      } else {
        try {
          await createFolder(token, '/Lex Bibliotheca')
        } catch (e) {
          if (!e.message.includes('409')) throw e
        }
      }
      const merged = mergeBooks(localBooks, remoteBooks)
      await uploadCatalog(token, merged)
      markSuccess()
    } catch (err) {
      console.error('Sync failed:', err)
      setSyncStatus('error')
      setSyncError('Нет соединения с Яндекс.Диском — изменения не сохранены: ' + err.message)
    }
  }, [token, markSuccess])

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
    setBooks(prev => {
      const updated = [newBook, ...prev]
      if (token) syncToCloud(updated)
      return updated
    })
    return newBook
  }, [token, syncToCloud])

  const updateBook = useCallback(async (book) => {
    const updated = { ...book, updatedAt: new Date().toISOString() }
    setBooks(prev => {
      const newBooks = prev.map(b => b.id === updated.id ? updated : b)
      if (token) syncToCloud(newBooks)
      return newBooks
    })
  }, [token, syncToCloud])

  const deleteBook = useCallback(async (id) => {
    setBooks(prev => {
      const newBooks = prev.filter(b => b.id !== id)
      if (token) syncToCloud(newBooks)
      return newBooks
    })
  }, [token, syncToCloud])

  const forceSync = useCallback(async () => {
    setBooks(prev => {
      syncToCloud(prev)
      return prev
    })
  }, [syncToCloud])

  const importFromJSON = useCallback((jsonData) => {
    try {
      const imported = Array.isArray(jsonData) ? jsonData : JSON.parse(jsonData)
      setBooks(prev => {
        const merged = mergeBooks(imported, prev)
        if (token) syncToCloud(merged)
        return merged
      })
      return true
    } catch (err) {
      console.error('Import failed:', err)
      return false
    }
  }, [token, syncToCloud])

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
    setBooks(prev => {
      const existingPaths = new Set(prev.map(b => b.yaPath).filter(Boolean))
      const toAdd = newBooks.filter(b => !existingPaths.has(b.yaPath))
      addedCount = toAdd.length
      const updated = [...toAdd, ...prev]
      if (token) syncToCloud(updated)
      return updated
    })
    return addedCount
  }, [token, syncToCloud])

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
    importFromJSON,
    exportToJSON,
    exportToCSV,
  }
}
