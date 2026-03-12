export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, source } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email,
        listIds: [3],
        attributes: { SOURCE: source },
        updateEnabled: true
      })
    });

    if (response.status === 201 || response.status === 204) {
      return res.status(200).json({ success: true });
    } else {
      const data = await response.json();
      return res.status(400).json({ error: data.message });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
