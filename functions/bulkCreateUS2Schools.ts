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

    const importBatchId = `us2_nais_nces_${Date.now()}`;

    // 30 additional US independent schools
    const schoolsData = [
      // Southern US
      { name: 'Woodward Academy', city: 'College Park', state: 'Georgia', zipCode: '30337', phone: '404-765-4000', website: 'www.woodward.edu', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Westminster Schools', city: 'Atlanta', state: 'Georgia', zipCode: '30327', phone: '404-355-8673', website: 'www.westminster.net', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Lovett School', city: 'Atlanta', state: 'Georgia', zipCode: '30327', phone: '404-262-3032', website: 'www.lovett.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'McCallie School', city: 'Chattanooga', state: 'Tennessee', zipCode: '37404', phone: '423-624-8300', website: 'www.mccallie.org', gradeRange: '6-12', gender: 'Boys', boarding: 'Day/Boarding' },
      { name: 'Baylor School', city: 'Chattanooga', state: 'Tennessee', zipCode: '37405', phone: '423-267-8506', website: 'www.baylorschool.org', gradeRange: '6-12', gender: 'Co-ed', boarding: 'Day/Boarding' },
      { name: 'Memphis University School', city: 'Memphis', state: 'Tennessee', zipCode: '38119', phone: '901-260-1300', website: 'www.musowls.org', gradeRange: '7-12', gender: 'Boys', boarding: 'Day' },
      { name: 'Palm Beach Day Academy', city: 'Palm Beach', state: 'Florida', zipCode: '33480', phone: '561-655-1188', website: 'www.pbday.org', gradeRange: 'PK-9', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Pine Crest School', city: 'Fort Lauderdale', state: 'Florida', zipCode: '33334', phone: '954-492-4100', website: 'www.pinecrest.edu', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Ransom Everglades School', city: 'Miami', state: 'Florida', zipCode: '33133', phone: '305-460-8800', website: 'www.ransomeverglades.org', gradeRange: '6-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'St. Mark\'s School of Texas', city: 'Dallas', state: 'Texas', zipCode: '75230', phone: '214-346-8000', website: 'www.smtexas.org', gradeRange: '1-12', gender: 'Boys', boarding: 'Day' },
      
      // Midwest US
      { name: 'University School', city: 'Hunting Valley', state: 'Ohio', zipCode: '44022', phone: '216-831-2200', website: 'www.us.edu', gradeRange: 'PK-12', gender: 'Boys', boarding: 'Day' },
      { name: 'Hawken School', city: 'Gates Mills', state: 'Ohio', zipCode: '44040', phone: '440-423-4446', website: 'www.hawken.edu', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Cincinnati Country Day School', city: 'Cincinnati', state: 'Ohio', zipCode: '45243', phone: '513-979-0220', website: 'www.countryday.net', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Detroit Country Day School', city: 'Beverly Hills', state: 'Michigan', zipCode: '48025', phone: '248-646-7717', website: 'www.dcds.edu', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'University Liggett School', city: 'Grosse Pointe Woods', state: 'Michigan', zipCode: '48236', phone: '313-884-4444', website: 'www.uls.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Blake School', city: 'Hopkins', state: 'Minnesota', zipCode: '55343', phone: '952-988-3420', website: 'www.blakeschool.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Breck School', city: 'Golden Valley', state: 'Minnesota', zipCode: '55422', phone: '763-381-8100', website: 'www.breckschool.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Francis Parker School', city: 'Chicago', state: 'Illinois', zipCode: '60614', phone: '773-353-3000', website: 'www.fwparker.org', gradeRange: 'JK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'North Shore Country Day School', city: 'Winnetka', state: 'Illinois', zipCode: '60093', phone: '847-446-0674', website: 'www.nscds.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Lake Forest Academy', city: 'Lake Forest', state: 'Illinois', zipCode: '60045', phone: '847-615-3210', website: 'www.lfanet.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      
      // West Coast US
      { name: 'Menlo School', city: 'Atherton', state: 'California', zipCode: '94027', phone: '650-330-2001', website: 'www.menloschool.org', gradeRange: '6-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Lick-Wilmerding High School', city: 'San Francisco', state: 'California', zipCode: '94112', phone: '415-333-4021', website: 'www.lwhs.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Head-Royce School', city: 'Oakland', state: 'California', zipCode: '94602', phone: '510-531-1300', website: 'www.headroyce.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Polytechnic School', city: 'Pasadena', state: 'California', zipCode: '91106', phone: '626-396-6300', website: 'www.polytechnic.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Buckley School', city: 'Sherman Oaks', state: 'California', zipCode: '91423', phone: '818-783-2200', website: 'www.buckley.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Catlin Gabel School', city: 'Portland', state: 'Oregon', zipCode: '97225', phone: '503-297-1894', website: 'www.catlin.edu', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Oregon Episcopal School', city: 'Portland', state: 'Oregon', zipCode: '97223', phone: '503-246-7771', website: 'www.oes.edu', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day/Boarding' },
      { name: 'Annie Wright Schools', city: 'Tacoma', state: 'Washington', zipCode: '98403', phone: '253-272-2216', website: 'www.aw.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day/Boarding' },
      { name: 'Bush School', city: 'Seattle', state: 'Washington', zipCode: '98112', phone: '206-322-7978', website: 'www.bush.edu', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'University Prep', city: 'Seattle', state: 'Washington', zipCode: '98115', phone: '206-525-2714', website: 'www.universityprep.org', gradeRange: '6-12', gender: 'Co-ed', boarding: 'Day' }
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
        country: 'United States',
        region: 'United States',
        zipCode: school.zipCode,
        phone: school.phone,
        website: school.website,
        email: '',
        lowestGrade,
        highestGrade,
        dataSource: 'nais_nces',
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

    console.log(`Importing ${schools.length} US independent schools...`);

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