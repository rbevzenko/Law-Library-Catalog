import React, { useState, useEffect } from 'react'
import { getPublicUrl } from '../../api/yandex'
import { Button } from '../ui/Button'

export function PDFViewer({ isOpen, onClose, yaPath, token }) {
  const [prefetching, setPrefetching] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
  const [error, setError] = useState('')

  // Pre-fetch the public URL as soon as viewer opens — must be ready before user tap
  // so we can open it synchronously (required by iOS popup rules)
  useEffect(() => {
    if (!isOpen || !token || !yaPath) return
    setError('')
    setPublicUrl('')
    setPrefetching(true)
    getPublicUrl(token, yaPath)
      .then(url => setPublicUrl(url))
      .catch(err => setError('Не удалось получить ссылку: ' + err.message))
      .finally(() => setPrefetching(false))
  }, [isOpen, yaPath, token])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  function handleOpen() {
    if (!publicUrl) return
    // Create <a> and click — works in iOS Safari, iOS PWA standalone, Android, desktop
    const a = document.createElement('a')
    a.href = publicUrl
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!isOpen) return null

  const fileName = yaPath ? yaPath.split('/').pop() : ''

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1100,
      background: 'rgba(10,14,30,0.95)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid #2a3050',
        background: '#151825',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: '13px',
          color: '#8899bb',
          fontFamily: 'JetBrains Mono, monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          marginRight: '16px',
        }}>
          📄 {yaPath}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕ Закрыть
        </Button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '40px',
      }}>
        <div style={{ fontSize: '64px', lineHeight: 1 }}>📄</div>

        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ color: '#ccd6f6', fontSize: '18px', fontWeight: 600, marginBottom: '8px', wordBreak: 'break-word' }}>
            {fileName}
          </div>
          <div style={{ color: '#5566aa', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
            {yaPath}
          </div>
        </div>

        {error && (
          <div style={{ color: '#e05050', fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
            ❌ {error}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={handleOpen}
          disabled={prefetching || !publicUrl}
        >
          {prefetching ? '⏳ Получаем ссылку...' : '🔗 Открыть PDF'}
        </Button>

        <div style={{ color: '#445577', fontSize: '12px', textAlign: 'center' }}>
          Файл откроется в просмотрщике Яндекс Диска
        </div>
      </div>
    </div>
  )
}

