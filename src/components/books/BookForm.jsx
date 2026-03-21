import React, { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { StarRating } from '../ui/StarRating'
import { Badge } from '../ui/Badge'
import { YaDiskBrowser } from '../yadisk/YaDiskBrowser'
import { LEGAL_ORDERS, TOPICS, TOPIC_COLORS } from '../../constants'
import { generateDescription } from '../../api/anthropic'

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

export function BookForm({ isOpen, onClose, book, onSave, token, anthropicKey }) {
  const [form, setForm] = useState(emptyBook)
  const [tagInput, setTagInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [saving, setSaving] = useState(false)

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
    }
  }, [isOpen, book])

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
