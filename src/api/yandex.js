const BASE_URL = 'https://cloud-api.yandex.net'

function authHeaders(token) {
  return {
    Authorization: `OAuth ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function checkFileExists(token, path) {
  try {
    const res = await fetch(
      `${BASE_URL}/v1/disk/resources?path=${encodeURIComponent(path)}`,
      { headers: authHeaders(token) }
    )
    return res.ok
  } catch {
    return false
  }
}

export async function downloadCatalog(token) {
  const path = '/Lex Bibliotheca/catalog.json'
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
  const path = '/Lex Bibliotheca/catalog.json'
  // Get upload URL
  const res = await fetch(
    `${BASE_URL}/v1/disk/resources/upload?path=${encodeURIComponent(path)}&overwrite=true`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) {
    throw new Error(`Failed to get upload URL: ${res.status}`)
  }
  const { href } = await res.json()
  // Upload the data
  const uploadRes = await fetch(href, {
    method: 'PUT',
    body: JSON.stringify(books),
    headers: { 'Content-Type': 'application/json' },
  })
  if (!uploadRes.ok) {
    throw new Error(`Failed to upload catalog: ${uploadRes.status}`)
  }
  return true
}

export async function createFolder(token, path) {
  const res = await fetch(
    `${BASE_URL}/v1/disk/resources?path=${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: authHeaders(token),
    }
  )
  // 201 = created, 409 = already exists (both acceptable)
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to create folder: ${res.status}`)
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

export async function fetchAllPDFs(token, folderPath) {
  const res = await fetch(
    `${BASE_URL}/v1/disk/resources?path=${encodeURIComponent(folderPath)}&limit=500&sort=name`,
    { headers: authHeaders(token) }
  )
  if (!res.ok) {
    throw new Error(`Failed to list folder: ${res.status}`)
  }
  const data = await res.json()
  const items = data._embedded?.items || []
  return items
    .filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.pdf'))
    .map(item => ({
      name: item.name,
      path: item.path,
      size: item.size || 0,
    }))
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
