import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const generateSlug = (schoolName) => {
  return schoolName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const parseGradeRange = (gradeStr) => {
  if (!gradeStr) return { lowestGrade: null, highestGrade: null };
  
  const range = gradeStr.split('-');
  let lowest = null;
  let highest = null;
  
  if (range.length === 2) {
    const first = range[0].trim().toLowerCase();
    const second = range[1].trim();
    
    if (first === 'k' || first === 'jk' || first === 'pk') lowest = 0;
    else lowest = parseInt(first) || null;
    
    highest = parseInt(second) || null;
  }
  
  return { lowestGrade: lowest, highestGrade: highest };
};

const mapGenderPolicy = (genderStr) => {
  const gender = genderStr?.trim().toLowerCase();
  if (gender === 'boys') return 'All-Boys';
  if (gender === 'girls') return 'All-Girls';
  if (gender === 'co-ed') return 'Co-ed';
  return 'Co-ed';
};

const mapBoardingType = (boardingStr) => {
  const boarding = boardingStr?.trim().toLowerCase();
  if (boarding === 'boarding') return 'full';
  if (boarding === 'day') return 'day';
  if (boarding === 'day/boarding') return 'weekly';
  return null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const importBatchId = `ca_maritime_prairie_${Date.now()}`;

    // 20 Canadian schools from Maritime & Prairie provinces
    const schoolsData = [
      // Manitoba
      { name: 'St. John\'s-Ravenscourt School', city: 'Winnipeg', state: 'Manitoba', postalCode: 'R3T 3K5', phone: '204-477-2400', website: 'www.sjr.mb.ca', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day/Boarding', dataSource: 'manitoba_education' },
      { name: 'Balmoral Hall School', city: 'Winnipeg', state: 'Manitoba', postalCode: 'R3C 3S1', phone: '204-784-1600', website: 'www.balmoralhall.com', gradeRange: 'PK-12', gender: 'Girls', boarding: 'Day/Boarding', dataSource: 'manitoba_education' },
      { name: 'St. Mary\'s Academy', city: 'Winnipeg', state: 'Manitoba', postalCode: 'R3M 0C1', phone: '204-477-0244', website: 'www.stmarysacademy.mb.ca', gradeRange: '7-12', gender: 'Girls', boarding: 'Day', dataSource: 'manitoba_education' },
      { name: 'Mennonite Brethren Collegiate Institute', city: 'Winnipeg', state: 'Manitoba', postalCode: 'R2L 0P6', phone: '204-667-8210', website: 'www.mbci.mb.ca', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'manitoba_education' },
      { name: 'Westgate Mennonite Collegiate', city: 'Winnipeg', state: 'Manitoba', postalCode: 'R3C 2E1', phone: '204-775-7111', website: 'www.westgatemennonite.org', gradeRange: '7-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'manitoba_education' },
      { name: 'Gray Academy of Jewish Education', city: 'Winnipeg', state: 'Manitoba', postalCode: 'R3N 2B3', phone: '204-477-7410', website: 'www.grayacademy.ca', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'manitoba_education' },
      { name: 'Linden Christian School', city: 'Winnipeg', state: 'Manitoba', postalCode: 'R3P 1B8', phone: '204-489-2115', website: 'www.lindenchristian.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'manitoba_education' },
      
      // Saskatchewan
      { name: 'Luther College High School', city: 'Regina', state: 'Saskatchewan', postalCode: 'S4T 5A5', phone: '306-791-9150', website: 'www.luthercollege.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding', dataSource: 'saskatchewan_education' },
      { name: 'Athol Murray College of Notre Dame', city: 'Wilcox', state: 'Saskatchewan', postalCode: 'S0G 5E0', phone: '306-732-2080', website: 'www.notredame.ca', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding', dataSource: 'saskatchewan_education' },
      { name: 'Harvest City Christian Academy', city: 'Regina', state: 'Saskatchewan', postalCode: 'S4N 5W1', phone: '306-775-2833', website: 'www.harvestcity.ca', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'saskatchewan_education' },
      
      // Nova Scotia
      { name: 'King\'s-Edgehill School', city: 'Windsor', state: 'Nova Scotia', postalCode: 'B0N 2T0', phone: '902-798-2278', website: 'www.kes.ns.ca', gradeRange: '6-12', gender: 'Co-ed', boarding: 'Boarding', dataSource: 'nova_scotia_education' },
      { name: 'Halifax Grammar School', city: 'Halifax', state: 'Nova Scotia', postalCode: 'B3H 2Y2', phone: '902-423-9337', website: 'www.hgs.ns.ca', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'nova_scotia_education' },
      { name: 'Sacred Heart School of Halifax', city: 'Halifax', state: 'Nova Scotia', postalCode: 'B3H 1Y3', phone: '902-422-4459', website: 'www.shsh.ca', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'nova_scotia_education' },
      { name: 'Armbrae Academy', city: 'Halifax', state: 'Nova Scotia', postalCode: 'B3H 3Y8', phone: '902-423-6050', website: 'www.armbrae.ns.ca', gradeRange: 'PK-8', gender: 'Co-ed', boarding: 'Day', dataSource: 'nova_scotia_education' },
      { name: 'Shambhala School', city: 'Halifax', state: 'Nova Scotia', postalCode: 'B3K 1W8', phone: '902-423-4432', website: 'www.shambhalaschool.org', gradeRange: 'PK-6', gender: 'Co-ed', boarding: 'Day', dataSource: 'nova_scotia_education' },
      
      // New Brunswick
      { name: 'Rothesay Netherwood School', city: 'Rothesay', state: 'New Brunswick', postalCode: 'E2E 5H1', phone: '506-847-8224', website: 'www.rns.cc', gradeRange: '6-12', gender: 'Co-ed', boarding: 'Boarding', dataSource: 'new_brunswick_education' },
      { name: 'Moncton Flight College Academy', city: 'Dieppe', state: 'New Brunswick', postalCode: 'E1A 7Z5', phone: '506-858-4000', website: 'www.mfc.nb.ca', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'new_brunswick_education' },
      
      // Prince Edward Island
      { name: 'Grace Christian School', city: 'Charlottetown', state: 'Prince Edward Island', postalCode: 'C1A 2J2', phone: '902-628-1668', website: 'www.gracechristian.ca', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'pei_education' },
      
      // Newfoundland and Labrador
      { name: 'St. Bonaventure\'s College', city: 'St. John\'s', state: 'Newfoundland and Labrador', postalCode: 'A1B 1A3', phone: '709-726-0024', website: 'www.stbons.ca', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day', dataSource: 'nl_education' },
      { name: 'Lakecrest Independent School', city: 'St. John\'s', state: 'Newfoundland and Labrador', postalCode: 'A1E 2S7', phone: '709-738-1212', website: 'www.lakecrest.ca', gradeRange: 'PK-6', gender: 'Co-ed', boarding: 'Day', dataSource: 'nl_education' }
    ];

    // Transform schools with required fields
    const schools = schoolsData.map(school => {
      const { lowestGrade, highestGrade } = parseGradeRange(school.gradeRange);
      const boardingType = mapBoardingType(school.boarding);
      
      return {
        name: school.name,
        slug: generateSlug(school.name),
        address: '',
        city: school.city,
        provinceState: school.state,
        country: 'Canada',
        region: 'Canada',
        postalCode: school.postalCode,
        phone: school.phone,
        website: school.website,
        email: '',
        lowestGrade,
        highestGrade,
        dataSource: school.dataSource,
        governmentId: '',
        schoolType: school.boarding === 'Boarding' ? 'Boarding School' : 'Day School',
        genderPolicy: mapGenderPolicy(school.gender),
        boardingAvailable: school.boarding !== 'Day',
        boardingType: boardingType,
        gradeSystem: 'north_american',
        status: 'active',
        importBatchId,
        verified: false,
        missionStatement: `Top independent school in ${school.state}`
      };
    });

    console.log(`Importing ${schools.length} Canadian schools from Maritime & Prairie provinces...`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Bulk create schools in batches
    for (let i = 0; i < schools.length; i += 10) {
      const batch = schools.slice(i, i + 10);
      
      for (const school of batch) {
        try {
          if (!school.name || !school.city || !school.country) {
            skipped++;
            errors.push({
              schoolName: school.name || 'Unknown',
              error: 'Missing required fields'
            });
            continue;
          }

          // Check if school already exists (by slug and city)
          const matches = await base44.asServiceRole.entities.School.filter({
            slug: school.slug,
            city: school.city
          });
          const existing = matches?.[0];

          if (existing) {
            // Update existing
            await base44.asServiceRole.entities.School.update(existing.id, {
              ...school,
              importBatchId,
              lastEnriched: new Date().toISOString()
            });
            updated++;
          } else {
            // Create new
            await base44.asServiceRole.entities.School.create({
              ...school,
              importBatchId,
              lastEnriched: new Date().toISOString()
            });
            created++;
          }
        } catch (error) {
          skipped++;
          errors.push({
            schoolName: school.name,
            error: error.message
          });
        }
      }
    }

    return Response.json({
      success: true,
      importBatchId,
      totalSchools: schools.length,
      results: {
        created,
        updated,
        skipped,
        total: schools.length,
        errors: errors.length > 0 ? errors : null
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});