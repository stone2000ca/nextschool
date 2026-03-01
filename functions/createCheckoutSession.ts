// Function: createCheckoutSession
// Purpose: Create a Stripe Checkout Session for subscription upgrade
// Entities: User
// Last Modified: 2026-03-01
// Dependencies: Stripe API

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const STRIPE_PRICE_ID = 'price_pro_monthly'; // Placeholder - update with actual Stripe price ID

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId } = await req.json();
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Import Stripe dynamically
    const stripe = (await import('npm:stripe@14.x')).default;
    const stripeClient = new stripe(stripeSecretKey);

    // Create checkout session
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: priceId || STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: 'https://nextschool.ca/dashboard?upgrade=success',
      cancel_url: 'https://nextschool.ca/dashboard?upgrade=cancelled',
      metadata: {
        userId: user.id,
      },
    });

    return Response.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error('Checkout session creation failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});