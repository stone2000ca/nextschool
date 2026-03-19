// Function: createCheckoutSession
// Purpose: Create a Stripe Checkout Session for subscription upgrade
// Entities: User
// Last Modified: 2026-03-19

export async function createCheckoutSessionLogic(params: { priceId?: string; userEmail: string; userId: string }) {
  const { priceId, userEmail, userId } = params;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw Object.assign(new Error('Stripe not configured'), { status: 500 });
  }

  const defaultPriceId = process.env.STRIPE_PRICE_ID;
  const resolvedPriceId = priceId || defaultPriceId;
  if (!resolvedPriceId) {
    throw Object.assign(new Error('No price ID provided and STRIPE_PRICE_ID env var is not set'), { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nextschool.ca';

  const Stripe = (await import('stripe')).default;
  const stripeClient = new Stripe(stripeSecretKey);

  const session = await stripeClient.checkout.sessions.create({
    mode: 'subscription',
    customer_email: userEmail,
    line_items: [
      {
        price: resolvedPriceId,
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/dashboard?upgrade=success`,
    cancel_url: `${baseUrl}/dashboard?upgrade=cancelled`,
    metadata: {
      userId: userId,
    },
  });

  return { checkoutUrl: session.url };
}
