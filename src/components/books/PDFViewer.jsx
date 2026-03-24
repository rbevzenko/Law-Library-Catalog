import React, { useState, useEffect } from 'react'
import { getDownloadUrl } from '../../api/yandex'
import { Button } from '../ui/Button'

export function PDFViewer({ isOpen, onClose, yaPath, token }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setLoading(false)
  }, [isOpen, yaPath])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  async function handleOpen() {
    if (!token || !yaPath) return
    setLoading(true)
    setError('')
    // Open window immediately on user gesture to bypass popup blocker
    const win = window.open('', '_blank')
    if (!win) {
      setError('Браузер заблокировал всплывающее окно. Разрешите всплывающие окна для этого сайта.')
      setLoading(false)
      return
    }
    try {
      const href = await getDownloadUrl(token, yaPath)
      // Fetch file content as blob (same pattern as downloadCatalog)
      const response = await fetch(href)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      win.location.href = objectUrl
    } catch (err) {
      win.close()
      setError('Не удалось открыть PDF: ' + err.message)
    } finally {
      setLoading(false)
    }
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
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕ Закрыть
          </Button>
        </div>
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
        <div style={{
          fontSize: '64px',
          lineHeight: 1,
        }}>📄</div>

        <div style={{
          textAlign: 'center',
          maxWidth: '480px',
        }}>
          <div style={{
            color: '#ccd6f6',
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '8px',
            wordBreak: 'break-word',
          }}>
            {fileName}
          </div>
          <div style={{
            color: '#5566aa',
            fontSize: '13px',
            fontFamily: 'JetBrains Mono, monospace',
            wordBreak: 'break-all',
          }}>
            {yaPath}
          </div>
        </div>

        {error && (
          <div style={{
            color: '#e05050',
            fontSize: '14px',
            textAlign: 'center',
            maxWidth: '400px',
          }}>
            ❌ {error}
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={handleOpen}
          disabled={loading}
        >
          {loading ? '⏳ Получение ссылки...' : '🔗 Открыть PDF'}
        </Button>

        <div style={{ color: '#445577', fontSize: '12px', textAlign: 'center' }}>
          Файл откроется в новой вкладке браузера
        </div>
      </div>
    </div>
  )
}
