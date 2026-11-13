'use strict';

// Central Bank of Egypt exchange-rate endpoint.
// Keep upstream diagnostics private and return only a stable public error.

const SOURCE_URL =
  'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates';
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;

function decodeText(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    )
    .replace(/&[a-z]+;/gi, ' ');
}

function extractPageText(html) {
  return decodeText(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

async function readLimitedText(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error('UPSTREAM_RESPONSE_TOO_LARGE');
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('UPSTREAM_RESPONSE_TOO_LARGE');
      }

      output += decoder.decode(value, { stream: true });
    }

    output += decoder.decode();
    return output;
  } finally {
    reader.releaseLock();
  }
}

function parseRate(text) {
  const match = text.match(
    /(?:US\s*Dollar|United\s*States\s*Dollar|USD)\s*([\d,]+(?:\.\d+)?)\s*([\d,]+(?:\.\d+)?)/i
  );

  if (!match) return null;

  const buy = Number(match[1].replace(/,/g, ''));
  const sell = Number(match[2].replace(/,/g, ''));

  const dateMatch = text.match(
    /Rates\s+for\s+Date\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i
  );

  if (
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    buy <= 0 ||
    sell < buy ||
    !dateMatch
  ) {
    return null;
  }

  return {
    buy,
    sell,
    mid: Number(((buy + sell) / 2).toFixed(6)),
    rateDate:
      `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AbdullahLawExchangeRate/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error('UPSTREAM_HTTP_ERROR');
    }

    const contentType = String(response.headers.get('content-type') || '');
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error('UNEXPECTED_UPSTREAM_CONTENT_TYPE');
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
      throw new Error('UPSTREAM_RESPONSE_TOO_LARGE');
    }

    const html = await readLimitedText(response, MAX_HTML_BYTES);

    const rate = parseRate(extractPageText(html));
    if (!rate) {
      throw new Error('RATE_PARSE_FAILED');
    }

    return res.status(200).json({
      ...rate,
      fetchedAt: new Date().toISOString(),
      source: 'Central Bank of Egypt',
      sourceUrl: SOURCE_URL
    });
  } catch (_) {
    // Do not expose upstream response content, URLs, or exception details.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      error: 'Exchange rate temporarily unavailable'
    });
  }
};
