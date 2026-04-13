import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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

// Merge: last-write-wins by updatedAt.
// Tombstones (deletedAt set) participate in the merge just like live books —
// a tombstone with a newer updatedAt beats a remote live copy, so deletes propagate.
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
  // rawBooks includes tombstones (deletedAt set); persisted to localStorage and cloud
  const [rawBooks, setBooks] = useState(() => loadLocal() || [])
  const [syncStatus, setSyncStatus] = useState('idle')
  const [syncError, setSyncError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const successTimerRef = useRef(null)

  // Visible books: tombstones are excluded from the UI
  const books = useMemo(() => rawBooks.filter(b => !b.deletedAt), [rawBooks])

  // Persist rawBooks (with tombstones) so deletes survive across sessions and sync correctly
  useEffect(() => {
    saveLocal(rawBooks)
  }, [rawBooks])

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
          const currentBooks = loadLocal() || []
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

  // Soft delete: mark with deletedAt so the tombstone beats the cloud copy in mergeBooks.
  // Hard removal would make mergeBooks treat the remote copy as "new" and resurrect the book.
  const deleteBook = useCallback(async (id) => {
    const now = new Date().toISOString()
    let newBooks
    setBooks(prev => {
      newBooks = prev.map(b => b.id === id ? { ...b, deletedAt: now, updatedAt: now } : b)
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
      // Deduplicate against live books only (not tombstones)
      const live = prev.filter(b => !b.deletedAt)
      const seenPaths  = new Set(live.map(b => b.yaPath).filter(Boolean))
      const seenTitles = new Set(live.map(b => b.title.trim().toLowerCase()).filter(Boolean))
      const toAdd = []
      for (const b of newBooks) {
        if (b.yaPath && seenPaths.has(b.yaPath)) continue
        const key = b.title.trim().toLowerCase()
        if (seenTitles.has(key)) continue
        if (b.yaPath) seenPaths.add(b.yaPath)
        seenTitles.add(key)
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
      // Deduplicate against live paper books only (not tombstones)
      const seen = new Set(
        prev.filter(b => b.format === 'paper' && !b.deletedAt)
          .map(b => b.title.trim().toLowerCase()).filter(Boolean)
      )
      const toAdd = []
      for (const b of books) {
        if (!b.title) continue
        const key = b.title.trim().toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
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
    const now = new Date().toISOString()
    const updateMap = new Map(updates.map(u => [u.id, u]))
    let newBooks
    setBooks(prev => {
      newBooks = prev.map(b => {
        if (b.deletedAt) return b // skip tombstones
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
    const currentYear = new Date().getFullYear()
    const yearRe = /\b(1[89]\d{2}|20[012]\d)\b/g
    const now = new Date().toISOString()
    let fixed = 0
    let newBooks
    setBooks(prev => {
      newBooks = prev.map(b => {
        if (b.deletedAt) return b // skip tombstones
        if (b.year && b.year < currentYear) return b
        const hay = (b.title || '') + ' ' + (b.yaPath || '')
        const matches = [...hay.matchAll(yearRe)].map(m => parseInt(m[1], 10))
        if (!matches.length) return b
        const year = matches[matches.length - 1]
        fixed++
        return { ...b, year, updatedAt: now }
      })
      return newBooks
    })
    if (githubToken && newBooks) syncToCloud(newBooks)
    return fixed
  }, [githubToken, syncToCloud])

  const fixExcelImport = useCallback(() => {
    // Pattern from Excel CSV export: "Инициалы;Название книги;Город издания"
    // Structure: parts[0] = initials (Г.Ф.), parts[1..n-1] = title, parts[last] = city
    // When initials detected and 3+ parts → last part is ALWAYS city, remove unconditionally.
    //
    // Initials: strictly one or more groups of "Capital letter + dot", e.g. Г., Г.Ф., В.И.А.
    const INITIALS_RE = /^([А-ЯЁA-Z]\.){1,4}$/
    const isInitials = s => INITIALS_RE.test(s.trim())

    const now = new Date().toISOString()
    let stats = { fixed: 0, initialsAdded: 0, citiesRemoved: 0 }
    let newBooks
    setBooks(prev => {
      stats = { fixed: 0, initialsAdded: 0, citiesRemoved: 0 }
      newBooks = prev.map(b => {
        if (b.deletedAt) return b // skip tombstones
        if (!b.title || !b.title.includes(';')) return b
        const parts = b.title.split(';').map(p => p.trim()).filter(Boolean)
        if (parts.length < 2) return b

        if (!isInitials(parts[0])) return b

        const initials = parts[0]
        let titleParts = parts.slice(1)

        if (titleParts.length >= 2) {
          titleParts = titleParts.slice(0, -1)
          stats.citiesRemoved++
        }

        let newAuthor = b.author || ''
        if (!newAuthor.includes(initials)) {
          newAuthor = newAuthor ? `${newAuthor} ${initials}` : initials
          stats.initialsAdded++
        }

        stats.fixed++
        return { ...b, title: titleParts.join('; '), author: newAuthor, updatedAt: now }
      })
      return newBooks
    })
    if (githubToken && newBooks) syncToCloud(newBooks)
    return stats
  }, [githubToken, syncToCloud])

  const removeDuplicates = useCallback(() => {
    let removed = 0
    let newBooks
    setBooks(prev => {
      // Keep tombstones as-is; dedup only live books
      const tombstones = prev.filter(b => b.deletedAt)
      const alive = prev.filter(b => !b.deletedAt)
      const groups = new Map()
      for (const b of alive) {
        const key = (b.title || '').trim().toLowerCase()
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(b)
      }
      const score = b => [
        b.author, b.description, b.notes, b.yaPath,
        ...(b.legalOrder || []), ...(b.topics || []), ...(b.tags || []),
      ].filter(Boolean).length + (b.rating ? 1 : 0) + (b.year && b.year < new Date().getFullYear() ? 1 : 0)
      const deduped = []
      for (const group of groups.values()) {
        const best = group.reduce((a, b) => score(b) > score(a) ? b : a)
        deduped.push(best)
        removed += group.length - 1
      }
      newBooks = [...tombstones, ...deduped]
      return newBooks
    })
    if (githubToken && newBooks) syncToCloud(newBooks)
    return removed
  }, [githubToken, syncToCloud])

  const fixCorruptedTitles = useCallback(() => {
    const now = new Date().toISOString()
    let fixed = 0
    let newBooks
    setBooks(prev => {
      newBooks = prev.map(b => {
        if (b.deletedAt) return b // skip tombstones
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

  // Export only visible (non-deleted) books
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
    fixExcelImport,
    fixCorruptedTitles,
    removeDuplicates,
    clearAllBooks,
    importFromJSON,
    exportToJSON,
    exportToCSV,
  }
}
