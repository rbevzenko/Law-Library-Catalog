import React from 'react'

export function Badge({ color, children, style = {} }) {
  const bg = color ? `${color}22` : 'rgba(200,168,80,0.12)'
  const border = color ? `${color}44` : 'rgba(200,168,80,0.3)'
  const text = color || '#c8a850'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '500',
        background: bg,
        border: `1px solid ${border}`,
        color: text,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
