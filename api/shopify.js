let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  const response = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token failed: ${response.status} ${text}`);
  }
  const { access_token, expires_in } = await response.json();
  cachedToken = access_token;
  tokenExpiresAt = Date.now() + expires_in * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, params } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

  const allowed = ['orders','products','customers','inventory_levels',
    'fulfillments','price_rules','discounts','shop',
    'shopify_payments/payouts','shopify_payments/disputes'];
  if (!allowed.some(e => endpoint.startsWith(e)))
    return res.status(403).json({ error: 'Not allowed' });

  try {
    const token = await getToken();
    const url = `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/${endpoint}.json${params ? '?' + params : ''}`;
    const r = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
