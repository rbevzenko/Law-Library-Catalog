import React, { useState, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  // Strip BOM
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Detect delimiter: count ';' vs ',' in first line
  const firstLine = src.split('\n')[0] || ''
  const delim = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ','

  const rows = []
  let cur = ''
  let inQuotes = false
  let fields = []

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

// ── Auto-detect column mapping ────────────────────────────────────────────────

const FIELD_ALIASES = {
  title:      ['title', 'название', 'наименование', 'книга', 'заголовок', 'name'],
  author:     ['author', 'авторы', 'автор', 'authors'],
  year:       ['year', 'год', 'год издания', 'year published', 'дата'],
  description:['description', 'описание', 'аннотация', 'annotation', 'abstract'],
  notes:      ['notes', 'заметки', 'примечания', 'комментарий', 'note'],
  rating:     ['rating', 'рейтинг', 'оценка', 'stars'],
  topics:     ['topics', 'темы', 'тема', 'subject'],
  legalOrder: ['legalorder', 'legal order', 'правовая система', 'правовые системы', 'jurisdiction'],
  tags:       ['tags', 'теги', 'метки', 'keywords', 'ключевые слова'],
}

const FIELD_LABELS = {
  title:       'Название *',
  author:      'Автор',
  year:        'Год',
  description: 'Описание',
  notes:       'Заметки',
  rating:      'Рейтинг (0–5)',
  topics:      'Темы',
  legalOrder:  'Правовые системы',
  tags:        'Теги',
}

function autoDetect(headers) {
  const mapping = {}
  const lc = headers.map(h => h.trim().toLowerCase())
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = lc.findIndex(h => aliases.includes(h))
    mapping[field] = idx >= 0 ? String(idx) : ''
  }
  return mapping
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CSVImportModal({ isOpen, onClose, onImport }) {
  const [step, setStep] = useState('upload') // upload | map | done
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])       // all data rows (without header)
  const [mapping, setMapping] = useState({}) // field → column index string
  const [imported, setImported] = useState(0)
  const fileRef = useRef()

  const reset = useCallback(() => {
    setStep('upload')
    setHeaders([])
    setRows([])
    setMapping({})
    setImported(0)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  function handleClose() { reset(); onClose() }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const all = parseCSV(ev.target.result)
      if (all.length < 2) { alert('CSV файл пустой или содержит только заголовок'); return }
      const hdrs = all[0].map(h => h.trim())
      const dataRows = all.slice(1)
      setHeaders(hdrs)
      setRows(dataRows)
      setMapping(autoDetect(hdrs))
      setStep('map')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleImport() {
    const titleIdx = mapping.title !== '' ? parseInt(mapping.title) : null
    if (titleIdx === null) { alert('Необходимо выбрать колонку для Названия'); return }

    const now = new Date().toISOString()
    const currentYear = new Date().getFullYear()
    const books = []

    for (const row of rows) {
      const get = idx => (idx !== '' && idx !== null && idx !== undefined)
        ? (row[parseInt(idx)] || '').trim()
        : ''

      const title = get(mapping.title)
      if (!title) continue

      const yearRaw = parseInt(get(mapping.year)) || currentYear
      const year = (yearRaw >= 1800 && yearRaw <= currentYear) ? yearRaw : currentYear

      const ratingRaw = parseFloat(get(mapping.rating))
      const rating = (!isNaN(ratingRaw) && ratingRaw >= 0 && ratingRaw <= 5)
        ? Math.round(ratingRaw) : 0

      const splitMulti = val => val
        ? val.split(/[;,]/).map(s => s.trim()).filter(Boolean)
        : []

      books.push({
        id: uuidv4(),
        title,
        author:      get(mapping.author),
        year,
        format:      'paper',
        rating,
        description: get(mapping.description),
        notes:       get(mapping.notes),
        topics:      splitMulti(get(mapping.topics)),
        legalOrder:  splitMulti(get(mapping.legalOrder)),
        tags:        splitMulti(get(mapping.tags)),
        yaPath:      '',
        createdAt:   now,
        updatedAt:   now,
      })
    }

    const count = onImport(books)
    setImported(count)
    setStep('done')
  }

  const previewRows = rows.slice(0, 4)
  const NONE = ''

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Импорт из CSV" size="xl">
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* STEP: upload */}
        {step === 'upload' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <div style={{ color: '#8899bb', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
              Поддерживаются файлы CSV с разделителями <code style={{ color: '#c8a850' }}>,</code> или <code style={{ color: '#c8a850' }}>;</code><br />
              Кодировка UTF-8 или с BOM (стандартный экспорт Excel). Первая строка — заголовки.
            </div>
            <Button variant="primary" size="lg" onClick={() => fileRef.current?.click()}>
              Выбрать файл CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
          </div>
        )}

        {/* STEP: map */}
        {step === 'map' && (
          <>
            <div style={{ fontSize: '13px', color: '#8899bb' }}>
              Найдено <strong style={{ color: '#c8a850' }}>{rows.length}</strong> строк, <strong style={{ color: '#c8a850' }}>{headers.length}</strong> колонок.
              Сопоставьте колонки файла с полями каталога.
            </div>

            {/* Mapping table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <React.Fragment key={field}>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#ccd6f6' }}>
                    {label}
                  </div>
                  <select
                    value={mapping[field] ?? NONE}
                    onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                    style={{
                      padding: '6px 10px', background: '#1a2035',
                      border: '1px solid #2a3050', borderRadius: '6px',
                      color: mapping[field] ? '#e0d8c8' : '#4a5a70',
                      fontSize: '13px', cursor: 'pointer',
                    }}
                  >
                    <option value="">— не импортировать —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={String(i)}>{h || `Колонка ${i + 1}`}</option>
                    ))}
                  </select>
                </React.Fragment>
              ))}
            </div>

            {/* Preview */}
            {previewRows.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: '#4a5a70', marginBottom: '8px' }}>
                  Предпросмотр (первые {previewRows.length} строк):
                </div>
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #2a3050' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        {headers.map((h, i) => (
                          <th key={i} style={{ padding: '6px 10px', background: '#1a2035', color: '#8899bb', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #2a3050' }}>
                            {h || `Col ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri}>
                          {headers.map((_, ci) => (
                            <td key={ci} style={{ padding: '5px 10px', color: '#7aaad0', borderBottom: '1px solid #1a2035', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row[ci] || ''}
                            </td>
                          ))}
                        </tr>
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
              <Button variant="ghost" size="md" onClick={reset}>
                Другой файл
              </Button>
            </div>
          </>
        )}

        {/* STEP: done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ color: '#3a7a50', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Импортировано {imported} книг
            </div>
            <div style={{ color: '#8899bb', fontSize: '13px', marginBottom: '24px' }}>
              Дубликаты (совпадение по названию) были пропущены.<br />
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
