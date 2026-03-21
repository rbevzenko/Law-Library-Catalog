import React from 'react'

const variants = {
  primary: {
    background: 'linear-gradient(135deg, #c8a850, #e0c870)',
    color: '#0f1220',
    border: 'none',
    fontWeight: '600',
  },
  secondary: {
    background: '#1a2035',
    color: '#e0d8c8',
    border: '1px solid #2a3050',
  },
  danger: {
    background: '#3a1515',
    color: '#e05050',
    border: '1px solid #5a2020',
  },
  ghost: {
    background: 'transparent',
    color: '#8899bb',
    border: '1px solid transparent',
  },
}

const sizes = {
  sm: { padding: '4px 10px', fontSize: '12px', borderRadius: '6px' },
  md: { padding: '8px 16px', fontSize: '14px', borderRadius: '8px' },
  lg: { padding: '12px 24px', fontSize: '16px', borderRadius: '10px' },
}

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  onClick,
  disabled,
  type = 'button',
  style = {},
  className = '',
  title,
}) {
  const variantStyle = variants[variant] || variants.secondary
  const sizeStyle = sizes[size] || sizes.md

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={className}
      style={{
        ...variantStyle,
        ...sizeStyle,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          if (variant === 'primary') {
            e.currentTarget.style.filter = 'brightness(1.1)'
          } else if (variant === 'secondary') {
            e.currentTarget.style.borderColor = '#4a6090'
            e.currentTarget.style.background = '#1f2a45'
          } else if (variant === 'danger') {
            e.currentTarget.style.background = '#4a1515'
            e.currentTarget.style.borderColor = '#7a2020'
          } else if (variant === 'ghost') {
            e.currentTarget.style.color = '#e0d8c8'
            e.currentTarget.style.borderColor = '#2a3050'
          }
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter = ''
        if (variant === 'secondary') {
          e.currentTarget.style.borderColor = '#2a3050'
          e.currentTarget.style.background = '#1a2035'
        } else if (variant === 'danger') {
          e.currentTarget.style.background = '#3a1515'
          e.currentTarget.style.borderColor = '#5a2020'
        } else if (variant === 'ghost') {
          e.currentTarget.style.color = '#8899bb'
          e.currentTarget.style.borderColor = 'transparent'
        }
      }}
    >
      {children}
    </button>
  )
}
