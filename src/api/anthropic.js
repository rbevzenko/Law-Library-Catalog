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
