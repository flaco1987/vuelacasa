import { buffer } from 'micro';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle subscription events
  try {
    switch (event.type) {

      // New subscriber — payment succeeded
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email;

        if (email && session.mode === 'subscription') {
          await addToBrevo(email, 'paid');
          console.log(`✅ New subscriber added to Brevo: ${email}`);
        }
        break;
      }

      // Subscription cancelled — remove from paid list
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Get customer email from Stripe
        const customer = await stripe.customers.retrieve(customerId);
        const email = customer.email;

        if (email) {
          await removeFromBrevo(email);
          console.log(`❌ Subscriber removed from Brevo: ${email}`);
        }
        break;
      }

      // Payment failed — log it
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const email = invoice.customer_email;
        console.log(`⚠️ Payment failed for: ${email}`);
        // Future: send a payment failed email via Brevo
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Add contact to Brevo paid subscribers list (List ID 4)
async function addToBrevo(email, type) {
  const listId = type === 'paid'
    ? parseInt(process.env.BREVO_PAID_LIST_ID || '4')
    : 3;

  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
      attributes: {
        SUBSCRIBER_TYPE: 'paid',
        SUBSCRIBED_DATE: new Date().toISOString().split('T')[0]
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  console.log('Brevo add response:', response.status, data);
  return data;
}

// Remove contact from Brevo paid list on cancellation
async function removeFromBrevo(email) {
  // Move to unsubscribed list rather than delete
  const listId = parseInt(process.env.BREVO_PAID_LIST_ID || '4');

  const response = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: JSON.stringify({ emails: [email] })
  });

  const data = await response.json().catch(() => ({}));
  console.log('Brevo remove response:', response.status, data);
  return data;
}
