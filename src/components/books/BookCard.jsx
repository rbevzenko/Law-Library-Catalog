import React from 'react'
import { Badge } from '../ui/Badge'
import { StarRating } from '../ui/StarRating'
import { TOPIC_COLORS } from '../../constants'
import { Button } from '../ui/Button'

function topBorderStyle(format) {
  if (format === 'paper') return 'linear-gradient(90deg, #c8a850, #e0c870)'
  if (format === 'pdf') return 'linear-gradient(90deg, #4a7ab0, #7aaad0)'
  return 'linear-gradient(90deg, #c8a850, #4a7ab0)'
}

export function BookCard({ book, onEdit, onDelete, onOpenPDF }) {
  const truncate = (str, len) => str && str.length > len ? str.slice(0, len) + '...' : str

  return (
    <div
      className="book-card"
      style={{
        background: '#151825',
        border: '1px solid #2a3050',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Top border */}
      <div style={{
        height: '3px',
        background: topBorderStyle(book.format),
        flexShrink: 0,
      }} />

      <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Header */}
        <div>
          <h3 style={{
            margin: '0 0 4px 0',
            fontSize: '17px',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 700,
            color: '#e0d8c8',
            lineHeight: 1.3,
          }}>
            {book.title}
          </h3>
          <div style={{ fontSize: '13px', color: '#8899bb' }}>
            {book.author}{book.year ? `, ${book.year}` : ''}
          </div>
        </div>

        {/* Rating & Format */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StarRating value={book.rating || 0} size={14} />
          <Badge color={book.format === 'pdf' ? '#4a7ab0' : book.format === 'both' ? '#7a50b0' : '#c8a850'}>
            {book.format === 'pdf' ? 'PDF' : book.format === 'both' ? 'Бумага + PDF' : 'Бумага'}
          </Badge>
        </div>

        {/* Legal orders */}
        {book.legalOrder && book.legalOrder.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {book.legalOrder.map(lo => (
              <Badge key={lo} color="#8899bb" style={{ fontSize: '10px' }}>{lo}</Badge>
            ))}
          </div>
        )}

        {/* Topics */}
        {book.topics && book.topics.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {book.topics.map(t => (
              <Badge key={t} color={TOPIC_COLORS[t] || '#4a5a70'} style={{ fontSize: '10px' }}>{t}</Badge>
            ))}
          </div>
        )}

        {/* Description */}
        {book.description && (
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: '#8899bb',
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {book.description}
          </p>
        )}

        {/* Tags */}
        {book.tags && book.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {book.tags.map(tag => (
              <span
                key={tag}
                className="mono"
                style={{
                  fontSize: '11px',
                  color: '#4a5a70',
                  background: '#0f1220',
                  border: '1px solid #2a3050',
                  borderRadius: '4px',
                  padding: '1px 6px',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        padding: '12px 18px',
        borderTop: '1px solid #2a305060',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        {book.yaPath && (
          <Button variant="secondary" size="sm" onClick={() => onOpenPDF(book)}>
            📄 Открыть PDF
          </Button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <Button variant="ghost" size="sm" onClick={() => onEdit(book)} title="Редактировать">
            ✏️
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(book.id)} title="Удалить">
            🗑️
          </Button>
        </div>
      </div>
    </div>
  )
}
