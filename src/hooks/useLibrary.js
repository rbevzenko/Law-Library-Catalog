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
    return Array.isArray(data) ? data : null
  } catch (e) {
    return null
  }
}

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

  // Initial load: Yandex → localStorage → SEED_BOOKS
  useEffect(() => {
    if (!token) {
      const local = loadLocal()
      setBooks(local || SEED_BOOKS)
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
            const cloudBooks = Array.isArray(data) ? data : null
            if (cloudBooks) {
              // Merge cloud with any local changes that happened while offline
              const local = loadLocal()
              const merged = local ? mergeBooks(local, cloudBooks) : cloudBooks
              setBooks(merged)
              saveLocal(merged)
            } else {
              const local = loadLocal()
              setBooks(local || SEED_BOOKS)
            }
            markSuccess()
          }
        } else {
          // No cloud catalog yet — use local or seed, then try to upload
          const local = loadLocal()
          const initial = local || SEED_BOOKS
          await createFolder(token, '/Lex Bibliotheca')
          await uploadCatalog(token, initial)
          if (!cancelled) {
            setBooks(initial)
            saveLocal(initial)
            markSuccess()
          }
        }
      } catch (err) {
        console.error('Init load failed:', err)
        if (!cancelled) {
          setSyncStatus('error')
          setSyncError('Нет соединения с Яндекс.Диском — работаем офлайн: ' + err.message)
          // Fall back to localStorage
          const local = loadLocal()
          setBooks(local || SEED_BOOKS)
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
      saveLocal(merged)
      markSuccess()
      return merged
    } catch (err) {
      console.error('Sync failed:', err)
      setSyncStatus('error')
      setSyncError('Нет соединения с Яндекс.Диском — изменения не сохранены: ' + err.message)
      return localBooks
    }
  }, [token, markSuccess])

  // Save to localStorage on every books change (immediate local persistence)
  const setAndSave = useCallback((updater) => {
    setBooks(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveLocal(next)
      return next
    })
  }, [])

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
    setAndSave(prev => {
      updated = [newBook, ...prev]
      return updated
    })
    if (token) syncToCloud(updated || [newBook])
    return newBook
  }, [token, syncToCloud, setAndSave])

  const updateBook = useCallback(async (book) => {
    const updated = { ...book, updatedAt: new Date().toISOString() }
    let newBooks
    setAndSave(prev => {
      newBooks = prev.map(b => b.id === updated.id ? updated : b)
      return newBooks
    })
    if (token) syncToCloud(newBooks || [])
  }, [token, syncToCloud, setAndSave])

  const deleteBook = useCallback(async (id) => {
    let newBooks
    setAndSave(prev => {
      newBooks = prev.filter(b => b.id !== id)
      return newBooks
    })
    if (token) syncToCloud(newBooks || [])
  }, [token, syncToCloud, setAndSave])

  const forceSync = useCallback(async () => {
    setBooks(prev => {
      syncToCloud(prev)
      return prev
    })
  }, [syncToCloud])

  const importFromJSON = useCallback((jsonData) => {
    try {
      const imported = Array.isArray(jsonData) ? jsonData : JSON.parse(jsonData)
      let merged
      setAndSave(prev => {
        merged = mergeBooks(imported, prev)
        return merged
      })
      if (token) syncToCloud(merged || imported)
      return true
    } catch (err) {
      console.error('Import failed:', err)
      return false
    }
  }, [token, syncToCloud, setAndSave])

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
    setAndSave(prev => {
      const existingPaths = new Set(prev.map(b => b.yaPath).filter(Boolean))
      const toAdd = newBooks.filter(b => !existingPaths.has(b.yaPath))
      addedCount = toAdd.length
      updated = [...toAdd, ...prev]
      return updated
    })
    if (token) syncToCloud(updated || newBooks)
    return addedCount
  }, [token, syncToCloud, setAndSave])

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
