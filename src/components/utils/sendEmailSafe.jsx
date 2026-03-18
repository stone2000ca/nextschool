/**
 * E18b-002: Centralized email dispatch gate
 * Prevents actual email sends in test mode
 */

export async function sendEmailSafe({ from_name, to, subject, body, test_mode = false, test_scenario = null }) {
  // E18b-002: Test mode check - block email
  if (test_mode) {
    console.log('[sendEmailSafe] TEST MODE - email blocked:', { to, subject, test_scenario });
    return { sent: false, blocked: true, reason: 'test_blocked' };
  }
  
  // Normal send
  const { sendEmail } = await import('@/lib/integrations');
  await sendEmail({ from_name, to, subject, body });
  return { sent: true };
}