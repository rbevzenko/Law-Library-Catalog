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

// mode='file' — select a PDF file (default)
// mode='folder' — select a folder
export function YaDiskBrowser({ token, onSelect, initialPath = 'disk:/', mode = 'file' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [path, setPath] = useState(initialPath)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPath(initialPath)
  }, [initialPath])

  const load = useCallback(async (p) => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const files = await fetchFiles(token, p)
      const sorted = [
        ...files.filter(f => f.type === 'dir').sort((a, b) => a.name.localeCompare(b.name)),
        ...(mode === 'file'
          ? files.filter(f => f.type === 'file' && f.name.toLowerCase().endsWith('.pdf'))
              .sort((a, b) => a.name.localeCompare(b.name))
          : []),
      ]
      setItems(sorted)
    } catch (err) {
      setError('Ошибка загрузки: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [token, mode])

  useEffect(() => {
    if (isOpen) load(path)
  }, [isOpen, path, load])

  function navigateTo(newPath) {
    setPath(newPath)
  }

  function buildBreadcrumbs() {
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

  function handleItemClick(item) {
    if (item.type === 'dir') {
      navigateTo(item.path)
    } else if (mode === 'file') {
      onSelect(item.path)
      setIsOpen(false)
    }
  }

  function handleSelectFolder() {
    onSelect(path)
    setIsOpen(false)
  }

  const buttonLabel = mode === 'folder'
    ? (isOpen ? 'Скрыть браузер папок' : '📁 Выбрать папку на Яндекс.Диске')
    : (isOpen ? 'Скрыть браузер Яндекс.Диска' : '📁 Выбрать файл на Яндекс.Диске')

  if (!token) {
    return (
      <div style={{ fontSize: '13px', color: '#4a5a70', padding: '8px 0' }}>
        Добавьте токен Яндекс.Диска в настройках, чтобы выбрать {mode === 'folder' ? 'папку' : 'файл'}.
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
        {buttonLabel}
      </Button>

      {isOpen && (
        <div style={{
          marginTop: '10px',
          border: '1px solid #2a3050',
          borderRadius: '10px',
          background: '#1a2035',
          overflow: 'hidden',
        }}>
          {/* Breadcrumbs + folder select button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            borderBottom: '1px solid #2a3050',
            gap: '4px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, overflowX: 'auto' }}>
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
            {mode === 'folder' && (
              <button
                onClick={handleSelectFolder}
                style={{
                  flexShrink: 0,
                  background: 'rgba(200,168,80,0.15)',
                  border: '1px solid rgba(200,168,80,0.4)',
                  color: '#c8a850',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'system-ui',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  marginLeft: '8px',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,168,80,0.25)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,168,80,0.15)' }}
              >
                ✓ Выбрать эту папку
              </button>
            )}
          </div>

          {/* File/folder list */}
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
                {mode === 'folder' ? 'Нет вложенных папок' : 'Папка пуста или нет PDF файлов'}
              </div>
            )}
            {!loading && items.map(item => (
              <div
                key={item.path}
                onClick={() => handleItemClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  cursor: item.type === 'dir' || mode === 'file' ? 'pointer' : 'default',
                  borderBottom: '1px solid #2a305040',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => { if (item.type === 'dir' || mode === 'file') e.currentTarget.style.background = 'rgba(200,168,80,0.06)' }}
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
