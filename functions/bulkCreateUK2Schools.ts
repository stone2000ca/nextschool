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
    const first = range[0].trim();
    const second = range[1].trim();
    
    lowest = parseInt(first) || null;
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

    const importBatchId = `uk2_independent_${Date.now()}`;

    // 30 additional UK independent schools
    const schoolsData = [
      // Scotland
      { name: 'Fettes College', city: 'Edinburgh', state: 'Scotland', postalCode: 'EH4 1QX', phone: '+44 131 332 2281', website: 'www.fettes.com', gradeRange: '7-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Gordonstoun', city: 'Elgin', state: 'Scotland', postalCode: 'IV30 5RF', phone: '+44 1343 837837', website: 'www.gordonstoun.org.uk', gradeRange: '6-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'George Watson\'s College', city: 'Edinburgh', state: 'Scotland', postalCode: 'EH10 5EG', phone: '+44 131 446 6000', website: 'www.gwc.org.uk', gradeRange: '3-18', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Edinburgh Academy', city: 'Edinburgh', state: 'Scotland', postalCode: 'EH3 5BL', phone: '+44 131 556 4603', website: 'www.edinburghacademy.org.uk', gradeRange: '3-18', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Loretto School', city: 'Musselburgh', state: 'Scotland', postalCode: 'EH21 7RE', phone: '+44 131 653 4444', website: 'www.loretto.com', gradeRange: '3-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Merchiston Castle School', city: 'Edinburgh', state: 'Scotland', postalCode: 'EH13 0PU', phone: '+44 131 312 2200', website: 'www.merchiston.co.uk', gradeRange: '7-18', gender: 'Boys', boarding: 'Boarding' },
      { name: 'St Leonards School', city: 'St Andrews', state: 'Scotland', postalCode: 'KY16 9QJ', phone: '+44 1334 472126', website: 'www.stleonards-fife.org', gradeRange: '5-18', gender: 'Co-ed', boarding: 'Day/Boarding' },
      { name: 'Robert Gordon\'s College', city: 'Aberdeen', state: 'Scotland', postalCode: 'AB10 1FE', phone: '+44 1224 646346', website: 'www.rgc.aberdeen.sch.uk', gradeRange: '3-18', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Glasgow Academy', city: 'Glasgow', state: 'Scotland', postalCode: 'G12 8HE', phone: '+44 141 334 8558', website: 'www.theglasgowacademy.org.uk', gradeRange: '3-18', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Strathallan School', city: 'Perth', state: 'Scotland', postalCode: 'PH2 9EG', phone: '+44 1738 812546', website: 'www.strathallan.co.uk', gradeRange: '9-18', gender: 'Co-ed', boarding: 'Boarding' },
      
      // Wales
      { name: 'Christ College Brecon', city: 'Brecon', state: 'Wales', postalCode: 'LD3 8AF', phone: '+44 1874 615440', website: 'www.christcollegebrecon.com', gradeRange: '7-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Atlantic College', city: 'Llantwit Major', state: 'Wales', postalCode: 'CF61 1WF', phone: '+44 1446 799000', website: 'www.atlanticcollege.org', gradeRange: '16-19', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Rydal Penrhos School', city: 'Colwyn Bay', state: 'Wales', postalCode: 'LL29 7BT', phone: '+44 1492 530155', website: 'www.rydalpenrhos.com', gradeRange: '3-18', gender: 'Co-ed', boarding: 'Day/Boarding' },
      { name: 'Howell\'s School Llandaff', city: 'Llandaff', state: 'Wales', postalCode: 'CF5 2YD', phone: '+44 29 2056 2019', website: 'www.howells-cardiff.gdst.net', gradeRange: '3-18', gender: 'Girls', boarding: 'Day' },
      { name: 'Monmouth School for Boys', city: 'Monmouth', state: 'Wales', postalCode: 'NP25 3XP', phone: '+44 1600 713143', website: 'www.habsmonmouth.org', gradeRange: '7-18', gender: 'Boys', boarding: 'Day/Boarding' },
      
      // England (additional)
      { name: 'Sevenoaks School', city: 'Sevenoaks', state: 'England', postalCode: 'TN13 1HU', phone: '+44 1732 455133', website: 'www.sevenoaksschool.org', gradeRange: '11-18', gender: 'Co-ed', boarding: 'Day/Boarding' },
      { name: 'Dulwich College', city: 'London', state: 'England', postalCode: 'SE21 7LD', phone: '+44 20 8693 3601', website: 'www.dulwich.org.uk', gradeRange: '7-18', gender: 'Boys', boarding: 'Day/Boarding' },
      { name: 'King\'s College School', city: 'Wimbledon', state: 'England', postalCode: 'SW19 4TT', phone: '+44 20 8255 5300', website: 'www.kcs.org.uk', gradeRange: '7-18', gender: 'Boys', boarding: 'Day' },
      { name: 'City of London School', city: 'London', state: 'England', postalCode: 'EC4V 3AL', phone: '+44 20 7489 0291', website: 'www.cityoflondonschool.org.uk', gradeRange: '10-18', gender: 'Boys', boarding: 'Day' },
      { name: 'Stowe School', city: 'Buckingham', state: 'England', postalCode: 'MK18 5EH', phone: '+44 1280 818000', website: 'www.stowe.co.uk', gradeRange: '13-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Oundle School', city: 'Oundle', state: 'England', postalCode: 'PE8 4EE', phone: '+44 1832 277100', website: 'www.oundleschool.org.uk', gradeRange: '11-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Shrewsbury School', city: 'Shrewsbury', state: 'England', postalCode: 'SY3 7BA', phone: '+44 1743 280500', website: 'www.shrewsbury.org.uk', gradeRange: '13-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Canford School', city: 'Wimborne', state: 'England', postalCode: 'BH21 3AD', phone: '+44 1202 847207', website: 'www.canford.com', gradeRange: '13-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Downe House', city: 'Thatcham', state: 'England', postalCode: 'RG18 9JJ', phone: '+44 1635 200286', website: 'www.downehouse.net', gradeRange: '11-18', gender: 'Girls', boarding: 'Boarding' },
      { name: 'Benenden School', city: 'Cranbrook', state: 'England', postalCode: 'TN17 4AA', phone: '+44 1580 240592', website: 'www.benenden.school', gradeRange: '11-18', gender: 'Girls', boarding: 'Boarding' },
      { name: 'Ampleforth College', city: 'York', state: 'England', postalCode: 'YO62 4ER', phone: '+44 1439 766000', website: 'www.ampleforth.org.uk', gradeRange: '13-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Repton School', city: 'Repton', state: 'England', postalCode: 'DE65 6FH', phone: '+44 1283 559200', website: 'www.repton.org.uk', gradeRange: '13-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Uppingham School', city: 'Uppingham', state: 'England', postalCode: 'LE15 9QE', phone: '+44 1572 822216', website: 'www.uppingham.co.uk', gradeRange: '13-18', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Wycombe Abbey', city: 'High Wycombe', state: 'England', postalCode: 'HP11 1PE', phone: '+44 1494 520381', website: 'www.wycombeabbey.com', gradeRange: '11-18', gender: 'Girls', boarding: 'Boarding' },
      { name: 'Cranleigh School', city: 'Cranleigh', state: 'England', postalCode: 'GU6 8QQ', phone: '+44 1483 273666', website: 'www.cranleigh.org', gradeRange: '13-18', gender: 'Co-ed', boarding: 'Boarding' }
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
        country: 'United Kingdom',
        region: 'United Kingdom',
        postalCode: school.postalCode,
        phone: school.phone,
        website: school.website,
        email: '',
        lowestGrade,
        highestGrade,
        dataSource: 'uk_isc_gias',
        governmentId: '',
        schoolType: school.boarding === 'Boarding' ? 'Boarding School' : 'Day School',
        genderPolicy: mapGenderPolicy(school.gender),
        boardingAvailable: school.boarding !== 'Day',
        boardingType: boardingType,
        gradeSystem: 'uk',
        status: 'active',
        importBatchId,
        verified: false,
        missionStatement: `Top independent school in ${school.state}`
      };
    });

    console.log(`Importing ${schools.length} UK independent schools...`);

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