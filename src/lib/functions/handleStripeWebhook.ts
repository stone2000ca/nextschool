// Function: handleStripeWebhook
// Purpose: Handle Stripe webhook events for checkout completion
// Entities: User
// Last Modified: 2026-03-01

import { User } from '@/lib/entities-server'

export async function handleStripeWebhookLogic(rawBody: string, signature: string) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    throw Object.assign(new Error('Stripe not configured'), { status: 500 });
  }

  if (!signature) {
    throw Object.assign(new Error('Missing signature'), { status: 400 });
  }

  const Stripe = (await import('stripe')).default;
  const stripeClient = new Stripe(stripeSecretKey);

  // Verify webhook signature
  let event;
  try {
    event = await stripeClient.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    throw Object.assign(new Error('Signature verification failed'), { status: 400 });
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const userId = session.metadata?.userId;

    if (!userId) {
      console.error('Missing userId in webhook metadata');
      throw Object.assign(new Error('Missing userId'), { status: 400 });
    }

    // Update user subscription tier
    await User.update(userId, {
      subscriptionPlan: 'pro',
      maxSessions: 5,
      stripeCustomerId: session.customer,
    });

    console.log(`User ${userId} upgraded to pro`);
  }

  return { received: true };
}
