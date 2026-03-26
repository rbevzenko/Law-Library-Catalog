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

export function BookForm({ isOpen, onClose, book, onSave, token, anthropicKey, booksFolder }) {
  const [form, setForm] = useState(emptyBook)
  const [tagInput, setTagInput] = useState('')
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

  function doStopScan() {
    scanningRef.current = false
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
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

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = tagInput.trim().replace(/^#/, '')
      if (tag && !form.tags.includes(tag)) {
        set('tags', [...form.tags, tag])
      }
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) {
      set('tags', form.tags.slice(0, -1))
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
    if (!('BarcodeDetector' in window)) {
      setIsbnError('Сканирование не поддерживается в этом браузере. Введите ISBN вручную.')
      return
    }
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
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39'] })
      const loop = async () => {
        if (!scanningRef.current) return
        try {
          const results = await detector.detect(videoRef.current)
          if (results.length > 0) {
            const raw = results[0].rawValue.replace(/[^0-9X]/gi, '')
            if (raw.length === 13 || raw.length === 10) {
              doStopScan()
              applyISBN(raw)
              return
            }
          }
        } catch { /* ignore single-frame errors */ }
        animFrameRef.current = requestAnimationFrame(loop)
      }
      animFrameRef.current = requestAnimationFrame(loop)
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
          <div>
            <label style={labelStyle}>Автор *</label>
            <input
              style={inputStyle}
              value={form.author}
              onChange={e => set('author', e.target.value)}
              placeholder="Фамилия И.О."
              required
            />
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
        <div>
          <label style={labelStyle}>Теги (Enter или запятая для добавления)</label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'center',
            padding: '8px 10px',
            background: '#1a2035',
            border: '1px solid #2a3050',
            borderRadius: '8px',
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
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={form.tags.length === 0 ? 'пандектистика, договор...' : ''}
              style={{
                background: 'none', border: 'none', color: '#e0d8c8',
                fontSize: '13px', outline: 'none', flex: 1, minWidth: '80px',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>
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
