const PARSE_BATCH_SIZE = 80

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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || '[]'
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Неверный формат ответа от API')
  const parsed = JSON.parse(jsonMatch[0])

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
    const batchResults = await parseTitlesBatch(batch, apiKey)
    results.push(...batchResults)
    if (onProgress) onProgress(Math.min(i + PARSE_BATCH_SIZE, toProcess.length), toProcess.length)
  }

  return results
}

export async function generateDescription(book, apiKey) {
  const prompt = `You are a legal bibliographer. Write a concise academic annotation (3–5 sentences) in Russian for the following book in a legal catalog. Book: «${book.title}», author: ${book.author}, year: ${book.year}, legal systems covered: ${(book.legalOrder || []).join(', ')}, topics: ${(book.topics || []).join(', ')}. Respond with annotation text only, no headings.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}
