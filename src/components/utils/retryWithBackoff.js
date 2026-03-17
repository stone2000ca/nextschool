/**
 * Retries an async function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} options.maxAttempts - Maximum number of attempts (default 3)
 * @param {number} options.baseDelay - Base delay in ms (default 500)
 * @returns {Promise<*>} Result of fn on success
 */
export async function retryWithBackoff(fn, options = {}) {
  const { maxAttempts = 3, baseDelay = 500 } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(`[E42-PERSIST] All ${maxAttempts} attempts failed. Last error:`, err);
        throw err;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`[E42-PERSIST] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`, err.message || err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
