import React, { useState, useMemo, useEffect } from 'react'
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
    if (sortKey === 'title') return (a.title || '').localeCompare(b.title || '', 'ru')
    if (sortKey === 'author') return (a.author || '').localeCompare(b.author || '', 'ru')
    if (sortKey === 'year_asc') return (Number(a.year) || 0) - (Number(b.year) || 0)
    if (sortKey === 'year_desc') return (Number(b.year) || 0) - (Number(a.year) || 0)
    if (sortKey === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (sortKey === 'createdAt') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    return 0
  })

  return result
}

export default function App() {
  const { yadiskToken, setYadiskToken, anthropicKey, setAnthropicKey, booksFolder, setBooksFolder } = useSettings()
  const {
    books, syncStatus, lastSyncedAt, initialized,
    addBook, updateBook, deleteBook, forceSync,
    bulkAddBooks, exportToJSON, exportToCSV, importFromJSON,
  } = useLibrary(yadiskToken)

  const [view, setView] = useState('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
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
          <span>❌ Нет соединения с Яндекс.Диском — изменения не сохранены</span>
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
                <div style={{ background: '#151825', border: '1px solid #2a3050', borderRadius: '12px', overflow: 'hidden' }}>
                  <BookTable
                    books={filteredBooks}
                    onEdit={handleEditBook}
                    onDelete={handleDeleteBook}
                    onOpenPDF={handleOpenPDF}
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {filteredBooks.map(book => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onEdit={handleEditBook}
                      onDelete={handleDeleteBook}
                      onOpenPDF={handleOpenPDF}
                    />
                  ))}
                </div>
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
        anthropicKey={anthropicKey}
        setAnthropicKey={setAnthropicKey}
        booksFolder={booksFolder}
        setBooksFolder={setBooksFolder}
        bulkAddBooks={bulkAddBooks}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        forceSync={forceSync}
        exportToJSON={handleExportJSON}
        exportToCSV={exportToCSV}
        importFromJSON={importFromJSON}
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
