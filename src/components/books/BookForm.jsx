import React, { useState, useEffect, useRef } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { StarRating } from '../ui/StarRating'
import { Badge } from '../ui/Badge'
import { YaDiskBrowser } from '../yadisk/YaDiskBrowser'
import { LEGAL_ORDERS, TOPICS, TOPIC_COLORS } from '../../constants'
import { generateDescription } from '../../api/anthropic'
import { fetchByISBN } from '../../api/isbn'

const emptyBook = {
  title: '', author: '', year: '', legalOrder: [], topics: [],
  description: '', tags: [], format: 'paper', rating: 0, notes: '', yaPath: '',
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  background: '#1a2035',
  border: '1px solid #2a3050',
  borderRadius: '8px',
  color: '#e0d8c8',
  fontSize: '14px',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '12px',
  color: '#8899bb',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

function CheckGroup({ options, value, onChange, colorMap }) {
  function toggle(opt) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px' }}>
      {options.map(opt => {
        const active = value.includes(opt)
        const color = colorMap ? colorMap[opt] : '#c8a850'
        return (
          <label key={opt} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            cursor: 'pointer', fontSize: '13px',
            color: active ? (color || '#e0d8c8') : '#8899bb',
            padding: '3px 0',
          }}>
            <input
              type="checkbox"
              checked={active}
              onChange={() => toggle(opt)}
              style={{ accentColor: color || '#c8a850' }}
            />
            {opt}
          </label>
        )
      })}
    </div>
  )
}

export function BookForm({ isOpen, onClose, book, onSave, token, anthropicKey, booksFolder, allTags, allAuthors }) {
  const [form, setForm] = useState(emptyBook)
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [suggestionIndex, setSuggestionIndex] = useState(-1)
  const [authorSuggestions, setAuthorSuggestions] = useState([])
  const [authorSuggestionIndex, setAuthorSuggestionIndex] = useState(-1)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [saving, setSaving] = useState(false)
  const [isbnInput, setIsbnInput] = useState('')
  const [isbnLoading, setIsbnLoading] = useState(false)
  const [isbnError, setIsbnError] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanningRef = useRef(false)
  const animFrameRef = useRef(null)
  const zxingReaderRef = useRef(null)

  function doStopScan() {
    scanningRef.current = false
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    if (zxingReaderRef.current) { try { zxingReaderRef.current.reset() } catch {} ; zxingReaderRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setScanOpen(false)
  }

  useEffect(() => {
    if (isOpen) {
      if (book) {
        setForm({ ...emptyBook, ...book })
        setTagInput('')
      } else {
        setForm(emptyBook)
        setTagInput('')
      }
      setGenError('')
      setIsbnInput('')
      setIsbnError('')
    } else {
      doStopScan()
    }
  }, [isOpen, book]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function computeSuggestions(input, currentTags) {
    const q = input.trim().replace(/^#/, '').toLowerCase()
    if (!q || !allTags?.length) return []
    return allTags
      .filter(t => t.toLowerCase().includes(q) && !currentTags.includes(t))
      .slice(0, 8)
  }

  function addTag(raw) {
    const tag = raw.trim().replace(/^#/, '')
    if (tag && !form.tags.includes(tag)) set('tags', [...form.tags, tag])
    setTagInput('')
    setTagSuggestions([])
    setSuggestionIndex(-1)
  }

  function handleTagInput(e) {
    const val = e.target.value
    setTagInput(val)
    const s = computeSuggestions(val, form.tags)
    setTagSuggestions(s)
    setSuggestionIndex(-1)
  }

  function handleTagKeyDown(e) {
    if (tagSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(i => Math.min(i + 1, tagSuggestions.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSuggestionIndex(i => Math.max(i - 1, -1)); return }
      if (e.key === 'Escape')    { setTagSuggestions([]); setSuggestionIndex(-1); return }
      if (e.key === 'Tab')       { e.preventDefault(); addTag(suggestionIndex >= 0 ? tagSuggestions[suggestionIndex] : tagSuggestions[0]); return }
    }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (suggestionIndex >= 0 && tagSuggestions[suggestionIndex]) {
        addTag(tagSuggestions[suggestionIndex])
      } else {
        addTag(tagInput)
      }
      return
    }
    if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) {
      set('tags', form.tags.slice(0, -1))
    }
  }

  function handleAuthorInput(e) {
    const val = e.target.value
    set('author', val)
    if (!val.trim() || !allAuthors?.length) { setAuthorSuggestions([]); return }
    const q = val.trim().toLowerCase()
    setAuthorSuggestions(
      allAuthors.filter(a => a.toLowerCase().includes(q) && a !== val.trim()).slice(0, 8)
    )
    setAuthorSuggestionIndex(-1)
  }

  function handleAuthorKeyDown(e) {
    if (authorSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAuthorSuggestionIndex(i => Math.min(i + 1, authorSuggestions.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAuthorSuggestionIndex(i => Math.max(i - 1, -1)); return }
      if (e.key === 'Escape')    { setAuthorSuggestions([]); setAuthorSuggestionIndex(-1); return }
      if (e.key === 'Tab' || e.key === 'Enter') {
        const pick = authorSuggestionIndex >= 0 ? authorSuggestions[authorSuggestionIndex] : authorSuggestions[0]
        if (pick) { e.preventDefault(); set('author', pick); setAuthorSuggestions([]); setAuthorSuggestionIndex(-1) }
      }
    }
  }

  async function applyISBN(isbn) {
    setIsbnInput(isbn)
    setIsbnLoading(true)
    setIsbnError('')
    try {
      const found = await fetchByISBN(isbn)
      setForm(f => ({
        ...f,
        title:       found.title       || f.title,
        author:      found.author      || f.author,
        year:        found.year        || f.year,
        description: found.description || f.description,
        tags:        found.tags?.length ? found.tags : f.tags,
      }))
    } catch (err) {
      setIsbnError(err.message)
    } finally {
      setIsbnLoading(false)
    }
  }

  function handleISBNLookup() {
    if (!isbnInput.trim()) return
    applyISBN(isbnInput.trim())
  }

  async function handleScanStart() {
    setIsbnError('')
    setScanOpen(true)
    scanningRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      // wait for videoRef to be in DOM after setScanOpen(true)
      await new Promise(r => setTimeout(r, 50))
      if (!videoRef.current) { doStopScan(); return }
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      if ('BarcodeDetector' in window) {
        // Native path — Chrome / Edge
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39'] })
        const loop = async () => {
          if (!scanningRef.current) return
          try {
            const results = await detector.detect(videoRef.current)
            if (results.length > 0) {
              const raw = results[0].rawValue.replace(/[^0-9X]/gi, '')
              if (raw.length === 13 || raw.length === 10) {
                doStopScan(); applyISBN(raw); return
              }
            }
          } catch { /* ignore single-frame errors */ }
          animFrameRef.current = requestAnimationFrame(loop)
        }
        animFrameRef.current = requestAnimationFrame(loop)
      } else {
        // ZXing fallback — Safari / iOS / Firefox
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        zxingReaderRef.current = reader
        reader.decodeFromStream(stream, videoRef.current, (result) => {
          if (!scanningRef.current || !result) return
          const raw = result.getText().replace(/[^0-9X]/gi, '')
          if (raw.length === 13 || raw.length === 10) {
            doStopScan(); applyISBN(raw)
          }
        }).catch(() => {}) // ignore reset/stream-end errors
      }
    } catch (err) {
      doStopScan()
      setIsbnError('Нет доступа к камере: ' + (err.message || String(err)))
    }
  }

  async function handleGenerate() {
    if (!anthropicKey) {
      setGenError('Добавьте ключ Anthropic API в настройках')
      return
    }
    setGenerating(true)
    setGenError('')
    try {
      const text = await generateDescription(form, anthropicKey)
      set('description', text)
    } catch (err) {
      setGenError('Ошибка генерации: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isEdit = !!book

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? '✏️ Редактировать книгу' : '+ Добавить книгу'}
      size="xl"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '8px' }}>

        {/* ISBN lookup */}
        {!book && (
          <div style={{ background: 'rgba(200,168,80,0.06)', border: '1px solid rgba(200,168,80,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '12px', color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Найти по ISBN
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...inputStyle, flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}
                value={isbnInput}
                onChange={e => { setIsbnInput(e.target.value); setIsbnError('') }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleISBNLookup())}
                placeholder="9780199292042"
                disabled={isbnLoading || scanOpen}
              />
              <Button variant="secondary" size="sm" type="button"
                onClick={handleISBNLookup}
                disabled={isbnLoading || scanOpen || !isbnInput.trim()}
              >
                {isbnLoading ? '⏳' : '🔍 Найти'}
              </Button>
              <Button variant="secondary" size="sm" type="button"
                onClick={scanOpen ? doStopScan : handleScanStart}
                disabled={isbnLoading}
                style={scanOpen ? { borderColor: 'rgba(200,80,80,0.5)', color: '#e07070' } : {}}
              >
                {scanOpen ? '⏹ Стоп' : '📷 Скан'}
              </Button>
            </div>

            {/* Camera viewfinder */}
            {scanOpen && (
              <div style={{ position: 'relative', marginTop: '10px', borderRadius: '8px', overflow: 'hidden', background: '#000', lineHeight: 0 }}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }}
                  muted
                  playsInline
                />
                {/* Targeting frame */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: '75%', height: '56px', border: '2px solid #c8a850', borderRadius: '4px', boxShadow: '0 0 0 1000px rgba(0,0,0,0.45)' }} />
                </div>
                <div style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, textAlign: 'center', fontSize: '12px', color: 'rgba(200,168,80,0.9)', pointerEvents: 'none' }}>
                  Наведите штрих-код в рамку
                </div>
              </div>
            )}

            {isbnError && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#e05050' }}>{isbnError}</div>
            )}
          </div>
        )}

        {/* Title & Author */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Название *</label>
            <input
              style={inputStyle}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Введите название книги"
              required
            />
          </div>
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Автор *</label>
            <input
              style={{ ...inputStyle, borderRadius: authorSuggestions.length > 0 ? '8px 8px 0 0' : '8px' }}
              value={form.author}
              onChange={handleAuthorInput}
              onKeyDown={handleAuthorKeyDown}
              onBlur={() => setTimeout(() => { setAuthorSuggestions([]); setAuthorSuggestionIndex(-1) }, 150)}
              placeholder="Фамилия И.О."
              required
            />
            {authorSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                background: '#1a2035', border: '1px solid #2a3050', borderTop: 'none',
                borderRadius: '0 0 8px 8px', overflow: 'hidden',
              }}>
                {authorSuggestions.map((author, i) => (
                  <div
                    key={author}
                    onMouseDown={e => { e.preventDefault(); set('author', author); setAuthorSuggestions([]); setAuthorSuggestionIndex(-1) }}
                    onMouseEnter={() => setAuthorSuggestionIndex(i)}
                    style={{
                      padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
                      background: i === authorSuggestionIndex ? 'rgba(200,168,80,0.12)' : 'transparent',
                      color: i === authorSuggestionIndex ? '#c8a850' : '#8899bb',
                      borderTop: i > 0 ? '1px solid rgba(42,48,80,0.5)' : 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {author}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Year & Format & Rating */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Год</label>
            <input
              style={inputStyle}
              value={form.year}
              onChange={e => set('year', e.target.value)}
              placeholder="1887"
              type="number"
              min="1"
              max="2100"
            />
          </div>
          <div>
            <label style={labelStyle}>Формат</label>
            <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
              {['paper', 'pdf', 'both'].map(f => (
                <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: form.format === f ? '#e0d8c8' : '#8899bb' }}>
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={form.format === f}
                    onChange={() => set('format', f)}
                    style={{ accentColor: '#c8a850' }}
                  />
                  {f === 'paper' ? 'Бумага' : f === 'pdf' ? 'PDF' : 'Оба'}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Оценка</label>
            <StarRating value={form.rating} onChange={v => set('rating', v)} size={22} />
          </div>
        </div>

        {/* Legal orders */}
        <div>
          <label style={labelStyle}>Правопорядок</label>
          <div style={{ background: '#1a2035', border: '1px solid #2a3050', borderRadius: '8px', padding: '12px' }}>
            <CheckGroup options={LEGAL_ORDERS} value={form.legalOrder} onChange={v => set('legalOrder', v)} />
          </div>
        </div>

        {/* Topics */}
        <div>
          <label style={labelStyle}>Темы</label>
          <div style={{ background: '#1a2035', border: '1px solid #2a3050', borderRadius: '8px', padding: '12px' }}>
            <CheckGroup options={TOPICS} value={form.topics} onChange={v => set('topics', v)} colorMap={TOPIC_COLORS} />
          </div>
        </div>

        {/* Description */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Аннотация</label>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGenerate}
              disabled={generating || !form.title}
              type="button"
            >
              {generating ? '⏳ Генерация...' : '✨ Сгенерировать аннотацию'}
            </Button>
          </div>
          {genError && (
            <div style={{ marginBottom: '6px', fontSize: '12px', color: '#e05050' }}>{genError}</div>
          )}
          <textarea
            style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', lineHeight: 1.6 }}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Академическая аннотация..."
          />
        </div>

        {/* Tags */}
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>Теги (Enter или запятая для добавления)</label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'center',
            padding: '8px 10px',
            background: '#1a2035',
            border: '1px solid #2a3050',
            borderRadius: tagSuggestions.length > 0 ? '8px 8px 0 0' : '8px',
            minHeight: '44px',
          }}>
            {form.tags.map(tag => (
              <span
                key={tag}
                onClick={() => set('tags', form.tags.filter(t => t !== tag))}
                className="mono"
                style={{
                  fontSize: '12px', color: '#c8a850', background: 'rgba(200,168,80,0.1)',
                  border: '1px solid rgba(200,168,80,0.25)', borderRadius: '4px',
                  padding: '2px 8px', cursor: 'pointer',
                }}
              >
                #{tag} ×
              </span>
            ))}
            <input
              value={tagInput}
              onChange={handleTagInput}
              onKeyDown={handleTagKeyDown}
              onBlur={() => setTimeout(() => { setTagSuggestions([]); setSuggestionIndex(-1) }, 150)}
              placeholder={form.tags.length === 0 ? 'пандектистика, договор...' : ''}
              style={{
                background: 'none', border: 'none', color: '#e0d8c8',
                fontSize: '13px', outline: 'none', flex: 1, minWidth: '80px',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>

          {/* Suggestions dropdown */}
          {tagSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
              background: '#1a2035', border: '1px solid #2a3050', borderTop: 'none',
              borderRadius: '0 0 8px 8px', overflow: 'hidden',
            }}>
              {tagSuggestions.map((tag, i) => (
                <div
                  key={tag}
                  onMouseDown={e => { e.preventDefault(); addTag(tag) }}
                  onMouseEnter={() => setSuggestionIndex(i)}
                  style={{
                    padding: '7px 12px', cursor: 'pointer', fontSize: '13px',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: i === suggestionIndex ? 'rgba(200,168,80,0.12)' : 'transparent',
                    color: i === suggestionIndex ? '#c8a850' : '#8899bb',
                    borderTop: i > 0 ? '1px solid rgba(42,48,80,0.5)' : 'none',
                  }}
                >
                  #{tag}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Личные заметки</label>
          <textarea
            style={{ ...inputStyle, minHeight: '70px', resize: 'vertical', lineHeight: 1.6 }}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Заметки для личного пользования..."
          />
        </div>

        {/* yaPath */}
        <div>
          <label style={labelStyle}>Путь к PDF на Яндекс.Диске</label>
          <input
            style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}
            value={form.yaPath}
            onChange={e => set('yaPath', e.target.value)}
            placeholder="disk:/Lex Bibliotheca/book.pdf"
          />
          <YaDiskBrowser
            token={token}
            onSelect={path => set('yaPath', path)}
            initialPath={booksFolder || 'disk:/'}
          />
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          paddingTop: '8px',
          borderTop: '1px solid #2a3050',
          marginTop: '4px',
        }}>
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            Отмена
          </Button>
          <Button variant="primary" size="md" type="submit" disabled={saving || !form.title.trim()}>
            {saving ? '⏳ Сохранение...' : (isEdit ? 'Сохранить изменения' : 'Добавить книгу')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
