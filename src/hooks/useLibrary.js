import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { checkFileExists, downloadCatalog, uploadCatalog, createFolder } from '../api/yandex'
import { SEED_BOOKS } from '../constants'

export function useLibrary(token) {
  const [books, setBooks] = useState([])
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle' | 'syncing' | 'success' | 'error'
  const [syncError, setSyncError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const successTimerRef = useRef(null)

  const markSuccess = useCallback(() => {
    setSyncStatus('success')
    setLastSyncedAt(new Date())
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSyncStatus('idle'), 2000)
  }, [])

  // Initial load from Yandex.Disk
  useEffect(() => {
    if (!token) {
      setBooks(SEED_BOOKS)
      setInitialized(true)
      return
    }

    let cancelled = false

    async function initLoad() {
      setSyncStatus('syncing')
      try {
        const catalogPath = '/Lex Bibliotheca/catalog.json'
        const exists = await checkFileExists(token, catalogPath)
        if (cancelled) return

        if (exists) {
          const data = await downloadCatalog(token)
          if (!cancelled) {
            setBooks(Array.isArray(data) ? data : SEED_BOOKS)
            markSuccess()
          }
        } else {
          // Create folder and upload seed books
          await createFolder(token, '/Lex Bibliotheca')
          await uploadCatalog(token, SEED_BOOKS)
          if (!cancelled) {
            setBooks(SEED_BOOKS)
            markSuccess()
          }
        }
      } catch (err) {
        console.error('Init load failed:', err)
        if (!cancelled) {
          setSyncStatus('error')
          setSyncError(err.message || 'Неизвестная ошибка')
          setBooks(SEED_BOOKS)
        }
      } finally {
        if (!cancelled) setInitialized(true)
      }
    }

    initLoad()
    return () => { cancelled = true }
  }, [token, markSuccess])

  // Merge helper: last-write-wins by updatedAt, no deletion overwriting additions
  function mergeBooks(localBooks, remoteBooks) {
    const map = new Map()
    for (const b of remoteBooks) map.set(b.id, b)
    for (const b of localBooks) {
      const remote = map.get(b.id)
      if (!remote) {
        map.set(b.id, b)
      } else {
        const localTime = new Date(b.updatedAt || 0).getTime()
        const remoteTime = new Date(remote.updatedAt || 0).getTime()
        if (localTime >= remoteTime) map.set(b.id, b)
      }
    }
    return Array.from(map.values())
  }

  const syncToCloud = useCallback(async (localBooks) => {
    if (!token) return localBooks
    setSyncStatus('syncing')
    try {
      // Re-fetch current remote state
      const catalogPath = '/Lex Bibliotheca/catalog.json'
      let remoteBooks = []
      const exists = await checkFileExists(token, catalogPath)
      if (exists) {
        remoteBooks = await downloadCatalog(token)
        if (!Array.isArray(remoteBooks)) remoteBooks = []
      } else {
        await createFolder(token, '/Lex Bibliotheca')
      }
      const merged = mergeBooks(localBooks, remoteBooks)
      await uploadCatalog(token, merged)
      setBooks(merged)
      markSuccess()
      return merged
    } catch (err) {
      console.error('Sync failed:', err)
      setSyncStatus('error')
      setSyncError(err.message || 'Неизвестная ошибка')
      return localBooks
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
