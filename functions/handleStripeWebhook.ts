// Function: handleStripeWebhook
// Purpose: Handle Stripe webhook events for checkout completion
// Entities: User
// Last Modified: 2026-03-01
// Dependencies: Stripe API, crypto for signature verification

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeSecretKey || !webhookSecret) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Get body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return Response.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Import Stripe
    const stripe = (await import('npm:stripe@14.x')).default;
    const stripeClient = new stripe(stripeSecretKey);

    // Verify webhook signature using async method
    let event;
    try {
      event = await stripeClient.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return Response.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;

      if (!userId) {
        console.error('Missing userId in webhook metadata');
        return Response.json({ error: 'Missing userId' }, { status: 400 });
      }

      // Initialize Base44 as service role to update user
      const base44 = await (await import('npm:@base44/sdk@0.8.6')).createClient({
        apiKey: Deno.env.get('BASE44_APP_ID'),
        useServiceRole: true,
      });

      // Update user subscription tier
      await base44.entities.User.update(userId, {
        subscriptionPlan: 'pro',
        maxSessions: 5,
        stripeCustomerId: session.customer,
      });

      console.log(`User ${userId} upgraded to pro`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});