import { SchoolClaim, SchoolAdmin, School } from '@/lib/entities-server'

const MAX_ATTEMPTS = 5;

export async function verifyClaimCode(params: {
  claimId: string
  code: string
  userId: string
}) {
  const { claimId, code, userId } = params;

  if (!userId) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }

  if (!claimId || !code) {
    throw Object.assign(new Error('claimId and code are required'), { statusCode: 400 });
  }

  // Fetch the claim server-side — never trust client
  const claims = await SchoolClaim.filter({ id: claimId });
  if (!claims || claims.length === 0) {
    throw Object.assign(new Error('Claim not found'), { statusCode: 404 });
  }
  const claim = claims[0] as any;

  // Ensure the claim belongs to the requesting user
  if (claim.userId !== userId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  // Check if already verified
  if (claim.status === 'verified') {
    return { success: false, error: 'This claim has already been verified.' };
  }

  // Check lock
  if (claim.lockedAt) {
    return {
      success: false,
      error: 'Too many failed attempts. This claim has been locked. Please contact support@nextschool.ca.'
    };
  }

  // Check attempt count
  const attemptCount = claim.attemptCount ?? 0;
  if (attemptCount >= MAX_ATTEMPTS) {
    // Lock the claim
    await SchoolClaim.update(claimId, {
      lockedAt: new Date().toISOString()
    });
    return {
      success: false,
      error: 'Too many failed attempts. This claim has been locked. Please contact support@nextschool.ca.'
    };
  }

  // Check expiry
  if (!claim.codeExpiresAt || new Date() > new Date(claim.codeExpiresAt)) {
    return { success: false, error: 'Verification code has expired. Please request a new one.' };
  }

  // Compare code (constant-time-ish string comparison)
  if (String(code).trim() !== String(claim.verificationCode).trim()) {
    const newAttemptCount = attemptCount + 1;
    const updatePayload: any = { attemptCount: newAttemptCount };
    if (newAttemptCount >= MAX_ATTEMPTS) {
      updatePayload.lockedAt = new Date().toISOString();
    }
    await SchoolClaim.update(claimId, updatePayload);

    const remaining = MAX_ATTEMPTS - newAttemptCount;
    if (remaining <= 0) {
      return {
        success: false,
        error: 'Too many failed attempts. This claim has been locked. Please contact support@nextschool.ca.'
      };
    }
    return {
      success: false,
      error: `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
    };
  }

  // --- Code is correct — promote claim ---

  // Step 1: Update SchoolClaim to verified
  await SchoolClaim.update(claimId, {
    status: 'verified',
    verifiedAt: new Date().toISOString(),
    attemptCount: attemptCount + 1  // record this final successful attempt
  });

  // Step 2: Create SchoolAdmin record (revert claim on failure)
  try {
    await SchoolAdmin.create({
      schoolId: claim.schoolId,
      userId: claim.userId,
      claimId: claimId,
      role: 'owner',
      isActive: true
    });
  } catch (adminErr: any) {
    // Revert SchoolClaim status
    console.error('SchoolAdmin.create failed, reverting SchoolClaim:', adminErr.message);
    await SchoolClaim.update(claimId, {
      status: 'pending_email',
      verifiedAt: null
    });
    throw Object.assign(new Error('Verification failed during account setup. Please try again.'), { statusCode: 500 });
  }

  // Step 3: Update School (least critical — log if fails but don't revert)
  try {
    await School.update(claim.schoolId, {
      claimStatus: 'claimed',
      schoolTier: 'free'
    });
  } catch (schoolErr: any) {
    console.error('School.update failed after successful claim (non-fatal):', schoolErr.message);
  }

  return { success: true };
}
