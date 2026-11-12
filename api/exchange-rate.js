module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'no-store'
  );

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const sourceUrl =
      'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates';

    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow'
    });

    const html = await response.text();

    // Diagnostic logs for Vercel
    console.log('CBE STATUS:', response.status);
    console.log(
      'CBE CONTENT TYPE:',
      response.headers.get('content-type')
    );
    console.log('CBE FINAL URL:', response.url);
    console.log(
      'CBE HTML SAMPLE:',
      html.substring(0, 1500)
    );

    if (!response.ok) {
      throw new Error(
        `CBE HTTP error: ${response.status}`
      );
    }

    // Convert HTML into readable text
    const text = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#(\d+);/g, (_, n) =>
        String.fromCharCode(Number(n))
      )
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(
      'CBE TEXT SAMPLE:',
      text.substring(0, 2000)
    );

    // Search for USD rate
    const usdMatch = text.match(
      /(?:US\s*Dollar|United\s*States\s*Dollar|USD)\s*([\d,]+(?:\.\d+)?)\s*([\d,]+(?:\.\d+)?)/i
    );

    if (!usdMatch) {
      console.error(
        'USD RATE NOT FOUND. PAGE TEXT:',
        text.substring(0, 5000)
      );

      throw new Error(
        'USD rate not found in CBE response'
      );
    }

    const buy = Number(
      usdMatch[1].replace(/,/g, '')
    );

    const sell = Number(
      usdMatch[2].replace(/,/g, '')
    );

    // Extract publication date
    const dateMatch = text.match(
      /Rates\s+for\s+Date\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i
    );

    if (!dateMatch) {
      throw new Error(
        'CBE publication date not found'
      );
    }

    const rateDate =
      `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;

    if (
      !Number.isFinite(buy) ||
      !Number.isFinite(sell) ||
      buy <= 0 ||
      sell < buy
    ) {
      throw new Error(
        'Invalid CBE USD rate values'
      );
    }

    const mid = (buy + sell) / 2;

    return res.status(200).json({
      buy,
      sell,
      mid: Number(mid.toFixed(6)),
      rateDate,
      fetchedAt: new Date().toISOString(),
      source: 'Central Bank of Egypt',
      sourceUrl
    });

  } catch (error) {
    console.error(
      'Exchange rate API error:',
      error
    );

    return res.status(502).json({
      error: 'Exchange rate temporarily unavailable',
      details: error.message
    });
  }
};
