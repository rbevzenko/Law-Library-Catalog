import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { TopBar } from './components/layout/TopBar'
import { SettingsPanel } from './components/layout/SettingsPanel'
import { BookCard } from './components/books/BookCard'
import { BookForm } from './components/books/BookForm'
import { BookTable } from './components/books/BookTable'
import { PDFViewer } from './components/books/PDFViewer'
import { FilterPanel } from './components/filters/FilterPanel'
import { StatsView } from './components/stats/StatsView'
import { useSettings } from './hooks/useSettings'
import { useLibrary } from './hooks/useLibrary'
import { useAuth } from './hooks/useAuth'
import { LockScreen } from './components/auth/LockScreen'

const DEFAULT_FILTERS = {
  format: 'all',
  legalOrder: [],
  topics: [],
  minRating: 0,
  sortBy: 'title',
}

function SkeletonCard() {
  return (
    <div style={{ background: '#151825', border: '1px solid #2a3050', borderRadius: '12px', overflow: 'hidden' }}>
      <div className="skeleton" style={{ height: '3px' }} />
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="skeleton" style={{ height: '20px', width: '70%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '14px', width: '50%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '14px', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '14px', width: '80%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '14px', width: '60%', borderRadius: '4px' }} />
      </div>
    </div>
  )
}

function EmptyState({ hasFilters, onReset, onAdd }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '80px 40px',
      color: '#4a5a70',
    }}>
      <div style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.5 }}>⚖</div>
      {hasFilters ? (
        <>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', color: '#8899bb', marginBottom: '8px' }}>
            Книги не найдены
          </h3>
          <p style={{ fontSize: '14px', marginBottom: '20px' }}>Нет книг, соответствующих выбранным фильтрам</p>
          <button
            onClick={onReset}
            style={{
              background: 'none', border: '1px solid #2a3050', borderRadius: '8px',
              color: '#c8a850', cursor: 'pointer', padding: '8px 20px', fontSize: '14px',
              transition: 'all 0.15s',
            }}
          >
            Сбросить фильтры
          </button>
        </>
      ) : (
        <>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', color: '#8899bb', marginBottom: '8px' }}>
            Каталог пуст
          </h3>
          <p style={{ fontSize: '14px', marginBottom: '20px' }}>Добавьте первую книгу в вашу правовую библиотеку</p>
          <button
            onClick={onAdd}
            style={{
              background: 'linear-gradient(135deg, #c8a850, #e0c870)', border: 'none',
              borderRadius: '8px', color: '#0f1220', cursor: 'pointer',
              padding: '10px 24px', fontSize: '14px', fontWeight: 600,
              transition: 'filter 0.15s',
            }}
          >
            + Добавить книгу
          </button>
        </>
      )}
    </div>
  )
}

const PAGE_SIZE = 24

function SortButton({ label, sortKey, current, onSort }) {
  const isAsc  = current === sortKey
  const isDesc = current === sortKey + '_desc'
  const active = isAsc || isDesc
  return (
    <button
      onClick={() => onSort(sortKey)}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '5px 12px',
        background: active ? 'rgba(200,168,80,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(200,168,80,0.4)' : '#2a3050'}`,
        borderRadius: '6px',
        color: active ? '#c8a850' : '#6a7a90',
        fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {label}
      <span style={{ fontSize: '11px', opacity: active ? 1 : 0.4 }}>
        {isDesc ? ' ↓' : ' ↑'}
      </span>
    </button>
  )
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  const pages = []
  // Always show first, last, and neighbours of current
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      pages.push(i)
    }
  }
  // Deduplicate and add ellipsis markers
  const withGaps = []
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) withGaps.push('…')
    withGaps.push(pages[i])
  }
  const btnStyle = (active, disabled) => ({
    minWidth: '34px', height: '34px',
    padding: '0 8px',
    background: active ? '#c8a850' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? '#c8a850' : '#2a3050'}`,
    borderRadius: '6px',
    color: active ? '#0f1220' : disabled ? '#3a4a60' : '#8899bb',
    fontSize: '13px', fontWeight: active ? 700 : 400,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'all 0.15s', fontFamily: 'inherit',
  })
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '28px' }}>
      <button style={btnStyle(false, page === 1)} disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>
      {withGaps.map((p, i) =>
        p === '…'
          ? <span key={'gap' + i} style={{ color: '#3a4a60', fontSize: '13px', padding: '0 2px' }}>…</span>
          : <button key={p} style={btnStyle(p === page, false)} onClick={() => onChange(p)}>{p}</button>
      )}
      <button style={btnStyle(false, page === totalPages)} disabled={page === totalPages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  )
}

// Sort tier: 0 = special/digits, 1 = Latin, 2 = Cyrillic
function charTier(str) {
  const ch = (str || '').trimStart()[0] || ''
  if (/[a-zA-Z]/.test(ch)) return 1
  if (/[а-яёА-ЯЁ]/.test(ch)) return 2
  return 0
}
function tieredCompare(a, b) {
  const ta = charTier(a), tb = charTier(b)
  if (ta !== tb) return ta - tb
  return a.localeCompare(b, 'ru')
}

function applyFiltersAndSort(books, searchQuery, filters) {
  let result = [...books]

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    result = result.filter(b =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.description || '').toLowerCase().includes(q) ||
      (b.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (b.notes || '').toLowerCase().includes(q)
    )
  }

  // Format
  if (filters.format && filters.format !== 'all') {
    result = result.filter(b => b.format === filters.format)
  }

  // Legal orders
  if (filters.legalOrder && filters.legalOrder.length > 0) {
    result = result.filter(b =>
      filters.legalOrder.some(lo => (b.legalOrder || []).includes(lo))
    )
  }

  // Topics
  if (filters.topics && filters.topics.length > 0) {
    result = result.filter(b =>
      filters.topics.some(t => (b.topics || []).includes(t))
    )
  }

  // Rating
  if (filters.minRating && filters.minRating > 0) {
    result = result.filter(b => (b.rating || 0) >= filters.minRating)
  }

  // Sort
  const sortKey = filters.sortBy || 'title'
  result.sort((a, b) => {
    if (sortKey === 'title')       return tieredCompare(a.title || '', b.title || '')
    if (sortKey === 'title_desc')  return tieredCompare(b.title || '', a.title || '')
    if (sortKey === 'author')      return tieredCompare(a.author || '', b.author || '')
    if (sortKey === 'author_desc') return tieredCompare(b.author || '', a.author || '')
    if (sortKey === 'year_asc')    return (Number(a.year) || 0) - (Number(b.year) || 0)
    if (sortKey === 'year_desc')   return (Number(b.year) || 0) - (Number(a.year) || 0)
    if (sortKey === 'rating')      return (b.rating || 0) - (a.rating || 0)
    if (sortKey === 'createdAt')   return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    return 0
  })

  return result
}

export default function App() {
  const { pinSet, unlocked, unlock, setPin, changePin, removePin, lock } = useAuth()
  const { yadiskToken, setYadiskToken, githubToken, setGithubToken, anthropicKey, setAnthropicKey, booksFolder, setBooksFolder } = useSettings()

  // Read OAuth token from URL hash after Yandex redirect
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.slice(1))
      const token = params.get('access_token')
      if (token) {
        setYadiskToken(token)
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const {
    books, syncStatus, syncError, lastSyncedAt, initialized,
    addBook, updateBook, deleteBook, forceSync,
    bulkAddBooks, importPaperBooks, bulkUpdateBooks, fixYearsFromRegex, fixCorruptedTitles, removeDuplicates, clearAllBooks, exportToJSON, exportToCSV, importFromJSON,
  } = useLibrary(githubToken)

  const [view, setView] = useState('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(!yadiskToken)
  const [formOpen, setFormOpen] = useState(false)
  const [editingBook, setEditingBook] = useState(null)
  const [pdfBook, setPdfBook] = useState(null)
  const [offlineBanner, setOfflineBanner] = useState(false)

  // Show offline banner on sync error
  useEffect(() => {
    if (syncStatus === 'error') setOfflineBanner(true)
    if (syncStatus === 'success') setOfflineBanner(false)
  }, [syncStatus])

  const filteredBooks = useMemo(
    () => applyFiltersAndSort(books, searchQuery, filters),
    [books, searchQuery, filters]
  )

  const allTags = useMemo(() => {
    const set = new Set()
    books.forEach(b => (b.tags || []).forEach(t => t && set.add(t)))
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [books])

  const allAuthors = useMemo(() => {
    const set = new Set()
    books.forEach(b => b.author && set.add(b.author.trim()))
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [books])

  // Reset page when search/filters change
  useEffect(() => { setPage(1) }, [searchQuery, filters])

  const totalPages = Math.ceil(filteredBooks.length / PAGE_SIZE)
  const pagedBooks = useMemo(
    () => filteredBooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredBooks, page]
  )

  const handleSort = useCallback((key) => {
    setFilters(f => ({
      ...f,
      sortBy: f.sortBy === key ? key + '_desc' : key,
    }))
  }, [])

  function handleAddBook() {
    setEditingBook(null)
    setFormOpen(true)
  }

  function handleEditBook(book) {
    setEditingBook(book)
    setFormOpen(true)
  }

  async function handleDeleteBook(id) {
    if (!window.confirm('Удалить книгу?')) return
    await deleteBook(id)
  }

  async function handleSaveBook(formData) {
    if (editingBook) {
      await updateBook({ ...editingBook, ...formData })
    } else {
      await addBook(formData)
    }
  }

  function handleOpenPDF(book) {
    setPdfBook(book)
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS)
    setSearchQuery('')
  }

  function handleExportJSON() {
    const json = exportToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lex-bibliotheca-catalog.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    (filters.legalOrder || []).length > 0 ||
    (filters.topics || []).length > 0 ||
    (filters.format && filters.format !== 'all') ||
    (filters.minRating && filters.minRating > 0)

  if (!unlocked) return <LockScreen onUnlock={unlock} />

  return (
    <div style={{ minHeight: '100vh', background: '#0f1220' }}>
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddBook={handleAddBook}
        view={view}
        onViewChange={setView}
      />

      {/* Offline banner */}
      {offlineBanner && (
        <div style={{
          background: 'rgba(200,50,50,0.12)',
          borderBottom: '1px solid rgba(200,50,50,0.3)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: '#e05050',
        }}>
          <span>❌ Ошибка синхронизации{syncError ? `: ${syncError}` : ''}</span>
          <button
            onClick={() => setOfflineBanner(false)}
            style={{ background: 'none', border: 'none', color: '#e05050', cursor: 'pointer', fontSize: '16px' }}
          >
            ×
          </button>
        </div>
      )}

      <main style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
        {view === 'stats' ? (
          <StatsView books={books} />
        ) : (
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Sidebar filters */}
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onReset={handleResetFilters}
              totalCount={books.length}
              filteredCount={filteredBooks.length}
            />

            {/* Main content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Sort toolbar */}
              {initialized && filteredBooks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '4px' }}>
                    Сортировка:
                  </span>
                  <SortButton label="По названию" sortKey="title"  current={filters.sortBy} onSort={handleSort} />
                  <SortButton label="По автору"   sortKey="author" current={filters.sortBy} onSort={handleSort} />
                  <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#4a5a70' }}>
                    {filteredBooks.length} книг · стр. {page} / {totalPages}
                  </span>
                </div>
              )}

              {!initialized ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                </div>
              ) : filteredBooks.length === 0 ? (
                <EmptyState
                  hasFilters={hasActiveFilters}
                  onReset={handleResetFilters}
                  onAdd={handleAddBook}
                />
              ) : view === 'table' ? (
                <>
                  <div style={{ background: '#151825', border: '1px solid #2a3050', borderRadius: '12px', overflow: 'hidden' }}>
                    <BookTable
                      books={pagedBooks}
                      onEdit={handleEditBook}
                      onDelete={handleDeleteBook}
                      onOpenPDF={handleOpenPDF}
                    />
                  </div>
                  <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); window.scrollTo(0, 0) }} />
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {pagedBooks.map(book => (
                      <BookCard
                        key={book.id}
                        book={book}
                        onEdit={handleEditBook}
                        onDelete={handleDeleteBook}
                        onOpenPDF={handleOpenPDF}
                      />
                    ))}
                  </div>
                  <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); window.scrollTo(0, 0) }} />
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Settings panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        yadiskToken={yadiskToken}
        setYadiskToken={setYadiskToken}
        githubToken={githubToken}
        setGithubToken={setGithubToken}
        anthropicKey={anthropicKey}
        setAnthropicKey={setAnthropicKey}
        booksFolder={booksFolder}
        setBooksFolder={setBooksFolder}
        books={books}
        bulkAddBooks={bulkAddBooks}
        importPaperBooks={importPaperBooks}
        bulkUpdateBooks={bulkUpdateBooks}
        fixYearsFromRegex={fixYearsFromRegex}
        fixCorruptedTitles={fixCorruptedTitles}
        removeDuplicates={removeDuplicates}
        clearAllBooks={clearAllBooks}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        forceSync={forceSync}
        exportToJSON={handleExportJSON}
        exportToCSV={exportToCSV}
        importFromJSON={importFromJSON}
        pinSet={pinSet}
        onSetPin={setPin}
        onChangePin={changePin}
        onRemovePin={removePin}
        onLock={lock}
      />

      {/* Book form modal */}
      <BookForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        book={editingBook}
        onSave={handleSaveBook}
        token={yadiskToken}
        anthropicKey={anthropicKey}
        booksFolder={booksFolder}
        allTags={allTags}
        allAuthors={allAuthors}
      />

      {/* PDF viewer */}
      <PDFViewer
        isOpen={!!pdfBook}
        onClose={() => setPdfBook(null)}
        yaPath={pdfBook?.yaPath}
        token={yadiskToken}
      />
    </div>
  )
}
