// Function: createCheckoutSession
// Purpose: Create a Stripe Checkout Session for subscription upgrade
// Entities: User
// Last Modified: 2026-03-01

const STRIPE_PRICE_ID = 'price_pro_monthly'; // Placeholder - update with actual Stripe price ID

export async function createCheckoutSessionLogic(params: { priceId?: string; userEmail: string; userId: string }) {
  const { priceId, userEmail, userId } = params;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw Object.assign(new Error('Stripe not configured'), { status: 500 });
  }

  const Stripe = (await import('stripe')).default;
  const stripeClient = new Stripe(stripeSecretKey);

  const session = await stripeClient.checkout.sessions.create({
    mode: 'subscription',
    customer_email: userEmail,
    line_items: [
      {
        price: priceId || STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    success_url: 'https://nextschool.ca/dashboard?upgrade=success',
    cancel_url: 'https://nextschool.ca/dashboard?upgrade=cancelled',
    metadata: {
      userId: userId,
    },
  });

  return { checkoutUrl: session.url };
}
