'use strict';

// Central Bank of Egypt exchange-rate endpoint.
// Keep upstream diagnostics private and return only a stable public error.

const SOURCE_URL =
  'https://api.frankfurter.dev/v2/providers/cbe/rates?base=USD&quotes=EGP';
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;

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
  const r=JSON.parse(text)[0]; if(!r || r.base!=="USD" || r.quote!=="EGP" || !Number.isFinite(r.rate) || r.rate<=1 || !r.date) return null; const t=Date.parse(r.date);if(!Number.isFinite(t)||Math.abs(Date.now()-t)>604800000)return null;return {buy:r.rate,sell:r.rate,mid:r.rate,rateDate:r.date};

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
    if (!contentType.includes("application/json")) {
      throw new Error('UNEXPECTED_UPSTREAM_CONTENT_TYPE');
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
      throw new Error('UPSTREAM_RESPONSE_TOO_LARGE');
    }

    const html = await readLimitedText(response, MAX_HTML_BYTES);

    const rate = parseRate(html);
    if (!rate) {
      throw new Error('RATE_PARSE_FAILED');
    }

    return res.status(200).json({
      ...rate,
      fetchedAt: new Date().toISOString(),
      source: 'Frankfurter (CBE reference rate)',
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
