import { EmailLog } from '@/lib/entities';
import { invokeFunction } from '@/lib/functions';

/**
 * Centralized email sending wrapper for school-related emails.
 * Checks school claim status and logs all email attempts.
 *
 * @param {Object} config
 * @param {string} config.type - Email type (tour_request, contact, etc.)
 * @param {Object} config.school - School object (optional, for claim status check)
 * @param {string} config.to - Recipient email address
 * @param {string} config.subject - Email subject line
 * @param {string} config.body - Email body (HTML or plain text)
 * @param {string} config.fromName - Sender display name (default: 'NextSchool')
 * @param {string} config.userId - User ID (optional, for logging)
 * @param {string} config.inquiryId - SchoolInquiry ID (optional, for logging)
 * @param {string} config.conversationId - Conversation ID (optional, for logging)
 * @param {boolean} config.test_mode - Test mode flag (default: false)
 * @param {string} config.test_scenario - Test scenario identifier (optional, for logging)
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
export async function sendSchoolEmail({
  type,
  school,
  to,
  subject,
  body,
  fromName = 'NextSchool',
  userId,
  inquiryId,
  conversationId,
  test_mode = false,
  test_scenario = null,
}) {
  const schoolId = school?.id;
  const claimStatus = school?.claimStatus;

  // E18b-001: Test mode check - block email and log as test_blocked
  if (test_mode) {
    try {
      await EmailLog.create({
        type,
        to,
        from_name: fromName,
        subject,
        school_id: schoolId,
        user_id: userId,
        inquiry_id: inquiryId,
        conversation_id: conversationId,
        claim_status: claimStatus,
        status: 'blocked_test',
        is_test: true,
        test_scenario,
      });
    } catch (err) {
      console.error('Failed to log test-blocked email:', err);
    }
    return { sent: true, reason: 'test_blocked' };
  }

  // WC4: Block emails to unclaimed schools (first layer check)
  if (school && school.claimStatus !== 'claimed') {
    try {
      await EmailLog.create({
        type,
        to,
        from_name: fromName,
        subject,
        school_id: schoolId,
        user_id: userId,
        inquiry_id: inquiryId,
        conversation_id: conversationId,
        claim_status: claimStatus,
        status: 'blocked_unclaimed',
        is_test: false,
        test_scenario: null,
      });
    } catch (err) {
      console.error('Failed to log blocked email:', err);
    }
    return { sent: false, reason: 'unclaimed' };
  }

  // Attempt to send email
  try {
    await invokeFunction('sendEmail', {
      from_name: fromName,
      to,
      subject,
      body,
    });

    // Log success
    try {
      await EmailLog.create({
        type,
        to,
        from_name: fromName,
        subject,
        school_id: schoolId,
        user_id: userId,
        inquiry_id: inquiryId,
        conversation_id: conversationId,
        claim_status: claimStatus,
        status: 'sent',
        is_test: false,
        test_scenario: null,
      });
    } catch (logErr) {
      console.error('Failed to log sent email:', logErr);
    }

    return { sent: true };
  } catch (error) {
    // Log failure
    try {
      await EmailLog.create({
        type,
        to,
        from_name: fromName,
        subject,
        school_id: schoolId,
        user_id: userId,
        inquiry_id: inquiryId,
        conversation_id: conversationId,
        claim_status: claimStatus,
        status: 'failed',
        error_message: error.message,
        is_test: false,
        test_scenario: null,
      });
    } catch (logErr) {
      console.error('Failed to log failed email:', logErr);
    }

    // Re-throw the error
    throw error;
  }
}