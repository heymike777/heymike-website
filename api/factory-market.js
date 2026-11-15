const TOKENS = Object.freeze({
  wbcE7iMmWN1XGEa6mtgRS3FoLgc936rMJYjeujapump: '7LANrQamVd2VuAAuvUCkJu19iwqLc3DeBwVHP18XsNmh',
  KxHGHaXXb1rtkUvZ4SNG5Xv1n1fNWJv4nWEBndppump: '5NTSdZzLs7N5eLbi4UjEPzUott3NgRSrYFNfKto6eNVw',
  '6Q5t5upWJwDocysAwR2zertE2EPxB3X1ek1HRoj4LUM': '2uoYsP4YxsSfdXj5NYQszsZQbW77J2ZHz4N8KV2sgbZL',
});

const API = 'https://api.geckoterminal.com/api/v2/networks/solana';
const headers = { Accept: 'application/json;version=20230203' };
const LUMEN = '6Q5t5upWJwDocysAwR2zertE2EPxB3X1ek1HRoj4LUM';
// Historical on-chain-derived daily market-cap snapshot from CoinGecko, 2026-11-15.
// The free GeckoTerminal OHLCV API exposes only the latest 180 days for this older token.
const lumenHistoricalFloor = { value: 291533.11273338075, at: '2025-12-28T00:00:00.000Z' };

async function getJson(url) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Market provider returned ${response.status}`);
  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const address = new URL(req.url, 'https://heymike.io').searchParams.get('token');
  if (!Object.hasOwn(TOKENS, address)) return res.status(400).json({ error: 'Unknown Factory token' });
  const pool = TOKENS[address];

  try {
    const [tokenResult, candleResult, lumenHistory] = await Promise.all([
      getJson(`${API}/tokens/${address}`),
      getJson(`${API}/pools/${pool}/ohlcv/day?aggregate=1&limit=1000&currency=usd&token=base`),
      address === LUMEN
        ? getJson('https://api.coingecko.com/api/v3/coins/lumen/market_chart?vs_currency=usd&days=365').catch(() => null)
        : Promise.resolve(null),
    ]);
    const token = tokenResult.data?.attributes;
    const candles = candleResult.data?.attributes?.ohlcv_list;
    const base = candleResult.meta?.base?.address;
    const supply = Number(token?.normalized_total_supply);
    if (base !== address || !Number.isFinite(supply) || supply <= 0 || !Array.isArray(candles) || !candles.length) {
      throw new Error('Incomplete token or pool history');
    }

    const highest = candles.reduce((best, candle) =>
      Number(candle[2]) > Number(best[2]) ? candle : best);
    const marketCap = Number(token.market_cap_usd ?? token.fdv_usd);
    const indexedPeak = Number(highest[2]) * supply;
    const coingeckoPeak = address === LUMEN && Array.isArray(lumenHistory?.market_caps)
      ? lumenHistory.market_caps.reduce((best, entry) =>
          Number(entry[1]) > Number(best[1]) ? entry : best, [0, 0])
      : [0, 0];
    const historical = address === LUMEN && Number(coingeckoPeak[1]) > lumenHistoricalFloor.value
      ? { value: Number(coingeckoPeak[1]), at: new Date(Number(coingeckoPeak[0])).toISOString() }
      : address === LUMEN ? lumenHistoricalFloor : { value: 0, at: null };
    const peakMarketCap = Math.max(indexedPeak, historical.value);
    if (!Number.isFinite(peakMarketCap) || peakMarketCap <= 0) throw new Error('Invalid price history');
    const currentIsPeak = Number.isFinite(marketCap) && marketCap > peakMarketCap;

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      token: address,
      marketCap: Number.isFinite(marketCap) ? marketCap : null,
      peakMarketCap: Math.max(peakMarketCap, Number.isFinite(marketCap) ? marketCap : 0),
      peakCandleUtc: currentIsPeak
        ? new Date().toISOString()
        : historical.value > indexedPeak ? historical.at : new Date(Number(highest[0]) * 1000).toISOString(),
      method: address === LUMEN
        ? 'Maximum of primary-pool on-chain candle estimate and CoinGecko historical market-cap series'
        : 'Highest USD daily candle in primary on-chain pool × current reported token supply',
      source: historical.value > indexedPeak
        ? 'https://www.coingecko.com/en/coins/lumen/historical_data'
        : `https://www.geckoterminal.com/solana/pools/${pool}`,
    });
  } catch (error) {
    console.error('Factory market data unavailable:', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Market data temporarily unavailable' });
  }
};
