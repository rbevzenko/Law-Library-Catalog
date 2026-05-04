const GITHUB_API = 'https://api.github.com'
const GIST_DESCRIPTION = 'Lex Bibliotheca Catalog'
const GIST_FILENAME = 'catalog.json'

function gistHeaders(token) {
  // HTTP headers only allow ISO-8859-1; GitHub tokens are pure ASCII
  if (!/^[\x20-\x7E]+$/.test(token)) {
    throw new Error('Токен содержит недопустимые символы. Скопируйте токен заново (ghp_...).')
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
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

  // Fetch full gist via API to get file content — avoids gist.githubusercontent.com
  const res = await fetch(`${GITHUB_API}/gists/${gist.id}`, { headers: gistHeaders(token) })
  if (!res.ok) throw new Error(`GitHub API ошибка: ${res.status}`)
  const fullGist = await res.json()

  const file = fullGist.files[GIST_FILENAME]
  if (!file?.content) return null
  if (file.truncated) throw new Error('Каталог слишком большой для GitHub Gist API (>1 МБ).')
  return JSON.parse(file.content)
}

export async function uploadCatalogToGist(token, books) {
  const content = JSON.stringify(books, null, 2)
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
