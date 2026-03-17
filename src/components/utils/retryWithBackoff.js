/**
 * E42 Phase 2: Retry utility with exponential backoff for persistence operations.
 *
 * @param {() => Promise<*>} fn - Async function to retry
 * @param {object} options
 * @param {number} [options.maxAttempts=3] - Maximum number of attempts
 * @param {number} [options.baseDelay=500] - Base delay in ms (doubles each retry)
 * @returns {Promise<*>} Result of fn on success
 * @throws On final failure after all attempts exhausted
 */
export async function retryWithBackoff(fn, options = {}) {
  const { maxAttempts = 3, baseDelay = 500 } = options;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`[E42-PERSIST] Retry attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
