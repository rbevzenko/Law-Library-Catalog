import React from 'react'
import { LEGAL_ORDERS, TOPICS, TOPIC_COLORS } from '../../constants'
import { Button } from '../ui/Button'

const FORMATS = [
  { value: 'all', label: 'Все форматы' },
  { value: 'paper', label: 'Бумага' },
  { value: 'pdf', label: 'PDF' },
  { value: 'both', label: 'Бумага + PDF' },
]

const SORT_OPTIONS = [
  { value: 'title', label: 'По названию (А–Я)' },
  { value: 'author', label: 'По автору' },
  { value: 'year_asc', label: 'По году (старые)' },
  { value: 'year_desc', label: 'По году (новые)' },
  { value: 'rating', label: 'По оценке' },
  { value: 'createdAt', label: 'По дате добавления' },
]

export function FilterPanel({ filters, onChange, onReset, totalCount, filteredCount }) {
  function toggle(key, value) {
    const current = filters[key] || []
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  function setFilter(key, value) {
    onChange({ ...filters, [key]: value })
  }

  const hasActiveFilters =
    (filters.legalOrder || []).length > 0 ||
    (filters.topics || []).length > 0 ||
    (filters.format && filters.format !== 'all') ||
    (filters.minRating && filters.minRating > 0)

  const inputStyle = {
    background: '#1a2035',
    border: '1px solid #2a3050',
    borderRadius: '6px',
    color: '#e0d8c8',
    fontSize: '13px',
    padding: '6px 10px',
    cursor: 'pointer',
  }

  return (
    <aside style={{
      background: '#151825',
      border: '1px solid #2a3050',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      minWidth: '220px',
      maxWidth: '240px',
      alignSelf: 'flex-start',
      position: 'sticky',
      top: '80px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{
          margin: 0,
          fontSize: '14px',
          color: '#8899bb',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontFamily: 'system-ui',
          fontWeight: 500,
        }}>
          Фильтры
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            style={{
              background: 'none', border: 'none',
              color: '#c8a850', cursor: 'pointer',
              fontSize: '12px', padding: 0,
              transition: 'opacity 0.15s',
            }}
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ fontSize: '12px', color: '#4a5a70' }}>
        Показано: {filteredCount} из {totalCount}
      </div>

      {/* Sort */}
      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Сортировка
        </label>
        <select
          value={filters.sortBy || 'title'}
          onChange={e => setFilter('sortBy', e.target.value)}
          style={{ ...inputStyle, width: '100%' }}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Format */}
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Формат
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {FORMATS.map(f => (
            <label key={f.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: (filters.format || 'all') === f.value ? '#e0d8c8' : '#8899bb' }}>
              <input
                type="radio"
                name="format"
                value={f.value}
                checked={(filters.format || 'all') === f.value}
                onChange={() => setFilter('format', f.value)}
                style={{ accentColor: '#c8a850' }}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Rating */}
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Минимальная оценка: {filters.minRating || 0}★
        </label>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={filters.minRating || 0}
          onChange={e => setFilter('minRating', Number(e.target.value))}
          style={{ width: '100%', accentColor: '#c8a850' }}
        />
      </div>

      {/* Legal orders */}
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Правопорядок
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '200px', overflowY: 'auto' }}>
          {LEGAL_ORDERS.map(lo => {
            const active = (filters.legalOrder || []).includes(lo)
            return (
              <label key={lo} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: active ? '#e0d8c8' : '#8899bb' }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle('legalOrder', lo)}
                  style={{ accentColor: '#c8a850' }}
                />
                {lo}
              </label>
            )
          })}
        </div>
      </div>

      {/* Topics */}
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#4a5a70', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Темы
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '200px', overflowY: 'auto' }}>
          {TOPICS.map(t => {
            const active = (filters.topics || []).includes(t)
            const color = TOPIC_COLORS[t] || '#4a5a70'
            return (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: active ? color : '#8899bb' }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggle('topics', t)}
                  style={{ accentColor: color }}
                />
                {t}
              </label>
            )
          })}
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div>
          <div style={{ fontSize: '12px', color: '#4a5a70', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Активные фильтры</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {(filters.legalOrder || []).map(lo => (
              <span
                key={lo}
                onClick={() => toggle('legalOrder', lo)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: '10px',
                  background: 'rgba(200,168,80,0.1)', border: '1px solid rgba(200,168,80,0.3)',
                  color: '#c8a850', fontSize: '11px', cursor: 'pointer',
                }}
              >
                {lo} ×
              </span>
            ))}
            {(filters.topics || []).map(t => (
              <span
                key={t}
                onClick={() => toggle('topics', t)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: '10px',
                  background: `${TOPIC_COLORS[t] || '#4a5a70'}20`,
                  border: `1px solid ${TOPIC_COLORS[t] || '#4a5a70'}40`,
                  color: TOPIC_COLORS[t] || '#4a5a70', fontSize: '11px', cursor: 'pointer',
                }}
              >
                {t} ×
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
