const PARSE_BATCH_SIZE = 80
const CLASSIFY_BATCH_SIZE = 30

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

function extractJSON(text) {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Неверный формат ответа от API')
  return JSON.parse(match[0])
}

// ── Parse titles ─────────────────────────────────────────────────────────────

async function parseTitlesBatch(books, apiKey) {
  const prompt = `You are parsing filenames from a Russian legal library catalog.
Each filename follows the pattern "Surname(s), Book Title" or just "Book Title" (no author).

Rules:
- Russian author surnames come FIRST, each is a single word starting with a capital Cyrillic letter
- Multiple authors are consecutive single-word entries separated by commas before the actual title
- Example: "Брагинский, Витрянский, Договорное право" → author: "Брагинский, Витрянский", title: "Договорное право"
- If the text starts with what looks like a book title (not a surname), return empty author
- Keep the full title including volume/edition info like "Том 1", "Выпуск 2", "Часть первая", etc.

Entries:
${books.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}

Return ONLY a valid JSON array, no explanation:
[{"index":1,"author":"...","title":"..."}, ...]`

  const text = await callClaude(apiKey, 'claude-haiku-4-5-20251001', prompt, 4096)
  const parsed = extractJSON(text)
  return parsed.map(item => ({
    id: books[item.index - 1]?.id,
    author: item.author || '',
    title: item.title || books[item.index - 1]?.title || '',
  })).filter(item => item.id)
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

async function classifyBatch(books, apiKey) {
  const prompt = `You are classifying books from a Russian legal library catalog.
For each book determine which legal systems it covers and which legal topics it addresses.

Use ONLY these exact values:
legalOrder: ${LEGAL_ORDERS.join(', ')}
topics: ${TOPICS.join(', ')}

Books:
${books.map((b, i) => `${i + 1}. "${b.title}"${b.author ? ` — ${b.author}` : ''}`).join('\n')}

Return ONLY a valid JSON array, no explanation:
[{"index":1,"legalOrder":["Russia"],"topics":["Contract Law","Obligations"]}, ...]`

  const text = await callClaude(apiKey, 'claude-haiku-4-5-20251001', prompt, 4096)
  const parsed = extractJSON(text)
  return parsed.map(item => ({
    id: books[item.index - 1]?.id,
    legalOrder: (item.legalOrder || []).filter(v => LEGAL_ORDERS.includes(v)),
    topics: (item.topics || []).filter(v => TOPICS.includes(v)),
  })).filter(item => item.id)
}

export async function classifyBooksInBatches(books, apiKey, onProgress) {
  const toProcess = books.filter(b =>
    (!b.legalOrder || b.legalOrder.length === 0) &&
    (!b.topics || b.topics.length === 0)
  )
  const results = []
  for (let i = 0; i < toProcess.length; i += CLASSIFY_BATCH_SIZE) {
    const batch = toProcess.slice(i, i + CLASSIFY_BATCH_SIZE)
    results.push(...await classifyBatch(batch, apiKey))
    if (onProgress) onProgress(Math.min(i + CLASSIFY_BATCH_SIZE, toProcess.length), toProcess.length)
  }
  return results
}

// ── Per-book description (used in BookForm) ──────────────────────────────────

export async function generateDescription(book, apiKey) {
  const prompt = `You are a legal bibliographer. Write a concise academic annotation (3–5 sentences) in Russian for the following book in a legal catalog. Book: «${book.title}», author: ${book.author}, year: ${book.year}, legal systems covered: ${(book.legalOrder || []).join(', ')}, topics: ${(book.topics || []).join(', ')}. Respond with annotation text only, no headings.`
  return callClaude(apiKey, 'claude-sonnet-4-20250514', prompt, 500)
}
