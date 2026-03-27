const PARSE_BATCH_SIZE = 80
const CLASSIFY_BATCH_SIZE = 30
const YEAR_BATCH_SIZE = 40

const LEGAL_ORDERS = ['Russia', 'Germany', 'France', 'Netherlands', 'Switzerland', 'Austria', 'England/USA', 'Roman law', 'EU', 'International', 'Spain', 'Italy', 'Other']
const TOPICS = ['General Civil Law', 'Property Law', 'Contract Law', 'Obligations', 'Tort Law', 'Corporate Law', 'Pledge/Security', 'Invalidity of Transactions', 'Family Law', 'Inheritance Law', 'Procedural Law', 'Comparative Law', 'Legal History', 'Legal Theory', 'Roman Law', 'Bankruptcy', 'Other']

async function callClaude(apiKey, model, prompt, maxTokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// ── Parse titles ─────────────────────────────────────────────────────────────
// Output: two lines per entry:
//   [N] AUTHOR: Surname(s)
//   [N] TITLE: Book title

async function parseTitlesBatch(books, apiKey) {
  const prompt = `You are parsing filenames from a Russian legal library catalog.
Each filename follows the pattern "Surname(s), Book Title" or just "Book Title" (no author).

Rules:
- Russian author surnames come FIRST, each is a single word starting with a capital Cyrillic letter
- Multiple authors are consecutive single-word entries separated by commas before the actual title
- Example: "Брагинский, Витрянский, Договорное право" → AUTHOR: Брагинский, Витрянский | TITLE: Договорное право
- If the text starts with what looks like a book title (not a surname), leave AUTHOR empty
- Keep the full title including volume/edition info like Том 1, Выпуск 2, Часть первая

Entries to parse:
${books.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}

Output format — two lines per entry, no extra text:
[1] AUTHOR: Брагинский, Витрянский
[1] TITLE: Договорное право. Книга первая
[2] AUTHOR: Аболонин
[2] TITLE: Злоупотребление правом на иск
[3] AUTHOR:
[3] TITLE: Гражданский кодекс Германии`

  const text = await callClaude(apiKey, 'claude-haiku-4-5-20251001', prompt, 4096)

  const authorMap = new Map()
  const titleMap = new Map()
  for (const line of text.split('\n')) {
    const a = line.match(/^\[(\d+)\]\s+AUTHOR:\s*(.*)/)
    const t = line.match(/^\[(\d+)\]\s+TITLE:\s*(.*)/)
    if (a) authorMap.set(parseInt(a[1]), a[2].trim())
    if (t) titleMap.set(parseInt(t[1]), t[2].trim())
  }

  const results = []
  for (let i = 0; i < books.length; i++) {
    const n = i + 1
    if (!titleMap.has(n) && !authorMap.has(n)) continue
    results.push({
      id: books[i].id,
      author: authorMap.get(n) ?? '',
      title: titleMap.get(n) || books[i].title,
    })
  }
  return results
}

export async function parseTitlesInBatches(books, apiKey, onProgress) {
  const toProcess = books.filter(b => !b.author || b.author.trim() === '')
  const results = []
  for (let i = 0; i < toProcess.length; i += PARSE_BATCH_SIZE) {
    const batch = toProcess.slice(i, i + PARSE_BATCH_SIZE)
    results.push(...await parseTitlesBatch(batch, apiKey))
    if (onProgress) onProgress(Math.min(i + PARSE_BATCH_SIZE, toProcess.length), toProcess.length)
  }
  return results
}

// ── Classify legalOrder + topics ──────────────────────────────────────────────
// Output: two lines per entry:
//   [N] LEGAL: Russia,Germany
//   [N] TOPICS: Contract Law,Obligations

async function classifyBatch(books, apiKey) {
  const prompt = `You are classifying books from a Russian legal library catalog.
For each book determine which legal systems it covers and which legal topics it addresses.

Use ONLY these exact values:
LEGAL: ${LEGAL_ORDERS.join(', ')}
TOPICS: ${TOPICS.join(', ')}

Books:
${books.map((b, i) => `${i + 1}. ${b.title}${b.author ? ` — ${b.author}` : ''}`).join('\n')}

Output format — two lines per entry, no extra text:
[1] LEGAL: Russia,Germany
[1] TOPICS: Contract Law,Obligations
[2] LEGAL: Roman law
[2] TOPICS: Legal History,Roman Law`

  const text = await callClaude(apiKey, 'claude-haiku-4-5-20251001', prompt, 4096)

  const legalMap = new Map()
  const topicsMap = new Map()
  for (const line of text.split('\n')) {
    const l = line.match(/^\[(\d+)\]\s+LEGAL:\s*(.*)/)
    const t = line.match(/^\[(\d+)\]\s+TOPICS:\s*(.*)/)
    if (l) legalMap.set(parseInt(l[1]), l[2].trim())
    if (t) topicsMap.set(parseInt(t[1]), t[2].trim())
  }

  const results = []
  for (let i = 0; i < books.length; i++) {
    const n = i + 1
    if (!legalMap.has(n) && !topicsMap.has(n)) continue
    const legalOrder = (legalMap.get(n) || '').split(',').map(s => s.trim()).filter(v => LEGAL_ORDERS.includes(v))
    const topics = (topicsMap.get(n) || '').split(',').map(s => s.trim()).filter(v => TOPICS.includes(v))
    results.push({ id: books[i].id, legalOrder, topics })
  }
  return results
}

export async function classifyBooksInBatches(books, apiKey, onProgress) {
  const toProcess = books.filter(b => !b.topics || b.topics.length === 0)
  const results = []
  for (let i = 0; i < toProcess.length; i += CLASSIFY_BATCH_SIZE) {
    const batch = toProcess.slice(i, i + CLASSIFY_BATCH_SIZE)
    results.push(...await classifyBatch(batch, apiKey))
    if (onProgress) onProgress(Math.min(i + CLASSIFY_BATCH_SIZE, toProcess.length), toProcess.length)
  }
  return results
}

// ── Estimate publication years via AI ────────────────────────────────────────
// Output: [N] YEAR: 1998   or   [N] YEAR: ?  (if unknown)

const DEFAULT_YEAR = new Date().getFullYear()

async function estimateYearsBatch(books, apiKey) {
  const prompt = `You are a legal bibliographer with knowledge of Russian and European legal literature.
For each book below, provide the publication year based on the title and author.
Only provide a specific year if you are reasonably confident. Use ? if unknown.
Years must be between 1800 and ${DEFAULT_YEAR - 1}.

Books:
${books.map((b, i) => `${i + 1}. ${b.title}${b.author ? ` — ${b.author}` : ''}`).join('\n')}

Output format — one line per entry, no extra text:
[1] YEAR: 1998
[2] YEAR: ?
[3] YEAR: 2003`

  const text = await callClaude(apiKey, 'claude-haiku-4-5-20251001', prompt, 2048)

  const results = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\[(\d+)\]\s+YEAR:\s*(\?|\d{4})/)
    if (!m) continue
    const index = parseInt(m[1], 10) - 1
    const yearStr = m[2]
    if (yearStr === '?' || index < 0 || index >= books.length) continue
    const year = parseInt(yearStr, 10)
    if (year < 1800 || year >= DEFAULT_YEAR) continue
    results.push({ id: books[index].id, year })
  }
  return results
}

export async function estimateYearsInBatches(books, apiKey, onProgress) {
  const toProcess = books.filter(b => !b.year || b.year >= DEFAULT_YEAR)
  const results = []
  for (let i = 0; i < toProcess.length; i += YEAR_BATCH_SIZE) {
    const batch = toProcess.slice(i, i + YEAR_BATCH_SIZE)
    results.push(...await estimateYearsBatch(batch, apiKey))
    if (onProgress) onProgress(Math.min(i + YEAR_BATCH_SIZE, toProcess.length), toProcess.length)
  }
  return results
}

// ── Per-book description (used in BookForm) ──────────────────────────────────

export async function generateDescription(book, apiKey) {
  const prompt = `You are a legal bibliographer. Write a concise academic annotation (3–5 sentences) in Russian for the following book in a legal catalog. Book: «${book.title}», author: ${book.author}, year: ${book.year}, legal systems covered: ${(book.legalOrder || []).join(', ')}, topics: ${(book.topics || []).join(', ')}. Respond with annotation text only, no headings.`
  return callClaude(apiKey, 'claude-sonnet-4-20250514', prompt, 500)
}
