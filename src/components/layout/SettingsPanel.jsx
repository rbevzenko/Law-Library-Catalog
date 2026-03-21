import React, { useState, useRef } from 'react'
import { Button } from '../ui/Button'
import { getDiskInfo } from '../../api/yandex'

function formatBytes(bytes) {
  if (!bytes) return '0 Б'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} ГБ`
  const mb = bytes / (1024 ** 2)
  return `${mb.toFixed(0)} МБ`
}

function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date instanceof Date ? date : new Date(date))
}

export function SettingsPanel({
  isOpen,
  onClose,
  yadiskToken,
  setYadiskToken,
  anthropicKey,
  setAnthropicKey,
  syncStatus,
  lastSyncedAt,
  forceSync,
  exportToJSON,
  exportToCSV,
  importFromJSON,
}) {
  const [tokenInput, setTokenInput] = useState(yadiskToken || '')
  const [keyInput, setKeyInput] = useState(anthropicKey || '')
  const [diskInfo, setDiskInfo] = useState(null)
  const [diskError, setDiskError] = useState('')
  const [checking, setChecking] = useState(false)
  const [importError, setImportError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const fileInputRef = useRef()

  const hasToken = !!yadiskToken

  async function handleCheckDisk() {
    setChecking(true)
    setDiskError('')
    setDiskInfo(null)
    try {
      const info = await getDiskInfo(tokenInput || yadiskToken)
      setDiskInfo(info)
    } catch (err) {
      setDiskError('Ошибка подключения: ' + err.message)
    } finally {
      setChecking(false)
    }
  }

  function handleSaveToken() {
    setYadiskToken(tokenInput.trim())
  }

  function handleSaveKey() {
    setAnthropicKey(keyInput.trim())
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPendingFile(file)
    setShowConfirm(true)
    e.target.value = ''
  }

  async function handleConfirmImport() {
    setShowConfirm(false)
    setImportError('')
    try {
      const text = await pendingFile.text()
      const data = JSON.parse(text)
      importFromJSON(data)
    } catch (err) {
      setImportError('Ошибка импорта: ' + err.message)
    }
    setPendingFile(null)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,14,30,0.6)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="slide-in-right"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 201,
          width: '420px',
          maxWidth: '100vw',
          background: '#151825',
          borderLeft: '1px solid #2a3050',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #2a3050',
          background: '#1a2035',
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 600,
            color: '#c8a850',
          }}>
            ⚙ Настройки
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#4a5a70',
              cursor: 'pointer', fontSize: '22px', padding: '4px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#e0d8c8'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a5a70'}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* Welcome */}
          {!hasToken && (
            <div style={{
              padding: '16px',
              background: 'rgba(200,168,80,0.08)',
              border: '1px solid rgba(200,168,80,0.25)',
              borderRadius: '10px',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#e0d8c8',
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#c8a850' }}>
                Добро пожаловать в Lex Bibliotheca!
              </p>
              <p style={{ margin: 0 }}>
                Введите токен Яндекс.Диска для начала работы. Каталог будет сохранён в облаке и доступен с любого устройства.
              </p>
            </div>
          )}

          {/* Yandex.Disk */}
          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'system-ui' }}>
              Яндекс.Диск
            </h3>

            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#8899bb', lineHeight: 1.6 }}>
              Для получения токена перейдите на{' '}
              <a href="https://oauth.yandex.ru" target="_blank" rel="noreferrer" style={{ color: '#c8a850' }}>
                oauth.yandex.ru
              </a>
              , создайте приложение с правами <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>cloud_api:disk.read</code> и{' '}
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>cloud_api:disk.write</code>, затем сгенерируйте токен.
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#8899bb' }}>OAuth токен</label>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="y0_AgAA..."
                style={{
                  width: '100%', padding: '10px 12px', background: '#1a2035',
                  border: '1px solid #2a3050', borderRadius: '8px', color: '#e0d8c8',
                  fontSize: '14px', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <Button variant="primary" size="sm" onClick={handleSaveToken}>
                Сохранить
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCheckDisk} disabled={checking || (!tokenInput && !yadiskToken)}>
                {checking ? '⏳ Проверка...' : '🔌 Проверить подключение'}
              </Button>
            </div>

            {diskInfo && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(58,122,80,0.12)',
                border: '1px solid rgba(58,122,80,0.3)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#3a7a50',
              }}>
                ✅ Подключено: <strong>{diskInfo.login}</strong><br />
                💾 {formatBytes(diskInfo.usedSpace)} / {formatBytes(diskInfo.totalSpace)}
              </div>
            )}
            {diskError && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(200,50,50,0.1)',
                border: '1px solid rgba(200,50,50,0.3)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#e05050',
              }}>
                {diskError}
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Button variant="secondary" size="sm" onClick={forceSync}>
                🔄 Синхронизировать сейчас
              </Button>
              <span style={{ fontSize: '12px', color: '#4a5a70' }}>
                {lastSyncedAt ? `Обновлено: ${formatDate(lastSyncedAt)}` : 'Ещё не синхронизировано'}
              </span>
            </div>
          </section>

          {/* Anthropic */}
          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'system-ui' }}>
              Anthropic API
            </h3>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#8899bb', lineHeight: 1.6 }}>
              Ключ используется для генерации аннотаций с помощью Claude. Получите на{' '}
              <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: '#c8a850' }}>
                console.anthropic.com
              </a>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#8899bb' }}>API ключ</label>
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                style={{
                  width: '100%', padding: '10px 12px', background: '#1a2035',
                  border: '1px solid #2a3050', borderRadius: '8px', color: '#e0d8c8',
                  fontSize: '14px', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box',
                }}
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleSaveKey}>
              Сохранить
            </Button>
          </section>

          {/* Export / Import */}
          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'system-ui' }}>
              Экспорт / Импорт
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={exportToJSON}>
                📥 Скачать резервную копию (JSON)
              </Button>
              {exportToCSV && (
                <Button variant="secondary" size="sm" onClick={exportToCSV}>
                  📊 Экспорт в CSV (Excel)
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                📤 Загрузить из файла (JSON)
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {importError && (
                <div style={{ color: '#e05050', fontSize: '13px' }}>{importError}</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,30,0.85)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#1a2035', border: '1px solid #2a3050',
            borderRadius: '12px', padding: '28px', maxWidth: '380px', width: '90%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontFamily: "'Cormorant Garamond', serif", color: '#e0d8c8' }}>
              Подтверждение
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#8899bb', fontSize: '14px', lineHeight: 1.6 }}>
              Это заменит все данные каталога данными из файла. Продолжить?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="danger" size="md" onClick={handleConfirmImport}>
                Заменить
              </Button>
              <Button variant="secondary" size="md" onClick={() => { setShowConfirm(false); setPendingFile(null) }}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
