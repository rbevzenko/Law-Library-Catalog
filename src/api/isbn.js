// ISBN lookup via Open Library (free, no key) with Google Books fallback

function extractYear(dateStr) {
  if (!dateStr) return null
  const m = String(dateStr).match(/\b(1[89]\d{2}|20[012]\d)\b/)
  return m ? parseInt(m[1]) : null
}

async function fromOpenLibrary(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Open Library недоступна')
  const data = await res.json()
  const book = data[`ISBN:${isbn}`]
  if (!book) return null

  const author = book.authors?.[0]?.name || ''
  const year = extractYear(book.publish_date)
  const subjects = (book.subjects || []).map(s => (typeof s === 'string' ? s : s.name)).slice(0, 6)
  const description = typeof book.notes === 'string' ? book.notes
    : book.description?.value || book.description || ''

  return {
    title:       book.title || '',
    author,
    year,
    description: String(description).slice(0, 1000),
    tags:        subjects,
    isbn,
  }
}

async function fromGoogleBooks(isbn) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Google Books недоступна')
  const data = await res.json()
  const item = data.items?.[0]?.volumeInfo
  if (!item) return null

  const year = extractYear(item.publishedDate)
  const tags = (item.categories || []).slice(0, 6)
  const description = item.description || ''

  return {
    title:       item.title || '',
    author:      (item.authors || []).join(', '),
    year,
    description: description.slice(0, 1000),
    tags,
    isbn,
  }
}

export async function fetchByISBN(isbn) {
  const clean = isbn.replace(/[^0-9X]/gi, '')
  if (clean.length !== 10 && clean.length !== 13) {
    throw new Error('ISBN должен содержать 10 или 13 цифр')
  }

  // Try Open Library first, fall back to Google Books
  try {
    const result = await fromOpenLibrary(clean)
    if (result?.title) return result
  } catch { /* fall through */ }

  const result = await fromGoogleBooks(clean)
  if (result?.title) return result

  throw new Error('Книга не найдена по ISBN ' + clean)
}
