import React, { useState, useRef } from 'react'
import { Button } from '../ui/Button'
import { getDiskInfo, fetchAllPDFs } from '../../api/yandex'
import { parseTitlesInBatches, classifyBooksInBatches, estimateYearsInBatches } from '../../api/anthropic'
import { YaDiskBrowser } from '../yadisk/YaDiskBrowser'
import { CSVImportModal } from '../books/CSVImportModal'

function formatBytes(bytes) {
  if (!bytes) return '0 Б'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} ГБ`
  const mb = bytes / (1024 ** 2)
  return `${mb.toFixed(0)} МБ`
}

// Convert any Yandex Disk URL or path variant to API-compatible disk:/ path
function normalizeYaDiskPath(input) {
  const s = input.trim()
  // Full web URL: https://disk.yandex.ru/client/disk/SomeName
  const webMatch = s.match(/^https?:\/\/disk\.yandex\.ru\/client\/disk\/(.*)$/)
  if (webMatch) {
    return 'disk:/' + decodeURIComponent(webMatch[1])
  }
  // Already has disk:/ prefix
  if (s.startsWith('disk:/')) return s
  // Plain path without prefix
  if (s.startsWith('/')) return 'disk:' + s
  return s
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
  githubToken,
  setGithubToken,
  anthropicKey,
  setAnthropicKey,
  booksFolder,
  setBooksFolder,
  books,
  bulkAddBooks,
  importPaperBooks,
  bulkUpdateBooks,
  fixYearsFromRegex,
  fixCorruptedTitles,
  removeDuplicates,
  clearAllBooks,
  syncStatus,
  lastSyncedAt,
  forceSync,
  exportToJSON,
  exportToCSV,
  importFromJSON,
}) {
  const [ops, setOps] = useState({
    parse:    { progress: null, result: null, error: '' },
    classify: { progress: null, result: null, error: '' },
    yearAI:   { progress: null, result: null, error: '' },
  })
  const [yearRegexResult, setYearRegexResult] = useState(null)
  const [dedupResult, setDedupResult] = useState(null)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState(yadiskToken || '')
  const [githubTokenInput, setGithubTokenInput] = useState(githubToken || '')
  const [clientIdInput, setClientIdInput] = useState(() => localStorage.getItem('lex_ya_client_id') || '')
  const [keyInput, setKeyInput] = useState(anthropicKey || '')
  const [folderInput, setFolderInput] = useState(booksFolder || '')
  const [diskInfo, setDiskInfo] = useState(null)
  const [diskError, setDiskError] = useState('')
  const [checking, setChecking] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null) // { pdfs: [], importedCount: null }
  const [scanError, setScanError] = useState('')
  const [importError, setImportError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
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

  function handleSaveGithubToken() {
    setGithubToken(githubTokenInput.trim())
  }

  function handleOAuthLogin() {
    const id = clientIdInput.trim()
    if (!id) return
    localStorage.setItem('lex_ya_client_id', id)
    const redirectUri = 'https://oauth.yandex.ru/verification_code'
    const url = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(redirectUri)}`
    window.open(url, '_blank', 'width=600,height=700')
  }

  function handleSaveKey() {
    setAnthropicKey(keyInput.trim())
  }

  function handleSaveFolder() {
    const val = normalizeYaDiskPath(folderInput.trim())
    if (!val || val === 'disk:/') {
      setScanError('Укажите конкретную папку (например: disk:/Мои книги)')
      return
    }
    setFolderInput(val)
    setBooksFolder(val)
    setScanResult(null)
    setScanError('')
  }

  async function handleScanFolder() {
    const folder = normalizeYaDiskPath(folderInput.trim() || booksFolder || '')
    if (!yadiskToken) return
    if (!folder || folder === 'disk:/') {
      setScanError('Укажите конкретную папку для сканирования (например: disk:/Мои книги)')
      return
    }
    setScanning(true)
    setScanError('')
    setScanResult(null)
    try {
      const pdfs = await fetchAllPDFs(yadiskToken, folder)
      setScanResult({ pdfs, importedCount: null })
    } catch (err) {
      setScanError('Ошибка сканирования: ' + err.message)
    } finally {
      setScanning(false)
    }
  }

  async function handleImportFromFolder() {
    if (!scanResult?.pdfs?.length) return
    const count = await bulkAddBooks(scanResult.pdfs)
    setScanResult(prev => ({ ...prev, importedCount: count }))
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

  const currentYear = new Date().getFullYear()
  const allBooks = books || []
  const corruptedCount  = allBooks.filter(b => b.title?.startsWith('|')).length
  const unparsedCount   = allBooks.filter(b => !b.author || b.author.trim() === '').length
  const unclassified    = allBooks.filter(b => !b.topics || b.topics.length === 0).length
  const unknownYear     = allBooks.filter(b => !b.year || b.year >= currentYear).length

  function handleFixCorrupted() {
    const fixed = fixCorruptedTitles()
    setOp('parse', { result: { count: fixed, fixMsg: true }, error: '' })
  }

  function handleYearRegex() {
    const fixed = fixYearsFromRegex()
    setYearRegexResult(fixed)
  }

  function setOp(key, patch) {
    setOps(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function runOp(key, batchFn, batchSize) {
    if (!anthropicKey) return
    setOp(key, { error: '', result: null, progress: { done: 0, total: 0 } })
    try {
      const updates = await batchFn(
        allBooks,
        anthropicKey,
        (done, total) => setOp(key, { progress: { done, total } })
      )
      bulkUpdateBooks(updates)
      setOp(key, { result: { count: updates.length } })
    } catch (err) {
      setOp(key, { error: 'Ошибка: ' + err.message })
    } finally {
      setOp(key, { progress: null })
    }
  }

  const anyRunning = Object.values(ops).some(o => o.progress !== null)

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

          {/* GitHub Gist sync */}
          <section>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'system-ui' }}>
              Синхронизация (GitHub Gist)
            </h3>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: '#8899bb', lineHeight: 1.7 }}>
              Каталог хранится в приватном GitHub Gist — синхронизируется между устройствами.<br />
              Создайте токен на{' '}
              <a href="https://github.com/settings/tokens/new?scopes=gist&description=Lex+Bibliotheca" target="_blank" rel="noreferrer" style={{ color: '#c8a850' }}>
                github.com/settings/tokens
              </a>
              {' '}(нужны права: <code style={{ fontFamily: 'monospace', color: '#e0d8c8' }}>gist</code>).
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#8899bb' }}>
                GitHub Personal Access Token
              </label>
              <input
                type="password"
                value={githubTokenInput}
                onChange={e => setGithubTokenInput(e.target.value)}
                placeholder="ghp_..."
                style={{
                  width: '100%', padding: '10px 12px', background: '#1a2035',
                  border: `1px solid ${githubToken ? 'rgba(58,122,80,0.5)' : '#2a3050'}`,
                  borderRadius: '8px', color: '#e0d8c8',
                  fontSize: '14px', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="primary" size="sm" onClick={handleSaveGithubToken}>
                Сохранить
              </Button>
              {githubToken && (
                <Button variant="secondary" size="sm" onClick={forceSync}>
                  🔄 Синхронизировать сейчас
                </Button>
              )}
              <span style={{ fontSize: '12px', color: githubToken ? '#3a7a50' : '#4a5a70' }}>
                {githubToken
                  ? (lastSyncedAt ? `✅ Обновлено: ${formatDate(lastSyncedAt)}` : '✅ Токен сохранён')
                  : 'Токен не задан — только localStorage'}
              </span>
            </div>
            {syncStatus === 'error' && (
              <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(200,50,50,0.1)', border: '1px solid rgba(200,50,50,0.3)', borderRadius: '8px', fontSize: '13px', color: '#e05050' }}>
                Ошибка синхронизации. Проверьте токен и повторите попытку.
              </div>
            )}
          </section>

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
                Добро пожаловать в Law Library!
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

            {/* OAuth button */}
            <div style={{
              padding: '16px',
              background: 'rgba(200,168,80,0.06)',
              border: '1px solid rgba(200,168,80,0.2)',
              borderRadius: '10px',
              marginBottom: '16px',
            }}>
              <div style={{ fontSize: '13px', color: '#c8a850', fontWeight: 600, marginBottom: '10px' }}>
                Войти через Яндекс (рекомендуется)
              </div>
              <div style={{ fontSize: '12px', color: '#8899bb', lineHeight: 1.6, marginBottom: '10px' }}>
                Введите Client ID приложения с{' '}
                <a href="https://oauth.yandex.ru" target="_blank" rel="noreferrer" style={{ color: '#c8a850' }}>
                  oauth.yandex.ru
                </a>
                {' '}(права: <code style={{ fontFamily: 'monospace' }}>cloud_api:disk.read</code>, <code style={{ fontFamily: 'monospace' }}>cloud_api:disk.write</code>).
                Нажмите "Войти →" — откроется окно Яндекса, разрешите доступ. После этого Яндекс покажет токен — скопируйте его и вставьте в поле ниже.
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <input
                    value={clientIdInput}
                    onChange={e => setClientIdInput(e.target.value)}
                    placeholder="Client ID (напр. a1b2c3d4e5f6...)"
                    style={{
                      width: '100%', padding: '8px 10px', background: '#1a2035',
                      border: '1px solid #2a3050', borderRadius: '6px', color: '#e0d8c8',
                      fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  onClick={handleOAuthLogin}
                  disabled={!clientIdInput.trim()}
                  style={{
                    padding: '8px 14px', background: clientIdInput.trim() ? '#c8a850' : '#2a3050',
                    border: 'none', borderRadius: '6px', color: clientIdInput.trim() ? '#0f1220' : '#4a5a70',
                    cursor: clientIdInput.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  Войти →
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#8899bb' }}>
                Или вставьте токен вручную
              </label>
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

          </section>

          {/* Books Folder */}
          {yadiskToken && (
            <section>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'system-ui' }}>
                Папка с книгами
              </h3>
              <div style={{ marginBottom: '12px', fontSize: '13px', color: '#8899bb', lineHeight: 1.6 }}>
                Укажите папку на Яндекс.Диске, где хранятся ваши PDF файлы. Можно просканировать её и автоматически добавить все книги в каталог.
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#8899bb' }}>Путь к папке</label>
                <input
                  value={folderInput}
                  onChange={e => setFolderInput(e.target.value)}
                  placeholder="disk:/Мои книги"
                  style={{
                    width: '100%', padding: '10px 12px', background: '#1a2035',
                    border: '1px solid #2a3050', borderRadius: '8px', color: '#e0d8c8',
                    fontSize: '14px', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box',
                  }}
                />
              </div>

              <YaDiskBrowser
                token={yadiskToken}
                mode="folder"
                initialPath={booksFolder}
                onSelect={path => { setFolderInput(path) }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <Button variant="primary" size="sm" onClick={handleSaveFolder}>
                  Сохранить папку
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleScanFolder}
                  disabled={scanning || !yadiskToken}
                >
                  {scanning ? '⏳ Сканирование...' : '🔍 Сканировать папку'}
                </Button>
              </div>

              {scanError && (
                <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(200,50,50,0.1)', border: '1px solid rgba(200,50,50,0.3)', borderRadius: '8px', fontSize: '13px', color: '#e05050' }}>
                  {scanError}
                </div>
              )}

              {scanResult && (
                <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(58,122,80,0.08)', border: '1px solid rgba(58,122,80,0.25)', borderRadius: '8px' }}>
                  {scanResult.importedCount !== null ? (
                    <div style={{ fontSize: '13px', color: '#3a7a50', fontWeight: 600 }}>
                      ✅ Добавлено {scanResult.importedCount} из {scanResult.pdfs.length} книг (уже существующие пропущены)
                    </div>
                  ) : scanResult.pdfs.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#8899bb' }}>
                      В папке не найдено PDF файлов
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '13px', color: '#e0d8c8', marginBottom: '10px' }}>
                        Найдено <strong style={{ color: '#c8a850' }}>{scanResult.pdfs.length}</strong> PDF файлов:
                      </div>
                      <div style={{ maxHeight: '140px', overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {scanResult.pdfs.map(pdf => (
                          <div key={pdf.path} style={{ fontSize: '12px', color: '#7aaad0', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📄 {pdf.name}
                          </div>
                        ))}
                      </div>
                      <Button variant="primary" size="sm" onClick={handleImportFromFolder}>
                        ⬇ Импортировать {scanResult.pdfs.length} книг в каталог
                      </Button>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Batch AI Processing */}
          <section>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#8899bb', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'system-ui' }}>
              Обработка каталога (AI)
            </h3>
            <div style={{ marginBottom: '16px', fontSize: '12px', color: '#4a5a70', lineHeight: 1.5 }}>
              Пропускает книги с уже заполненными полями. Требует ключ Anthropic API.
            </div>

            {corruptedCount > 0 && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'rgba(200,80,50,0.08)', border: '1px solid rgba(200,80,50,0.3)', borderRadius: '8px', fontSize: '12px', color: '#e07050', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span>⚠ {corruptedCount} названий повреждены (начинаются с |)</span>
                <Button variant="secondary" size="sm" onClick={handleFixCorrupted}>
                  Исправить
                </Button>
              </div>
            )}

            {/* Year from filename (regex, no API) */}
            <div style={{ padding: '12px 14px', background: '#1a2035', borderRadius: '8px', border: '1px solid #2a3050', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#ccd6f6', fontWeight: 500 }}>Год из названия файла</div>
                  <div style={{ fontSize: '11px', color: '#4a5a70', marginTop: '2px' }}>Regex по тексту — мгновенно, без API</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ fontSize: '12px', color: unknownYear > 0 ? '#c8a850' : '#3a7a50' }}>
                    {unknownYear > 0 ? `${unknownYear} кн.` : '✓ готово'}
                  </span>
                  <Button variant="secondary" size="sm" onClick={handleYearRegex} disabled={anyRunning || unknownYear === 0}>
                    ▶
                  </Button>
                </div>
              </div>
              {yearRegexResult !== null && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: yearRegexResult > 0 ? '#3a7a50' : '#8899bb' }}>
                  {yearRegexResult > 0 ? `✅ Найдено и обновлено: ${yearRegexResult}` : 'Год в названиях не найден'}
                </div>
              )}
            </div>

            {!anthropicKey && (
              <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(200,168,80,0.06)', border: '1px solid rgba(200,168,80,0.2)', borderRadius: '8px', fontSize: '12px', color: '#c8a850' }}>
                Укажите ключ Anthropic API в разделе ниже
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  key: 'parse',
                  label: 'Разобрать названия',
                  hint: 'Фамилия, Название → отдельные поля',
                  count: unparsedCount,
                  batchSize: 80,
                  fn: parseTitlesInBatches,
                },
                {
                  key: 'classify',
                  label: 'Классифицировать',
                  hint: 'Правовые системы и темы',
                  count: unclassified,
                  batchSize: 30,
                  fn: classifyBooksInBatches,
                },
                {
                  key: 'yearAI',
                  label: 'Уточнить год (AI)',
                  hint: 'Для книг без года в названии файла',
                  count: unknownYear,
                  batchSize: 40,
                  fn: estimateYearsInBatches,
                },
              ].map(({ key, label, hint, count, batchSize, fn }) => {
                const op = ops[key]
                const pct = op.progress?.total > 0
                  ? Math.round((op.progress.done / op.progress.total) * 100) : 0
                return (
                  <div key={key} style={{ padding: '12px 14px', background: '#1a2035', borderRadius: '8px', border: '1px solid #2a3050' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: op.progress ? '8px' : '0' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#ccd6f6', fontWeight: 500 }}>{label}</div>
                        <div style={{ fontSize: '11px', color: '#4a5a70', marginTop: '2px' }}>{hint}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', color: count > 0 ? '#c8a850' : '#3a7a50' }}>
                          {count > 0 ? `${count} кн. · ≈${Math.ceil(count / batchSize)} зап.` : '✓ готово'}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => runOp(key, fn, batchSize)}
                          disabled={anyRunning || count === 0 || !anthropicKey}
                        >
                          {op.progress ? '⏳' : '▶'}
                        </Button>
                      </div>
                    </div>

                    {op.progress && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8899bb', marginBottom: '4px' }}>
                          <span>{op.progress.done} / {op.progress.total}</span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ background: '#0f1220', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #c8a850, #e0c870)', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )}

                    {op.result && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#3a7a50' }}>
                        ✅ Обработано: {op.result.count}
                      </div>
                    )}
                    {op.error && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#e05050' }}>
                        {op.error}
                      </div>
                    )}
                  </div>
                )
              })}
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
              <Button variant="secondary" size="sm" onClick={() => setCsvModalOpen(true)}>
                📋 Импорт бумажных книг из CSV
              </Button>
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
              <Button variant="secondary" size="sm" onClick={() => {
                const removed = removeDuplicates()
                setDedupResult(removed)
              }}>
                🔍 Исключить дублирование
              </Button>
              {dedupResult !== null && (
                <div style={{ fontSize: '13px', color: dedupResult > 0 ? '#c8a850' : '#4a7a50' }}>
                  {dedupResult > 0
                    ? `Удалено ${dedupResult} дубл${dedupResult === 1 ? 'икат' : dedupResult < 5 ? 'иката' : 'икатов'}`
                    : 'Дубликаты не найдены'}
                </div>
              )}
              <Button variant="danger" size="sm" onClick={() => setShowClearConfirm(true)}>
                🗑 Очистить весь каталог
              </Button>
            </div>
          </section>
        </div>
      </div>

      {/* Clear catalog confirm dialog */}
      {showClearConfirm && (
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
              Очистить каталог?
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#8899bb', fontSize: '14px', lineHeight: 1.6 }}>
              Все книги будут удалены безвозвратно. Рекомендуется сначала сделать резервную копию (JSON).
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="danger" size="md" onClick={() => { clearAllBooks(); setShowClearConfirm(false) }}>
                Удалить всё
              </Button>
              <Button variant="secondary" size="md" onClick={() => setShowClearConfirm(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

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

      <CSVImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={importPaperBooks}
      />
    </>
  )
}
