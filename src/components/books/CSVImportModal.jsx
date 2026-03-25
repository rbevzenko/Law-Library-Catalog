import React, { useState, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import initSqlJs from 'sql.js'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const firstLine = src.split('\n')[0] || ''
  const delim = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ','
  const rows = []
  let cur = '', inQuotes = false, fields = []
  for (let i = 0; i <= src.length; i++) {
    const ch = src[i]
    if (ch === '"') {
      if (inQuotes && src[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (!inQuotes && ch === delim) {
      fields.push(cur); cur = ''
    } else if (!inQuotes && (ch === '\n' || ch === undefined)) {
      fields.push(cur); cur = ''
      if (fields.some(f => f.trim())) rows.push(fields)
      fields = []
    } else {
      cur += (ch || '')
    }
  }
  return rows
}

// ── SQLite loader ─────────────────────────────────────────────────────────────

async function loadSQLite(arrayBuffer) {
  const SQL = await initSqlJs({
    locateFile: () => '/Law-Library-Catalog/sql-wasm.wasm',
  })
  const db = new SQL.Database(new Uint8Array(arrayBuffer))
  const tablesRes = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  )
  const tableNames = tablesRes[0]?.values.map(r => r[0]) || []
  const tables = {}
  for (const name of tableNames) {
    try {
      const res = db.exec(`SELECT * FROM "${name}"`)
      if (res.length > 0) tables[name] = { columns: res[0].columns, rows: res[0].values }
    } catch { /* skip unreadable tables */ }
  }
  db.close()
  return tables
}

// ── Column auto-mapping ───────────────────────────────────────────────────────

const FIELD_ALIASES = {
  title:       ['title', 'название', 'наименование', 'книга', 'заголовок', 'name', 'book', 'book_title'],
  author:      ['author', 'авторы', 'автор', 'authors', 'writer'],
  year:        ['year', 'год', 'год издания', 'year published', 'дата', 'date', 'published'],
  description: ['description', 'описание', 'аннотация', 'annotation', 'abstract', 'summary', 'note', 'notes', 'заметки', 'примечания', 'комментарий'],
  rating:      ['rating', 'рейтинг', 'оценка', 'stars', 'score'],
  topics:      ['topics', 'темы', 'тема', 'subject', 'subjects', 'category'],
  legalOrder:  ['legalorder', 'legal order', 'правовая система', 'правовые системы', 'jurisdiction', 'collection', 'collections'],
  tags:        ['tags', 'теги', 'метки', 'keywords', 'ключевые слова'],
}

const FIELD_LABELS = {
  title:       'Название *',
  author:      'Автор',
  year:        'Год',
  description: 'Описание / заметки',
  rating:      'Рейтинг (0–5)',
  topics:      'Темы',
  legalOrder:  'Правовые системы',
  tags:        'Теги',
}

function autoDetect(headers) {
  const lc = headers.map(h => h.trim().toLowerCase())
  const mapping = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = lc.findIndex(h => aliases.includes(h))
    mapping[field] = idx >= 0 ? String(idx) : ''
  }
  return mapping
}

// ── Build books from rows + mapping ──────────────────────────────────────────

function buildBooks(rows, headers, mapping) {
  const currentYear = new Date().getFullYear()
  const now = new Date().toISOString()
  const get = (row, idxStr) =>
    (idxStr !== '' && idxStr !== undefined) ? String(row[parseInt(idxStr)] ?? '').trim() : ''
  const splitMulti = val => val ? val.split(/[;,]/).map(s => s.trim()).filter(Boolean) : []

  return rows
    .map(row => {
      const title = get(row, mapping.title)
      if (!title) return null
      const yearRaw = parseInt(get(row, mapping.year))
      const year = (yearRaw >= 1800 && yearRaw <= currentYear) ? yearRaw : currentYear
      const ratingRaw = parseFloat(get(row, mapping.rating))
      const rating = (!isNaN(ratingRaw) && ratingRaw >= 0 && ratingRaw <= 5) ? Math.round(ratingRaw) : 0
      return {
        id: uuidv4(), title,
        author:      get(row, mapping.author),
        year, format: 'paper', rating,
        description: get(row, mapping.description),
        notes:       '',
        topics:      splitMulti(get(row, mapping.topics)),
        legalOrder:  splitMulti(get(row, mapping.legalOrder)),
        tags:        splitMulti(get(row, mapping.tags)),
        yaPath:      '',
        createdAt: now, updatedAt: now,
      }
    })
    .filter(Boolean)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CSVImportModal({ isOpen, onClose, onImport }) {
  const [step, setStep] = useState('upload')   // upload | selectTable | map | done
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [sqliteTables, setSqliteTables] = useState(null)   // { tableName: {columns, rows} }
  const [selectedTable, setSelectedTable] = useState('')
  const [mapping, setMapping] = useState({})
  const [imported, setImported] = useState(0)
  const [totalInFile, setTotalInFile] = useState(0)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const reset = useCallback(() => {
    setStep('upload'); setHeaders([]); setRows([])
    setSqliteTables(null); setSelectedTable(''); setMapping({})
    setImported(0); setTotalInFile(0); setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  function handleClose() { reset(); onClose() }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const isSQLite = /\.(bak|sqlite|sqlite3|db)$/i.test(file.name)

    if (isSQLite) {
      setLoading(true)
      try {
        const buf = await file.arrayBuffer()
        const tables = await loadSQLite(buf)
        setSqliteTables(tables)
        const names = Object.keys(tables)
        // Auto-select if only one table, or pick first that looks like books
        const guess = names.find(n => /book|title|lib|catalog/i.test(n)) || names[0]
        if (guess) applyTable(tables, guess)
        else setStep('selectTable')
      } catch (err) {
        alert('Не удалось прочитать SQLite файл: ' + err.message)
      } finally {
        setLoading(false)
      }
    } else {
      const reader = new FileReader()
      reader.onload = ev => {
        const all = parseCSV(ev.target.result)
        if (all.length < 2) { alert('CSV файл пустой или содержит только заголовок'); return }
        const hdrs = all[0].map(h => h.trim())
        setHeaders(hdrs); setRows(all.slice(1))
        setMapping(autoDetect(hdrs)); setStep('map')
      }
      reader.readAsText(file, 'UTF-8')
    }
  }

  function applyTable(tables, name) {
    const t = (tables || sqliteTables)[name]
    if (!t) return
    setSelectedTable(name)
    setHeaders(t.columns)
    setRows(t.rows)
    setMapping(autoDetect(t.columns))
    setStep('map')
  }

  function handleImport() {
    if (!mapping.title) { alert('Необходимо выбрать колонку для Названия'); return }
    const books = buildBooks(rows, headers, mapping)
    setTotalInFile(books.length)
    const count = onImport(books)
    setImported(count); setStep('done')
  }

  const previewRows = rows.slice(0, 4)

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Импорт бумажных книг" size="xl">
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* UPLOAD */}
        {step === 'upload' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
            <div style={{ color: '#8899bb', fontSize: '14px', marginBottom: '20px', lineHeight: 1.8 }}>
              Поддерживаемые форматы:<br />
              <code style={{ color: '#c8a850' }}>.csv</code> — разделители <code style={{ color: '#c8a850' }}>,</code> или <code style={{ color: '#c8a850' }}>;</code>, UTF-8 / UTF-8 BOM<br />
              <code style={{ color: '#c8a850' }}>.bak / .sqlite / .db</code> — база данных SQLite
            </div>
            {loading
              ? <div style={{ color: '#c8a850' }}>⏳ Открываем базу данных...</div>
              : <Button variant="primary" size="lg" onClick={() => fileRef.current?.click()}>
                  Выбрать файл
                </Button>
            }
            <input ref={fileRef} type="file" accept=".csv,.txt,.bak,.sqlite,.sqlite3,.db"
              style={{ display: 'none' }} onChange={handleFile} />
          </div>
        )}

        {/* SELECT TABLE */}
        {step === 'selectTable' && sqliteTables && (
          <div>
            <div style={{ fontSize: '13px', color: '#8899bb', marginBottom: '16px' }}>
              Найдено {Object.keys(sqliteTables).length} таблиц. Выберите, какую импортировать:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(sqliteTables).map(([name, t]) => (
                <button key={name} onClick={() => applyTable(null, name)}
                  style={{
                    padding: '12px 16px', background: '#1a2035',
                    border: '1px solid #2a3050', borderRadius: '8px',
                    color: '#ccd6f6', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <span style={{ fontWeight: 500 }}>{name}</span>
                  <span style={{ fontSize: '12px', color: '#4a5a70' }}>
                    {t.rows.length} строк · {t.columns.join(', ').slice(0, 60)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MAP */}
        {step === 'map' && (
          <>
            <div style={{ fontSize: '13px', color: '#8899bb' }}>
              {selectedTable && <span>Таблица: <strong style={{ color: '#c8a850' }}>{selectedTable}</strong> · </span>}
              <strong style={{ color: '#c8a850' }}>{rows.length}</strong> строк,{' '}
              <strong style={{ color: '#c8a850' }}>{headers.length}</strong> колонок.
              Сопоставьте колонки с полями каталога:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <React.Fragment key={field}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#ccd6f6' }}>
                    {label}
                  </div>
                  <select value={mapping[field] ?? ''}
                    onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                    style={{
                      padding: '6px 10px', background: '#1a2035',
                      border: '1px solid #2a3050', borderRadius: '6px',
                      color: mapping[field] ? '#e0d8c8' : '#4a5a70', fontSize: '13px', cursor: 'pointer',
                    }}>
                    <option value="">— не импортировать —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={String(i)}>{h || `Колонка ${i + 1}`}</option>
                    ))}
                  </select>
                </React.Fragment>
              ))}
            </div>

            {previewRows.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: '#4a5a70', marginBottom: '8px' }}>
                  Предпросмотр (первые {previewRows.length} строк):
                </div>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #2a3050' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr>{headers.map((h, i) => (
                        <th key={i} style={{ padding: '6px 10px', background: '#1a2035', color: '#8899bb', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #2a3050' }}>
                          {h || `Col ${i + 1}`}
                        </th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri}>{headers.map((_, ci) => (
                          <td key={ci} style={{ padding: '5px 10px', color: '#7aaad0', borderBottom: '1px solid #1a2035', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row[ci] ?? ''}
                          </td>
                        ))}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="primary" size="md" onClick={handleImport} disabled={!mapping.title}>
                ⬇ Импортировать {rows.length} книг
              </Button>
              <Button variant="ghost" size="md" onClick={reset}>Другой файл</Button>
            </div>
          </>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ color: '#3a7a50', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Добавлено {imported} из {totalInFile} книг
            </div>
            <div style={{ color: '#8899bb', fontSize: '13px', marginBottom: '24px' }}>
              {totalInFile - imported > 0 && (
                <>{totalInFile - imported} книг пропущено — уже есть в каталоге (совпадение по названию).<br /></>
              )}
              Все книги добавлены с форматом «бумажная».
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Button variant="primary" size="md" onClick={handleClose}>Готово</Button>
              <Button variant="ghost" size="md" onClick={reset}>Импортировать ещё</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
