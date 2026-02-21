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

    const importBatchId = `quebec_meq_${Date.now()}`;

    // 20 Quebec independent schools data
    const schoolsData = [
      { name: 'Lower Canada College', city: 'Montreal', postalCode: 'H4A 2M5', phone: '514-482-0951', website: 'www.lcc.ca', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Selwyn House School', city: 'Westmount', postalCode: 'H3Y 2H8', phone: '514-931-9481', website: 'www.selwyn.ca', gradeRange: 'K-11', gender: 'Boys', boarding: 'Day' },
      { name: 'The Study School', city: 'Westmount', postalCode: 'H3Y 1S4', phone: '514-935-9352', website: 'www.thestudy.qc.ca', gradeRange: 'K-11', gender: 'Girls', boarding: 'Day' },
      { name: 'Miss Edgar\'s and Miss Cramp\'s School', city: 'Westmount', postalCode: 'H3Y 3H6', phone: '514-935-6357', website: 'www.ecs.qc.ca', gradeRange: 'K-11', gender: 'Girls', boarding: 'Day' },
      { name: 'Bishop\'s College School', city: 'Sherbrooke', postalCode: 'J1M 1Z8', phone: '819-566-0227', website: 'www.bishopscollegeschool.com', gradeRange: '7-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Stanstead College', city: 'Stanstead', postalCode: 'J0B 3E0', phone: '819-876-2223', website: 'www.stansteadcollege.com', gradeRange: '7-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Sacred Heart School of Montreal', city: 'Montreal', postalCode: 'H3H 1Y4', phone: '514-937-2845', website: 'www.sacredheart.qc.ca', gradeRange: 'K-11', gender: 'Girls', boarding: 'Day' },
      { name: 'Kells Academy', city: 'Montreal', postalCode: 'H4B 1T1', phone: '514-485-8565', website: 'www.kells.ca', gradeRange: '1-11', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Trafalgar School for Girls', city: 'Montreal', postalCode: 'H3G 2J7', phone: '514-935-2644', website: 'www.trafalgar.qc.ca', gradeRange: '7-11', gender: 'Girls', boarding: 'Day' },
      { name: 'College Jean-de-Brebeuf', city: 'Montreal', postalCode: 'H3T 1C1', phone: '514-342-9342', website: 'www.brebeuf.qc.ca', gradeRange: '7-13', gender: 'Co-ed', boarding: 'Day' },
      { name: 'College Notre-Dame', city: 'Montreal', postalCode: 'H3V 1A8', phone: '514-739-3371', website: 'www.cnda.qc.ca', gradeRange: '7-11', gender: 'Boys', boarding: 'Day' },
      { name: 'College Mont-Royal', city: 'Montreal', postalCode: 'H1L 5R3', phone: '514-351-2207', website: 'www.collegemontroyal.qc.ca', gradeRange: '7-11', gender: 'Co-ed', boarding: 'Day' },
      { name: 'College Sainte-Anne', city: 'Lachine', postalCode: 'H8S 2M8', phone: '514-637-3571', website: 'www.csadl.ca', gradeRange: '7-11', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Villa Maria', city: 'Montreal', postalCode: 'H4A 3K4', phone: '514-484-4950', website: 'www.villamaria.qc.ca', gradeRange: '7-11', gender: 'Girls', boarding: 'Day' },
      { name: 'Kuper Academy', city: 'Saint-Laurent', postalCode: 'H4S 1Y9', phone: '514-332-3010', website: 'www.kuperacademy.ca', gradeRange: 'PK-11', gender: 'Co-ed', boarding: 'Day' },
      { name: 'College de Montreal', city: 'Montreal', postalCode: 'H3H 1E3', phone: '514-933-7397', website: 'www.collegedemontreal.qc.ca', gradeRange: '7-11', gender: 'Boys', boarding: 'Day' },
      { name: 'Loyola High School', city: 'Montreal', postalCode: 'H4B 1R2', phone: '514-486-1101', website: 'www.loyola.ca', gradeRange: '7-11', gender: 'Boys', boarding: 'Day' },
      { name: 'College Regina Assumpta', city: 'Montreal', postalCode: 'H2E 1R2', phone: '514-382-4747', website: 'www.cra.qc.ca', gradeRange: '7-11', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Pensionnat du Saint-Nom-de-Marie', city: 'Montreal', postalCode: 'H2V 2C5', phone: '514-735-5261', website: 'www.psnm.qc.ca', gradeRange: '7-11', gender: 'Girls', boarding: 'Day' },
      { name: 'College Charlemagne', city: 'Pierrefonds', postalCode: 'H8Z 2L4', phone: '514-626-2606', website: 'www.collegecharlemagne.com', gradeRange: 'PK-11', gender: 'Co-ed', boarding: 'Day' }
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
        provinceState: 'Quebec',
        country: 'Canada',
        region: 'Canada',
        postalCode: school.postalCode,
        phone: school.phone,
        website: school.website,
        email: '',
        lowestGrade,
        highestGrade,
        dataSource: 'quebec_meq',
        governmentId: '',
        schoolType: school.boarding === 'Boarding' ? 'Boarding School' : 'Day School',
        genderPolicy: mapGenderPolicy(school.gender),
        boardingAvailable: school.boarding !== 'Day',
        boardingType: boardingType,
        gradeSystem: 'north_american',
        status: 'active',
        importBatchId,
        verified: false,
        missionStatement: `Top independent school in Quebec`
      };
    });

    console.log(`Importing ${schools.length} Quebec schools...`);

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