
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    's-maxage=1800, stale-while-revalidate=3600'
  );

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'text/html,application/xhtml+xml'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`CBE HTTP error: ${response.status}`);
    }

    const html = await response.text();

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

    // Find USD buy and sell values
    const usdMatch = text.match(
      /US\s*Dollar\s*([\d,]+(?:\.\d+)?)\s*([\d,]+(?:\.\d+)?)/i
    );

    if (!usdMatch) {
      throw new Error('USD rate not found in CBE page text');
    }

    const buy = Number(usdMatch[1].replace(/,/g, ''));
    const sell = Number(usdMatch[2].replace(/,/g, ''));

    // Find publication date
    const dateMatch = text.match(
      /Rates\s+for\s+Date\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i
    );

    if (!dateMatch) {
      throw new Error('CBE publication date not found');
    }

    const rateDate =
      `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;

    if (
      !Number.isFinite(buy) ||
      !Number.isFinite(sell) ||
      buy <= 0 ||
      sell < buy
    ) {
      throw new Error('Invalid CBE USD rate values');
    }

    return res.status(200).json({
      buy,
      sell,
      mid: Number(((buy + sell) / 2).toFixed(6)),
      rateDate,
      fetchedAt: new Date().toISOString(),
      source: 'Central Bank of Egypt',
      sourceUrl:
        'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates'
    });

  } catch (error) {
    console.error('Exchange rate API error:', error);

    return res.status(502).json({
      error: 'Exchange rate temporarily unavailable',
      details: error.message
    });
  }
};
