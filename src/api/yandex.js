const BASE_URL = 'https://cloud-api.yandex.net'

function authHeaders(token) {
  return {
    Authorization: `OAuth ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function checkFileExists(token, path) {
  const res = await fetch(
    `${BASE_URL}/v1/disk/resources?path=${encodeURIComponent(path)}`,
    { headers: authHeaders(token) }
  )
  if (res.status === 401) throw new Error('Токен недействителен (401). Проверьте OAuth-токен.')
  if (res.status === 403) throw new Error('Нет доступа (403). Проверьте разрешения приложения.')
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`Ошибка Яндекс.Диска: ${res.status}`)
  return true
}

export async function downloadCatalog(token) {
  const path = 'disk:/Lex Bibliotheca/catalog.json'
  // Get download URL
  const res = await fetch(
    `${BASE_URL}/v1/disk/resources/download?path=${encodeURIComponent(path)}`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) {
    throw new Error(`Failed to get download URL: ${res.status}`)
  }
  const { href } = await res.json()
  // Fetch the actual file
  const fileRes = await fetch(href)
  if (!fileRes.ok) {
    throw new Error(`Failed to download catalog: ${fileRes.status}`)
  }
  const data = await fileRes.json()
  return data
}

export async function uploadCatalog(token, books) {
  const path = 'disk:/Lex Bibliotheca/catalog.json'
  // Step 1: Get upload URL from Yandex REST API
  let href
  try {
    const res = await fetch(
      `${BASE_URL}/v1/disk/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`,
      { headers: authHeaders(token) }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    href = json.href
  } catch (e) {
    throw new Error('Ошибка получения URL загрузки: ' + e.message)
  }
  // Step 2: PUT data to storage URL
  try {
    const uploadRes = await fetch(href, {
      method: 'PUT',
      body: JSON.stringify(books),
    })
    if (!uploadRes.ok) throw new Error(`HTTP ${uploadRes.status}`)
  } catch (e) {
    throw new Error('Ошибка загрузки на сервер Яндекса: ' + e.message)
  }
  return true
}

export async function createFolder(token, path) {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/disk/resources?path=${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: authHeaders(token),
      }
    )
    // 201 = created, 409 = already exists (both acceptable)
    if (!res.ok && res.status !== 409) {
      throw new Error(`HTTP ${res.status}`)
    }
  } catch (e) {
    if (e.message.includes('409')) return true
    throw new Error('Ошибка создания папки: ' + e.message)
  }
  return true
}

export async function getDownloadUrl(token, path) {
  const res = await fetch(
    `${BASE_URL}/v1/disk/resources/download?path=${encodeURIComponent(path)}`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) {
    throw new Error(`Failed to get download URL: ${res.status}`)
  }
  const { href } = await res.json()
  return href
}

export async function fetchFiles(token, path) {
  const res = await fetch(
    `${BASE_URL}/v1/disk/resources?path=${encodeURIComponent(path)}&limit=100`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) {
    throw new Error(`Failed to list files: ${res.status}`)
  }
  const data = await res.json()
  const items = data._embedded?.items || []
  return items.map((item) => ({
    name: item.name,
    type: item.type,
    size: item.size || 0,
    modified: item.modified,
    path: item.path,
  }))
}

async function fetchAllPDFsRecursive(token, folderPath, results) {
  const res = await fetch(
    `${BASE_URL}/v1/disk/resources?path=${encodeURIComponent(folderPath)}&limit=500&sort=name`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) {
    throw new Error(`Failed to list folder: ${res.status}`)
  }
  const data = await res.json()
  const items = data._embedded?.items || []
  const subfolders = []
  for (const item of items) {
    if (item.type === 'file' && item.name.toLowerCase().endsWith('.pdf')) {
      results.push({ name: item.name, path: item.path, size: item.size || 0 })
    } else if (item.type === 'dir') {
      subfolders.push(item.path)
    }
  }
  await Promise.all(subfolders.map(p => fetchAllPDFsRecursive(token, p, results)))
}

export async function fetchAllPDFs(token, folderPath) {
  const results = []
  await fetchAllPDFsRecursive(token, folderPath, results)
  return results
}

export async function getDiskInfo(token) {
  const res = await fetch(`${BASE_URL}/v1/disk/`, {
    headers: authHeaders(token),
  })
  if (!res.ok) {
    throw new Error(`Failed to get disk info: ${res.status}`)
  }
  const data = await res.json()
  return {
    login: data.user?.login || '',
    usedSpace: data.used_space || 0,
    totalSpace: data.total_space || 0,
  }
}
