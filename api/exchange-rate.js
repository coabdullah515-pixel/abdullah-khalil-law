
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

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
          'Accept': 'text/html'
        }
      }
    );

    if (!response.ok) {
      throw new Error('CBE source unavailable');
    }

    const html = await response.text();

    const row = html.match(
      /<tr\b[^>]*>[\s\S]*?US\s*Dollar[\s\S]*?<\/tr>/i
    );

    if (!row) {
      throw new Error('USD rate row not found');
    }

    const values = row[0]
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .match(/\d+(?:\.\d+)?/g);

    if (!values || values.length < 2) {
      throw new Error('Invalid USD rate data');
    }

    const buy = Number(values[0]);
    const sell = Number(values[1]);

    const dateMatch = html.match(
      /Rates\s+for\s+Date\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i
    );

    if (!dateMatch) {
      throw new Error('Publication date not found');
    }

    const rateDate =
      `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;

    if (
      !Number.isFinite(buy) ||
      !Number.isFinite(sell) ||
      buy <= 1 ||
      sell < buy
    ) {
      throw new Error('Invalid exchange rate');
    }

    const mid = (buy + sell) / 2;

    return res.status(200).json({
      buy,
      sell,
      mid: Number(mid.toFixed(6)),
      rateDate,
      fetchedAt: new Date().toISOString(),
      source: 'Central Bank of Egypt',
      sourceUrl: 'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates'
    });

  } catch (error) {
    console.error('Exchange rate API error:', error);

    return res.status(502).json({
      error: 'Exchange rate temporarily unavailable'
    });
  }
};
