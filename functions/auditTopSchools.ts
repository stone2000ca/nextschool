import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const topSchools = [
      'Upper Canada College',
      'Branksome Hall',
      'Havergal College',
      'Bishop Strachan School',
      'Crescent School',
      'Appleby College',
      'Ridley College',
      'Lakefield College School',
      "St. Andrew's College",
      'Trinity College School',
      'Hillfield Strathallan College',
      "Royal St. George's College",
      "St. Clement's School",
      'The York School',
      'Greenwood College School',
      'Bayview Glen',
      'Pickering College',
      'The Country Day School',
      'Albert College',
      'Trafalgar Castle School',
      'De La Salle College',
      "St. Michael's College School",
      'Toronto French School',
      'Montcrest School',
      'Sterling Hall School',
      "Fieldstone King's College School",
      'Villanova College',
      'Holy Trinity School',
      'Crestwood Preparatory College',
      'Hudson College'
    ];

    const auditResults = [];
    const issues = [];

    for (const schoolName of topSchools) {
      try {
        const schools = await base44.asServiceRole.entities.School.filter({
          name: { $regex: schoolName.replace(/'/g, "'"), $options: 'i' }
        });

        if (schools.length === 0) {
          issues.push({
            school: schoolName,
            severity: 'CRITICAL',
            issue: 'School not found in database'
          });
          continue;
        }

        const school = schools[0];
        const schoolIssues = [];

        // Verify required fields
        if (!school.lowestGrade && school.lowestGrade !== 0) {
          schoolIssues.push('Missing lowestGrade');
        }
        if (!school.highestGrade && school.highestGrade !== 0) {
          schoolIssues.push('Missing highestGrade');
        }
        if (!school.dayTuition) {
          schoolIssues.push('Missing dayTuition');
        }
        if (school.boardingAvailable && !school.boardingTuition) {
          schoolIssues.push('Boarding available but no boardingTuition set');
        }
        if (!school.genderPolicy) {
          schoolIssues.push('Missing genderPolicy');
        }
        if (!school.curriculumType) {
          schoolIssues.push('Missing curriculumType');
        }
        if (!school.city) {
          schoolIssues.push('Missing city');
        }
        if (!school.provinceState) {
          schoolIssues.push('Missing provinceState');
        }

        // Check suspicious data
        if (school.dayTuition && (school.dayTuition < 10000 || school.dayTuition > 60000)) {
          schoolIssues.push(`Suspicious dayTuition: $${school.dayTuition} (expected $10K-$60K)`);
        }
        if (school.lowestGrade > school.highestGrade) {
          schoolIssues.push(`Invalid grade range: ${school.lowestGrade} to ${school.highestGrade}`);
        }
        if (!school.lat || !school.lng) {
          schoolIssues.push('Missing coordinates (lat/lng)');
        }

        auditResults.push({
          school: school.name,
          id: school.id,
          lowestGrade: school.lowestGrade,
          highestGrade: school.highestGrade,
          dayTuition: school.dayTuition,
          boardingTuition: school.boardingTuition,
          genderPolicy: school.genderPolicy,
          curriculumType: school.curriculumType,
          religiousAffiliation: school.religiousAffiliation,
          city: school.city,
          provinceState: school.provinceState,
          issues: schoolIssues
        });

        if (schoolIssues.length > 0) {
          issues.push({
            school: school.name,
            severity: 'WARNING',
            issues: schoolIssues
          });
        }
      } catch (error) {
        issues.push({
          school: schoolName,
          severity: 'ERROR',
          issue: `Error fetching school: ${error.message}`
        });
      }
    }

    // Log summary
    console.log('=== AUDIT SUMMARY ===');
    console.log(`Total schools audited: ${topSchools.length}`);
    console.log(`Schools found: ${auditResults.length}`);
    console.log(`Schools with issues: ${issues.length}`);
    console.log('\n=== ISSUES FOUND ===');
    issues.forEach(issue => {
      console.log(`[${issue.severity}] ${issue.school}:`);
      if (Array.isArray(issue.issues)) {
        issue.issues.forEach(i => console.log(`  - ${i}`));
      } else {
        console.log(`  - ${issue.issue}`);
      }
    });

    return Response.json({
      summary: {
        totalSchools: topSchools.length,
        schoolsFound: auditResults.length,
        schoolsWithIssues: issues.length
      },
      auditResults,
      issues
    });
  } catch (error) {
    console.error('Audit failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});