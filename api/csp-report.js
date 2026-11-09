'use strict';

// Vercel Node.js Function: receives CSP violation reports and writes only
// normalized, privacy-minimized fields to the Vercel Function runtime logs.
// It intentionally does not persist report bodies or reflect submitted data.

const MAX_BODY_BYTES = 48 * 1024;
const MAX_REPORTS_PER_REQUEST = 20;

function clip(value, max = 300) {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  return s ? s.slice(0, max) : undefined;
}

function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  if (/^(inline|eval|wasm-eval|data):?$/i.test(raw)) return raw.slice(0, 80);
  try {
    const u = new URL(raw, 'https://invalid.local');
    // Remove query strings and fragments: they can contain tokens or personal data.
    return (u.origin === 'https://invalid.local' ? u.pathname : u.origin + u.pathname).slice(0, 500);
  } catch (_) {
    return raw.split(/[?#]/, 1)[0].slice(0, 500);
  }
}

function pick(report) {
  const r = report && typeof report === 'object' ? report : {};
  const body = r.body && typeof r.body === 'object' ? r.body :
    (r['csp-report'] && typeof r['csp-report'] === 'object' ? r['csp-report'] : r);
  const out = {
    disposition: clip(body.disposition || r.disposition, 40),
    documentUri: safeUrl(body.documentURL || body['document-uri'] || r.url),
    blockedUri: safeUrl(body.blockedURL || body['blocked-uri']),
    effectiveDirective: clip(body.effectiveDirective || body['effective-directive'], 120),
    violatedDirective: clip(body['violated-directive'], 120),
    sourceFile: safeUrl(body.sourceFile || body['source-file']),
    lineNumber: Number.isFinite(Number(body.lineNumber || body['line-number'])) ? Number(body.lineNumber || body['line-number']) : undefined,
    columnNumber: Number.isFinite(Number(body.columnNumber || body['column-number'])) ? Number(body.columnNumber || body['column-number']) : undefined,
    statusCode: Number.isFinite(Number(body.statusCode || body['status-code'])) ? Number(body.statusCode || body['status-code']) : undefined
  };
  Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
  return out;
}

function parseReports(body) {
  if (Array.isArray(body)) return body.slice(0, MAX_REPORTS_PER_REQUEST);
  if (body && typeof body === 'object') {
    if (Array.isArray(body.reports)) return body.reports.slice(0, MAX_REPORTS_PER_REQUEST);
    return [body];
  }
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return null;
    try { return parseReports(JSON.parse(body)); } catch (_) { return null; }
  }
  return null;
}

module.exports = function handler(req, res) {
  // Reports are same-origin POSTs; no permissive CORS header is added.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const accepted = contentType.includes('application/csp-report') ||
    contentType.includes('application/reports+json') ||
    contentType.includes('application/json');
  if (!accepted) return res.status(415).end();

  let body = req.body;
  if (body === undefined || body === null) body = '';
  let bytes;
  try { bytes = Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body), 'utf8'); }
  catch (_) { return res.status(400).end(); }
  if (bytes > MAX_BODY_BYTES) return res.status(413).end();

  const reports = parseReports(body);
  if (!reports || reports.length === 0) return res.status(400).end();

  const normalized = reports.map(pick);
  // Avoid logging raw payloads, query strings, cookies, headers, or script samples.
  console.log(JSON.stringify({
    event: 'csp_violation_reports',
    count: normalized.length,
    reports: normalized,
    receivedAt: new Date().toISOString()
  }));

  return res.status(204).end();
};
