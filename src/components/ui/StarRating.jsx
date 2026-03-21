import React, { useState } from 'react'

export function StarRating({ value = 0, onChange, size = 18 }) {
  const [hovered, setHovered] = useState(0)
  const interactive = typeof onChange === 'function'

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: '2px',
        cursor: interactive ? 'pointer' : 'default',
      }}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (interactive ? hovered || value : value)
        return (
          <span
            key={star}
            onMouseEnter={() => interactive && setHovered(star)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange(star === value ? 0 : star)}
            style={{
              fontSize: `${size}px`,
              color: filled ? '#c8a850' : '#2a3050',
              transition: 'color 0.1s ease',
              lineHeight: 1,
            }}
          >
            ★
          </span>
        )
      })}
    </div>
  )
}
