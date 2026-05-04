const GITHUB_API = 'https://api.github.com'
const GIST_DESCRIPTION = 'Lex Bibliotheca Catalog'
const GIST_FILENAME = 'catalog.json'

function gistHeaders(token) {
  if (!/^[\x20-\x7E]+$/.test(token)) {
    throw new Error('Токен содержит недопустимые символы. Скопируйте токен заново (ghp_...).')
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function compress(text) {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(new TextEncoder().encode(text))
  writer.close()
  const chunks = []
  const reader = cs.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const bytes = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0))
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function decompress(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()
  const chunks = []
  const reader = ds.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0))
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(out)
}

async function findCatalogGist(token) {
  const res = await fetch(`${GITHUB_API}/gists`, { headers: gistHeaders(token) })
  if (res.status === 401) throw new Error('Токен GitHub недействителен (401). Проверьте токен.')
  if (!res.ok) throw new Error(`GitHub API ошибка: ${res.status}`)
  const gists = await res.json()
  return gists.find(g => g.description === GIST_DESCRIPTION) || null
}

export async function downloadCatalogFromGist(token) {
  const gist = await findCatalogGist(token)
  if (!gist) return null

  const res = await fetch(`${GITHUB_API}/gists/${gist.id}`, { headers: gistHeaders(token) })
  if (!res.ok) throw new Error(`GitHub API ошибка: ${res.status}`)
  const fullGist = await res.json()

  const file = fullGist.files[GIST_FILENAME]
  if (!file?.content) return null

  // File truncated (>1 MB old format) — treat as empty so local data gets re-uploaded compressed
  if (file.truncated) return null

  // Try gzip+base64 (new format), fall back to plain JSON (old format)
  try {
    const text = await decompress(file.content)
    return JSON.parse(text)
  } catch {
    return JSON.parse(file.content)
  }
}

export async function uploadCatalogToGist(token, books) {
  const content = await compress(JSON.stringify(books))
  const gist = await findCatalogGist(token)
  const payload = {
    description: GIST_DESCRIPTION,
    public: false,
    files: { [GIST_FILENAME]: { content } },
  }
  if (gist) {
    const res = await fetch(`${GITHUB_API}/gists/${gist.id}`, {
      method: 'PATCH',
      headers: { ...gistHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Ошибка обновления gist: ${res.status}`)
  } else {
    const res = await fetch(`${GITHUB_API}/gists`, {
      method: 'POST',
      headers: { ...gistHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Ошибка создания gist: ${res.status}`)
  }
}
