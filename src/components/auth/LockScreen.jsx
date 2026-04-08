import React, { useState, useRef, useEffect } from 'react'

export function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pin.trim()) return
    setLoading(true)
    setError('')
    const ok = await onUnlock(pin)
    setLoading(false)
    if (!ok) {
      setError('Неверный код доступа')
      setPin('')
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0a0d1a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '32px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '72px', marginBottom: '12px', lineHeight: 1 }}>📚</div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '28px', fontWeight: 600,
          color: '#c8a850', letterSpacing: '0.04em',
        }}>
          Law Library
        </div>
        <div style={{ fontSize: '13px', color: '#4a5a70', marginTop: '6px' }}>
          Введите код доступа
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '320px', padding: '0 24px', boxSizing: 'border-box' }}>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type={show ? 'text' : 'password'}
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            placeholder="Код доступа"
            autoComplete="current-password"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 44px 12px 16px',
              background: '#151825',
              border: `1px solid ${error ? '#e05050' : '#2a3050'}`,
              borderRadius: '10px',
              color: '#e0d8c8', fontSize: '16px',
              outline: 'none', fontFamily: 'inherit',
              letterSpacing: show ? 'normal' : '0.2em',
              transition: 'border-color 0.15s',
            }}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#4a5a70', fontSize: '16px', padding: '4px',
            }}
            tabIndex={-1}
          >
            {show ? '🙈' : '👁'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#e05050', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !pin.trim()}
          style={{
            marginTop: '16px', width: '100%',
            padding: '12px',
            background: pin.trim() ? 'linear-gradient(135deg, #c8a850, #e0c870)' : '#1a2035',
            border: 'none', borderRadius: '10px',
            color: pin.trim() ? '#0f1220' : '#3a4a60',
            fontSize: '15px', fontWeight: 600,
            cursor: pin.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
        >
          {loading ? '...' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
