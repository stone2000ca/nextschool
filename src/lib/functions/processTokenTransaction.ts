import { TokenTransaction } from '@/lib/entities-server'

// Token costs
const tokenCosts: Record<string, number> = {
  message_sent: 1,
  recommendations: 2,
  comparison_generated: 3,
  deep_analysis: 5,
  pdf_export: 2
};

export async function processTokenTransaction(params: {
  action: string
  sessionId?: string
  user: any // authenticated user object passed from route
}) {
  const { action, sessionId, user } = params;

  if (!user) {
    throw Object.assign(new Error('User not authenticated'), { statusCode: 401 });
  }

  // Check if premium user (unlimited tokens)
  if (user.subscription_plan === 'premium') {
    return {
      success: true,
      unlimited: true,
      remainingBalance: 999999
    };
  }

  const tokensNeeded = tokenCosts[action] || 1;
  const currentBalance = user.token_balance || 0;

  // Check if enough tokens
  if (currentBalance < tokensNeeded) {
    throw Object.assign(new Error('Insufficient tokens'), {
      statusCode: 402,
      details: {
        needsUpgrade: true,
        tokensNeeded,
        currentBalance
      }
    });
  }

  // Deduct tokens
  const newBalance = currentBalance - tokensNeeded;
  // NOTE: user balance update must be handled by the caller (route handler) since
  // the auth.updateMe pattern doesn't exist in the entity layer.
  // The route handler should update the user record directly.

  // Log transaction
  await TokenTransaction.create({
    user_id: user.id,
    action,
    tokens_deducted: tokensNeeded,
    remaining_balance: newBalance,
    session_id: sessionId || 'unknown'
  });

  return {
    success: true,
    tokensDeducted: tokensNeeded,
    remainingBalance: newBalance,
    showUpgradePrompt: newBalance <= 20
  };
}
