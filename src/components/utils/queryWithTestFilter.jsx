/**
 * E18a-002: Test record filtering utilities
 * Provides query wrappers to exclude test emails/logs from production queries
 */

/**
 * E18a-002: queryEntityExcludingTests
 * Wraps entity.filter() and automatically appends is_test: false filter by default.
 *
 * @param {Object} entityRef - Entity reference (e.g., EmailLog from '@/lib/entities')
 * @param {Object} filterParams - Filter parameters object (default: {})
 * @param {Object} options - Query options
 * @param {boolean} options.include_test - If true, skip the is_test filter (default: false)
 * @param {string} options.sortKey - Sort key for entity.filter()
 * @param {number} options.limit - Result limit for entity.filter()
 * @returns {Promise<Array>} Filtered records
 */
export async function queryEntityExcludingTests(
  entityRef,
  filterParams = {},
  options = {}
) {
  const { include_test = false, sortKey, limit } = options;

  // Build final filter params: append is_test: false unless include_test is true
  const finalFilterParams = include_test ? filterParams : { ...filterParams, is_test: false };

  // Call entity.filter() with the combined parameters
  return await entityRef.filter(finalFilterParams, sortKey, limit);
}

/**
 * E18a-002: excludeTestRecords
 * Takes an array of records and returns only those where is_test is falsy.
 * Useful for post-processing pre-fetched or joined data.
 *
 * @param {Array} records - Array of records to filter
 * @returns {Array} Records where is_test !== true
 */
export function excludeTestRecords(records) {
  return records.filter((record) => record.is_test !== true);
}