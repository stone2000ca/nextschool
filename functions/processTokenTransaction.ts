import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, sessionId } = await req.json();

    // Get current user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Check if premium user (unlimited tokens)
    if (user.subscriptionPlan === 'premium') {
      return Response.json({ 
        success: true, 
        unlimited: true,
        remainingBalance: 999999 
      });
    }

    // Token costs
    const tokenCosts = {
      message_sent: 1,
      recommendations: 2,
      comparison_generated: 3,
      deep_analysis: 5,
      pdf_export: 2
    };

    const tokensNeeded = tokenCosts[action] || 1;
    const currentBalance = user.tokenBalance || 0;

    // Check if enough tokens
    if (currentBalance < tokensNeeded) {
      return Response.json({ 
        error: 'Insufficient tokens',
        needsUpgrade: true,
        tokensNeeded,
        currentBalance
      }, { status: 402 });
    }

    // Deduct tokens
    const newBalance = currentBalance - tokensNeeded;
    await base44.auth.updateMe({ tokenBalance: newBalance });

    // Log transaction
    await base44.asServiceRole.entities.TokenTransaction.create({
      userId: user.id,
      action,
      tokensDeducted: tokensNeeded,
      remainingBalance: newBalance,
      sessionId: sessionId || 'unknown'
    });

    return Response.json({ 
      success: true,
      tokensDeducted: tokensNeeded,
      remainingBalance: newBalance,
      showUpgradePrompt: newBalance <= 20
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});