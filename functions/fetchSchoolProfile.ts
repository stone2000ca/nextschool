import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { schoolId } = await req.json();

    const schools = await base44.entities.School.filter({ id: schoolId });
    
    if (!schools || schools.length === 0) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const school = schools[0];

    // Currency symbols by region/currency
    const currencySymbols = {
      CAD: 'CA$',
      USD: '$',
      EUR: '€',
      GBP: '£'
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
      specialEd: school.specialEdPrograms?.length || 0
    };

    // Total programs offered
    const totalPrograms = Object.values(programCounts).reduce((sum, count) => sum + count, 0);

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
          ? (school.boardingType || 'Available')
          : 'Day school only',
        student_teacher_ratioDisplay: school.student_teacher_ratio || 'N/A',
        avg_class_sizeDisplay: school.avg_class_size ? `${school.avg_class_size} students` : 'N/A',
        enrollmentDisplay: school.enrollment ? `${school.enrollment} students` : 'N/A',
        foundedDisplay: school.founded ? `Est. ${school.founded}` : 'N/A'
      }
    };

    return Response.json(enrichedSchool);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});