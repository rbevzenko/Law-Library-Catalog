import React, { useState, useEffect, useCallback } from 'react'
import { fetchFiles } from '../../api/yandex'
import { Button } from '../ui/Button'

function formatBytes(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 ** 2)
  if (mb >= 1) return `${mb.toFixed(1)} МБ`
  return `${(bytes / 1024).toFixed(0)} КБ`
}

function formatDate(str) {
  if (!str) return ''
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(str))
}

export function YaDiskBrowser({ token, onSelect, initialPath = 'disk:/' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [path, setPath] = useState(initialPath)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (p) => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const files = await fetchFiles(token, p)
      // Show folders first, then PDFs only
      const sorted = [
        ...files.filter(f => f.type === 'dir').sort((a, b) => a.name.localeCompare(b.name)),
        ...files.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.pdf'))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ]
      setItems(sorted)
    } catch (err) {
      setError('Ошибка загрузки: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isOpen) load(path)
  }, [isOpen, path, load])

  function navigateTo(newPath) {
    setPath(newPath)
  }

  function buildBreadcrumbs() {
    // path like "disk:/Lex Bibliotheca/folder"
    const parts = path.replace('disk:/', '').split('/').filter(Boolean)
    const crumbs = [{ label: '/', path: 'disk:/' }]
    let cur = 'disk:/'
    for (const p of parts) {
      cur = cur === 'disk:/' ? `disk:/${p}` : `${cur}/${p}`
      crumbs.push({ label: p, path: cur })
    }
    return crumbs
  }

  const crumbs = buildBreadcrumbs()

  function handleSelect(item) {
    if (item.type === 'dir') {
      navigateTo(item.path)
    } else {
      onSelect(item.path)
      setIsOpen(false)
    }
  }

  if (!token) {
    return (
      <div style={{ fontSize: '13px', color: '#4a5a70', padding: '8px 0' }}>
        Добавьте токен Яндекс.Диска в настройках, чтобы выбрать файл.
      </div>
    )
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(o => !o)}
      >
        📁 {isOpen ? 'Скрыть браузер Яндекс.Диска' : 'Выбрать файл на Яндекс.Диске'}
      </Button>

      {isOpen && (
        <div style={{
          marginTop: '10px',
          border: '1px solid #2a3050',
          borderRadius: '10px',
          background: '#1a2035',
          overflow: 'hidden',
        }}>
          {/* Breadcrumbs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '10px 14px',
            borderBottom: '1px solid #2a3050',
            overflowX: 'auto',
            flexWrap: 'nowrap',
          }}>
            {crumbs.map((c, i) => (
              <React.Fragment key={c.path}>
                {i > 0 && <span style={{ color: '#4a5a70', fontSize: '12px' }}>/</span>}
                <button
                  onClick={() => navigateTo(c.path)}
                  style={{
                    background: 'none', border: 'none',
                    color: i === crumbs.length - 1 ? '#e0d8c8' : '#8899bb',
                    cursor: 'pointer', fontSize: '13px',
                    fontFamily: 'JetBrains Mono, monospace',
                    padding: '2px 4px', borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#c8a850'}
                  onMouseLeave={e => e.currentTarget.style.color = i === crumbs.length - 1 ? '#e0d8c8' : '#8899bb'}
                >
                  {c.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* File list */}
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#4a5a70', fontSize: '13px' }}>
                ⏳ Загрузка...
              </div>
            )}
            {error && (
              <div style={{ padding: '16px', color: '#e05050', fontSize: '13px' }}>{error}</div>
            )}
            {!loading && !error && items.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#4a5a70', fontSize: '13px' }}>
                Папка пуста или нет PDF файлов
              </div>
            )}
            {!loading && items.map(item => (
              <div
                key={item.path}
                onClick={() => handleSelect(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #2a305040',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,168,80,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: '16px', flexShrink: 0 }}>
                  {item.type === 'dir' ? '📁' : '📄'}
                </span>
                <span style={{
                  flex: 1,
                  fontSize: '13px',
                  color: item.type === 'dir' ? '#e0d8c8' : '#7aaad0',
                  fontFamily: item.type === 'file' ? 'JetBrains Mono, monospace' : undefined,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.name}
                </span>
                <span style={{ fontSize: '11px', color: '#4a5a70', flexShrink: 0 }}>
                  {item.type === 'file' ? formatBytes(item.size) : ''}
                </span>
                <span style={{ fontSize: '11px', color: '#4a5a70', flexShrink: 0 }}>
                  {formatDate(item.modified)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
