export default async function handler(req, res) {
  // Allow CORS for same-origin fetch from landing page
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method !== 'GET') return res.status(405).end();

  try {
    // Fetch paid subscribers list from Brevo (List ID 4 = paid subscribers)
    const listId = process.env.BREVO_PAID_LIST_ID || '4';

    const response = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      }
    });

    if (!response.ok) {
      console.error('Brevo error:', response.status);
      return res.status(200).json({ count: 0, total: 50 });
    }

    const data = await response.json();
    const count = data.uniqueSubscribers || data.totalSubscribers || 0;

    return res.status(200).json({
      count: count,
      total: 50,
      remaining: Math.max(0, 50 - count),
      pct: Math.round((count / 50) * 100)
    });

  } catch (err) {
    console.error('Members count error:', err);
    // Fail gracefully — return 0 rather than breaking the page
    return res.status(200).json({ count: 0, total: 50, remaining: 50, pct: 0 });
  }
}
