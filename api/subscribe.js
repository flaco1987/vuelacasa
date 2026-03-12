export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, source } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

  try {
    const payload = {
      email,
      listIds: [3],
      updateEnabled: true
    };

    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    console.log('Brevo status:', response.status, 'body:', JSON.stringify(data));

    if (response.status === 201 || response.status === 204 || response.status === 200) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(200).json({ success: false, brevo: data });
    }
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(200).json({ error: err.message });
  }
}
