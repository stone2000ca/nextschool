import { School } from '@/lib/entities-server'

export async function fetchSchoolProfile(params: { schoolId: string }) {
  const { schoolId } = params;

  const schools = await School.filter({ id: schoolId });

  if (!schools || schools.length === 0) {
    throw Object.assign(new Error('School not found'), { statusCode: 404 });
  }

  const school = schools[0] as any;

  // Currency symbols by region/currency
  const currencySymbols: Record<string, string> = {
    CAD: 'CA$',
    USD: '$',
    EUR: '\u20AC',
    GBP: '\u00A3'
  };

  // Format tuition with currency symbol
  const formattedTuition = school.tuition
    ? `${currencySymbols[school.currency] || '$'}${school.tuition.toLocaleString()}`
    : 'Contact for pricing';

  // Grade range display
  const gradeRangeDisplay = school.grades_served ||
    (school.lowest_grade !== undefined && school.highest_grade !== undefined
      ? `Grade ${school.lowest_grade} - ${school.highest_grade}`
      : 'N/A');

  // Program counts
  const programCounts = {
    arts: school.arts_programs?.length || 0,
    sports: school.sports_programs?.length || 0,
    clubs: school.clubs?.length || 0,
    languages: school.languages?.length || 0,
    specialEd: school.special_ed_programs?.length || 0
  };

  // Total programs offered
  const totalPrograms = Object.values(programCounts).reduce((sum: number, count: number) => sum + count, 0);

  // Enriched school object
  const enrichedSchool = {
    ...school,
    display: {
      formattedTuition,
      gradeRangeDisplay,
      programCounts,
      totalPrograms,
      currencySymbol: currencySymbols[school.currency] || '$',
      hasFinancialAid: school.financial_aid_available ? 'Yes' : 'No',
      boardingStatus: school.boarding_available
        ? (school.boarding_type || 'Available')
        : 'Day school only',
      studentTeacherRatioDisplay: school.student_teacher_ratio || 'N/A',
      avgClassSizeDisplay: school.avg_class_size ? `${school.avg_class_size} students` : 'N/A',
      enrollmentDisplay: school.enrollment ? `${school.enrollment} students` : 'N/A',
      foundedDisplay: school.founded ? `Est. ${school.founded}` : 'N/A'
    }
  };

  return enrichedSchool;
}
