import React from 'react'
import { Button } from '../ui/Button'

function SyncIndicator({ syncStatus, lastSyncedAt }) {
  if (syncStatus === 'idle') return null

  const configs = {
    syncing: { icon: '🔄', text: 'Синхронизация...', color: '#8899bb', pulse: true },
    success: { icon: '✅', text: 'Сохранено', color: '#3a7a50', pulse: false },
    error: { icon: '❌', text: 'Ошибка синхронизации', color: '#e05050', pulse: false },
  }
  const c = configs[syncStatus]
  if (!c) return null

  return (
    <div
      className={c.pulse ? 'pulse' : ''}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        color: c.color,
        padding: '4px 12px',
        background: `${c.color}18`,
        borderRadius: '20px',
        border: `1px solid ${c.color}30`,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s ease',
      }}
    >
      <span>{c.icon}</span>
      <span>{c.text}</span>
    </div>
  )
}

export function TopBar({
  searchQuery,
  onSearchChange,
  syncStatus,
  lastSyncedAt,
  onOpenSettings,
  onAddBook,
  view,
  onViewChange,
}) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(15,18,32,0.97)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #2a3050',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      height: '60px',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '22px' }}>⚖</span>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: '20px',
          fontWeight: 700,
          color: '#c8a850',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}>
          Law Library
        </span>
      </div>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: '480px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Поиск по названию, автору, описанию, тегам..."
          style={{
            width: '100%',
            padding: '8px 14px',
            background: '#1a2035',
            border: '1px solid #2a3050',
            borderRadius: '8px',
            color: '#e0d8c8',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* View toggles */}
      <div style={{
        display: 'flex',
        gap: '2px',
        background: '#1a2035',
        border: '1px solid #2a3050',
        borderRadius: '8px',
        padding: '3px',
        flexShrink: 0,
      }}>
        {[
          { id: 'grid', icon: '⊞', title: 'Сетка' },
          { id: 'table', icon: '☰', title: 'Таблица' },
          { id: 'stats', icon: '📊', title: 'Статистика' },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            title={v.title}
            style={{
              background: view === v.id ? '#c8a850' : 'transparent',
              border: 'none',
              color: view === v.id ? '#0f1220' : '#8899bb',
              cursor: 'pointer',
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: view === v.id ? '600' : '400',
              transition: 'all 0.15s ease',
            }}
          >
            {v.icon}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', flexShrink: 0 }}>
        <SyncIndicator syncStatus={syncStatus} lastSyncedAt={lastSyncedAt} />
        <Button variant="primary" size="sm" onClick={onAddBook}>
          + Добавить книгу
        </Button>
        <button
          onClick={onOpenSettings}
          title="Настройки"
          style={{
            background: 'none',
            border: '1px solid #2a3050',
            borderRadius: '8px',
            color: '#8899bb',
            cursor: 'pointer',
            padding: '7px 10px',
            fontSize: '16px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8a850'; e.currentTarget.style.color = '#c8a850' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a3050'; e.currentTarget.style.color = '#8899bb' }}
        >
          ⚙
        </button>
      </div>
    </header>
  )
}
