import React, { useState, useEffect } from 'react'
import { getDownloadUrl } from '../../api/yandex'
import { Button } from '../ui/Button'

export function PDFViewer({ isOpen, onClose, yaPath, token }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !yaPath || !token) return
    setLoading(true)
    setError('')
    setUrl('')
    getDownloadUrl(token, yaPath)
      .then(href => setUrl(href))
      .catch(err => setError('Не удалось получить ссылку: ' + err.message))
      .finally(() => setLoading(false))
  }, [isOpen, yaPath, token])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

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
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {url && (
            <Button variant="secondary" size="sm" onClick={() => window.open(url, '_blank')}>
              🔗 Открыть в браузере
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕ Закрыть
          </Button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {loading && (
          <div style={{ color: '#8899bb', fontSize: '16px' }}>⏳ Загрузка PDF...</div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ color: '#e05050', marginBottom: '16px', fontSize: '15px' }}>❌ {error}</div>
            <Button variant="secondary" size="md" onClick={onClose}>Закрыть</Button>
          </div>
        )}
        {url && !loading && (
          <iframe
            src={url}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="PDF Viewer"
          />
        )}
      </div>
    </div>
  )
}
