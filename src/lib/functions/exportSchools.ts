// Function: exportSchools
// Purpose: Export all schools as JSON
// Entities: School
// Last Modified: 2026-03-01

import { School } from '@/lib/entities-server'

export async function exportSchoolsLogic() {
  // Fetch all schools — entities-server list() signature is (sort?, filter?, limit?)
  // Use a large limit to get all schools in one call
  const allSchools = await School.list(undefined, undefined, 10000);
  return allSchools;
}
