'use strict';

// CSP report receiver for Vercel
// Privacy-minimized logging only.

const MAX_BODY_BYTES = 48 * 1024;
const MAX_REPORTS = 20;

function clip(value, max = 300) {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  return s ? s.slice(0, max) : undefined;
}

function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;

  const raw = value.trim();

  if (/^(inline|eval|wasm-eval|data):?$/i.test(raw)) {
    return raw.slice(0, 80);
  }

  try {
    const u = new URL(raw, 'https://invalid.local');
    return (
      u.origin === 'https://invalid.local'
        ? u.pathname
        : u.origin + u.pathname
    ).slice(0, 500);
  } catch (_) {
    return raw.split(/[?#]/, 1)[0].slice(0, 500);
  }
}

function normalize(report) {
  const r = report && typeof report === 'object' ? report : {};

  const body =
    r.body && typeof r.body === 'object'
      ? r.body
      : r['csp-report'] && typeof r['csp-report'] === 'object'
        ? r['csp-report']
        : r;

  const line = body.lineNumber ?? body['line-number'];
  const column = body.columnNumber ?? body['column-number'];
  const status = body.statusCode ?? body['status-code'];

  const result = {
    type: clip(r.type, 80),
    disposition: clip(body.disposition || r.disposition, 40),
    documentUri: safeUrl(
      body.documentURL || body['document-uri'] || r.url
    ),
    blockedUri: safeUrl(
      body.blockedURL || body['blocked-uri']
    ),
    effectiveDirective: clip(
      body.effectiveDirective || body['effective-directive'],
      120
    ),
    violatedDirective: clip(
      body['violated-directive'] || body.violatedDirective,
      120
    ),
    sourceFile: safeUrl(
      body.sourceFile || body['source-file']
    ),
    lineNumber:
      line !== undefined && Number.isFinite(Number(line))
        ? Number(line)
        : undefined,
    columnNumber:
      column !== undefined && Number.isFinite(Number(column))
        ? Number(column)
        : undefined,
    statusCode:
      status !== undefined && Number.isFinite(Number(status))
        ? Number(status)
        : undefined
  };

  Object.keys(result).forEach((key) => {
    if (result[key] === undefined) delete result[key];
  });

  return result;
}

async function readRawBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk);

    total += buffer.length;

    if (total > MAX_BODY_BYTES) {
      const error = new Error('Payload too large');
      error.statusCode = 413;
      throw error;
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks, total);
}

function parseReports(value) {
  if (Buffer.isBuffer(value)) {
    value = value.toString('utf8');
  }

  if (typeof value === 'string') {
    if (Buffer.byteLength(value, 'utf8') > MAX_BODY_BYTES) {
      return null;
    }

    try {
      value = JSON.parse(value);
    } catch (_) {
      return null;
    }
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_REPORTS);
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.reports)) {
      return value.reports.slice(0, MAX_REPORTS);
    }

    if (
      value['csp-report'] &&
      typeof value['csp-report'] === 'object'
    ) {
      return [value];
    }

    if (
      value['violated-directive'] ||
      value.violatedDirective ||
      value.effectiveDirective ||
      value.body
    ) {
      return [value];
    }
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const contentType = String(
    req.headers['content-type'] || ''
  ).toLowerCase();

  const accepted =
    contentType.includes('application/csp-report') ||
    contentType.includes('application/reports+json') ||
    contentType.includes('application/json');

  if (!accepted) {
    return res.status(415).end();
  }

  const contentLength = Number(
    req.headers['content-length']
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    return res.status(413).end();
  }

  let body;

  try {
    body = req.body;

    // If the platform did not parse the request,
    // read the raw request stream.
    if (
      body === undefined ||
      body === null ||
      (typeof body === 'object' &&
        !Buffer.isBuffer(body) &&
        Object.keys(body).length === 0)
    ) {
      body = await readRawBody(req);
    }
  } catch (error) {
    if (error && error.statusCode === 413) {
      return res.status(413).end();
    }

    console.warn(JSON.stringify({
      event: 'csp_report_read_error'
    }));

    return res.status(400).end();
  }

  let bytes;

  try {
    bytes = Buffer.isBuffer(body)
      ? body.length
      : Buffer.byteLength(
          typeof body === 'string'
            ? body
            : JSON.stringify(body),
          'utf8'
        );
  } catch (_) {
    return res.status(400).end();
  }

  if (bytes > MAX_BODY_BYTES) {
    return res.status(413).end();
  }

  const reports = parseReports(body);

  if (!reports || reports.length === 0) {
    console.warn(JSON.stringify({
      event: 'csp_report_rejected'
    }));

    return res.status(400).end();
  }

  const normalized = reports.map(normalize);

  const directiveCounts = {};
  normalized.forEach((report) => {
    const directive = report.effectiveDirective || report.violatedDirective || 'unknown';
    directiveCounts[directive] = (directiveCounts[directive] || 0) + 1;
  });

  // Log aggregate security telemetry only; omit visitor URLs and request details.
  console.log(JSON.stringify({
    event: 'csp_violation_reports',
    count: normalized.length,
    directiveCounts,
    receivedAt: new Date().toISOString()
  }));

  return res.status(204).end();
};
