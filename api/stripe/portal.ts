import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16', // Fallback a una versin estable de Stripe
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured on this server.' });
  }

  try {
    const { customerId } = req.body || {};
    
    if (!customerId) {
      return res.status(400).json({ error: 'Missing customerId' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.VITE_APP_URL || req.headers.origin || 'http://localhost:5173'}/dashboard`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Portal Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
