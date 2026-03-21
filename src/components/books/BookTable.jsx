import React, { useState } from 'react'
import { StarRating } from '../ui/StarRating'
import { Button } from '../ui/Button'

export function BookTable({ books, onEdit, onDelete, onOpenPDF }) {
  const [sortKey, setSortKey] = useState('title')
  const [sortDir, setSortDir] = useState('asc')

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...books].sort((a, b) => {
    let va = a[sortKey] ?? ''
    let vb = b[sortKey] ?? ''
    if (Array.isArray(va)) va = va.join(', ')
    if (Array.isArray(vb)) vb = vb.join(', ')
    if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb), 'ru')
      : String(vb).localeCompare(String(va), 'ru')
  })

  function Th({ label, col }) {
    const active = sortKey === col
    return (
      <th
        onClick={() => toggleSort(col)}
        style={{
          padding: '12px 14px',
          textAlign: 'left',
          fontSize: '12px',
          color: active ? '#c8a850' : '#4a5a70',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid #2a3050',
          transition: 'color 0.15s',
          fontWeight: active ? 600 : 400,
          background: '#151825',
        }}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <Th label="Название" col="title" />
            <Th label="Автор" col="author" />
            <Th label="Год" col="year" />
            <Th label="Правопорядок" col="legalOrder" />
            <Th label="Темы" col="topics" />
            <Th label="Формат" col="format" />
            <Th label="Оценка" col="rating" />
            <th style={{ padding: '12px 14px', borderBottom: '1px solid #2a3050', background: '#151825' }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((book, i) => (
            <tr
              key={book.id}
              style={{
                background: i % 2 === 0 ? 'transparent' : 'rgba(26,32,53,0.4)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,168,80,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(26,32,53,0.4)'}
            >
              <td style={{ padding: '10px 14px', color: '#e0d8c8', fontFamily: "'Cormorant Garamond', serif", fontSize: '15px', fontWeight: 600, maxWidth: '240px' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
              </td>
              <td style={{ padding: '10px 14px', color: '#8899bb', whiteSpace: 'nowrap' }}>{book.author}</td>
              <td style={{ padding: '10px 14px', color: '#8899bb', whiteSpace: 'nowrap' }}>{book.year}</td>
              <td style={{ padding: '10px 14px', color: '#8899bb', maxWidth: '150px' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(book.legalOrder || []).join(', ')}
                </div>
              </td>
              <td style={{ padding: '10px 14px', color: '#8899bb', maxWidth: '200px' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(book.topics || []).join(', ')}
                </div>
              </td>
              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                <span style={{
                  fontSize: '11px',
                  color: book.format === 'pdf' ? '#7aaad0' : book.format === 'both' ? '#b08ad0' : '#c8a850',
                }}>
                  {book.format === 'pdf' ? 'PDF' : book.format === 'both' ? 'Бумага+PDF' : 'Бумага'}
                </span>
              </td>
              <td style={{ padding: '10px 14px' }}>
                <StarRating value={book.rating || 0} size={12} />
              </td>
              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {book.yaPath && (
                    <button
                      onClick={() => onOpenPDF(book)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7aaad0', fontSize: '14px', padding: '2px 4px' }}
                      title="Открыть PDF"
                    >📄</button>
                  )}
                  <button
                    onClick={() => onEdit(book)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899bb', fontSize: '14px', padding: '2px 4px' }}
                    title="Редактировать"
                  >✏️</button>
                  <button
                    onClick={() => onDelete(book.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e05050', fontSize: '14px', padding: '2px 4px' }}
                    title="Удалить"
                  >🗑️</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {books.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#4a5a70', fontSize: '14px' }}>
          Книги не найдены
        </div>
      )}
    </div>
  )
}
