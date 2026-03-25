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

// ── Parse titles ─────────────────────────────────────────────────────────────
// Output format: one line per book: INDEX|||AUTHOR|||TITLE
// Using ||| delimiter instead of JSON to avoid issues with quotes in titles

async function parseTitlesBatch(books, apiKey) {
  const prompt = `You are parsing filenames from a Russian legal library catalog.
Each filename follows the pattern "Surname(s), Book Title" or just "Book Title" (no author).

Rules:
- Russian author surnames come FIRST, each is a single word starting with a capital Cyrillic letter
- Multiple authors are consecutive single-word entries separated by commas before the actual title
- Example: "Брагинский, Витрянский, Договорное право" → author: Брагинский, Витрянский | title: Договорное право
- If the text starts with what looks like a book title (not a surname), leave author empty
- Keep the full title including volume/edition info like Том 1, Выпуск 2, Часть первая, etc.

Entries:
${books.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}

Return ONLY lines in this exact format, one per entry, no explanation:
INDEX|||AUTHOR|||TITLE

Example:
1|||Брагинский, Витрянский|||Договорное право. Книга первая
2|||Аболонин|||Злоупотребление правом на иск
3||||||Гражданский кодекс Германии`

  const text = await callClaude(apiKey, 'claude-haiku-4-5-20251001', prompt, 4096)
  const results = []
  for (const line of text.split('\n')) {
    const parts = line.trim().split('|||')
    if (parts.length < 3) continue
    const index = parseInt(parts[0], 10) - 1
    if (isNaN(index) || index < 0 || index >= books.length) continue
    results.push({
      id: books[index].id,
      author: parts[1].trim(),
      title: parts[2].trim() || books[index].title,
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
// Output format: INDEX|||legalOrder1,legalOrder2|||topic1,topic2

async function classifyBatch(books, apiKey) {
  const prompt = `You are classifying books from a Russian legal library catalog.
For each book determine which legal systems it covers and which legal topics it addresses.

Use ONLY these exact values:
legalOrder: ${LEGAL_ORDERS.join(', ')}
topics: ${TOPICS.join(', ')}

Books:
${books.map((b, i) => `${i + 1}. ${b.title}${b.author ? ` — ${b.author}` : ''}`).join('\n')}

Return ONLY lines in this exact format, one per entry, no explanation:
INDEX|||legalOrder1,legalOrder2|||topic1,topic2

Example:
1|||Russia,Germany|||Contract Law,Obligations
2|||Roman law|||Legal History,Roman Law
3|||Russia|||General Civil Law`

  const text = await callClaude(apiKey, 'claude-haiku-4-5-20251001', prompt, 4096)
  const results = []
  for (const line of text.split('\n')) {
    const parts = line.trim().split('|||')
    if (parts.length < 3) continue
    const index = parseInt(parts[0], 10) - 1
    if (isNaN(index) || index < 0 || index >= books.length) continue
    const legalOrder = parts[1].split(',').map(s => s.trim()).filter(v => LEGAL_ORDERS.includes(v))
    const topics = parts[2].split(',').map(s => s.trim()).filter(v => TOPICS.includes(v))
    results.push({ id: books[index].id, legalOrder, topics })
  }
  return results
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
