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
    
    // Convert K/JK/PK to grade 0
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

    const importBatchId = `us_nces_pss_${Date.now()}`;

    // 50 US independent schools data
    const schoolsData = [
      { name: 'Phillips Academy Andover', city: 'Andover', state: 'MA', postalCode: '01810', phone: '978-749-4000', website: 'www.andover.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Phillips Exeter Academy', city: 'Exeter', state: 'NH', postalCode: '03833', phone: '603-772-4311', website: 'www.exeter.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Choate Rosemary Hall', city: 'Wallingford', state: 'CT', postalCode: '06492', phone: '203-697-2000', website: 'www.choate.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Deerfield Academy', city: 'Deerfield', state: 'MA', postalCode: '01342', phone: '413-774-1400', website: 'www.deerfield.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'St. Paul\'s School', city: 'Concord', state: 'NH', postalCode: '03301', phone: '603-229-4600', website: 'www.sps.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Lawrenceville School', city: 'Lawrenceville', state: 'NJ', postalCode: '08648', phone: '609-895-2000', website: 'www.lawrenceville.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Hotchkiss School', city: 'Lakeville', state: 'CT', postalCode: '06039', phone: '860-435-2591', website: 'www.hotchkiss.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Groton School', city: 'Groton', state: 'MA', postalCode: '01450', phone: '978-448-7510', website: 'www.groton.org', gradeRange: '8-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Milton Academy', city: 'Milton', state: 'MA', postalCode: '02186', phone: '617-898-1798', website: 'www.milton.edu', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day/Boarding' },
      { name: 'Middlesex School', city: 'Concord', state: 'MA', postalCode: '01742', phone: '978-369-2550', website: 'www.mxschool.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Peddie School', city: 'Hightstown', state: 'NJ', postalCode: '08520', phone: '609-944-7500', website: 'www.peddie.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Loomis Chaffee School', city: 'Windsor', state: 'CT', postalCode: '06095', phone: '860-687-6000', website: 'www.loomischaffee.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Thacher School', city: 'Ojai', state: 'CA', postalCode: '93023', phone: '805-640-3210', website: 'www.thacher.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Cate School', city: 'Carpinteria', state: 'CA', postalCode: '93013', phone: '805-684-4127', website: 'www.cate.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Emma Willard School', city: 'Troy', state: 'NY', postalCode: '12180', phone: '518-833-1300', website: 'www.emmawillard.org', gradeRange: '9-12', gender: 'Girls', boarding: 'Boarding' },
      { name: 'Concord Academy', city: 'Concord', state: 'MA', postalCode: '01742', phone: '978-402-2250', website: 'www.concordacademy.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Episcopal High School', city: 'Alexandria', state: 'VA', postalCode: '22302', phone: '703-933-3000', website: 'www.episcopalhighschool.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Mercersburg Academy', city: 'Mercersburg', state: 'PA', postalCode: '17236', phone: '717-328-6173', website: 'www.mercersburg.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Blair Academy', city: 'Blairstown', state: 'NJ', postalCode: '07825', phone: '908-362-6121', website: 'www.blair.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Westminster School', city: 'Simsbury', state: 'CT', postalCode: '06070', phone: '860-408-3000', website: 'www.westminster-school.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Taft School', city: 'Watertown', state: 'CT', postalCode: '06795', phone: '860-945-7777', website: 'www.taftschool.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'St. Andrew\'s School', city: 'Middletown', state: 'DE', postalCode: '19709', phone: '302-285-4231', website: 'www.standrews-de.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Woodberry Forest School', city: 'Woodberry Forest', state: 'VA', postalCode: '22989', phone: '540-672-3900', website: 'www.woodberry.org', gradeRange: '9-12', gender: 'Boys', boarding: 'Boarding' },
      { name: 'Webb Schools', city: 'Claremont', state: 'CA', postalCode: '91711', phone: '909-482-5214', website: 'www.webb.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Suffield Academy', city: 'Suffield', state: 'CT', postalCode: '06078', phone: '860-386-4400', website: 'www.suffieldacademy.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Sidwell Friends School', city: 'Washington', state: 'DC', postalCode: '20016', phone: '202-537-8100', website: 'www.sidwell.edu', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Trinity School', city: 'New York', state: 'NY', postalCode: '10024', phone: '212-873-1650', website: 'www.trinityschoolnyc.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Collegiate School', city: 'New York', state: 'NY', postalCode: '10024', phone: '212-812-8500', website: 'www.collegiateschool.org', gradeRange: 'K-12', gender: 'Boys', boarding: 'Day' },
      { name: 'Brearley School', city: 'New York', state: 'NY', postalCode: '10028', phone: '212-744-8582', website: 'www.brearley.org', gradeRange: 'K-12', gender: 'Girls', boarding: 'Day' },
      { name: 'Dalton School', city: 'New York', state: 'NY', postalCode: '10128', phone: '212-423-5200', website: 'www.dalton.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Spence School', city: 'New York', state: 'NY', postalCode: '10128', phone: '212-289-5940', website: 'www.spenceschool.org', gradeRange: 'K-12', gender: 'Girls', boarding: 'Day' },
      { name: 'Chapin School', city: 'New York', state: 'NY', postalCode: '10028', phone: '212-744-2335', website: 'www.chapin.edu', gradeRange: 'K-12', gender: 'Girls', boarding: 'Day' },
      { name: 'Horace Mann School', city: 'Bronx', state: 'NY', postalCode: '10471', phone: '718-432-4000', website: 'www.horacemann.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Fieldston School', city: 'Bronx', state: 'NY', postalCode: '10471', phone: '718-329-7300', website: 'www.ecfs.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Poly Prep Country Day School', city: 'Brooklyn', state: 'NY', postalCode: '11228', phone: '718-836-9800', website: 'www.polyprep.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Harvard-Westlake School', city: 'Studio City', state: 'CA', postalCode: '91604', phone: '818-980-6692', website: 'www.hw.com', gradeRange: '7-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Lakeside School', city: 'Seattle', state: 'WA', postalCode: '98125', phone: '206-368-3600', website: 'www.lakesideschool.org', gradeRange: '5-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'University School of Milwaukee', city: 'Milwaukee', state: 'WI', postalCode: '53217', phone: '414-352-6000', website: 'www.usmk12.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Latin School of Chicago', city: 'Chicago', state: 'IL', postalCode: '60610', phone: '312-582-6000', website: 'www.latinschool.org', gradeRange: 'JK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'University of Chicago Lab Schools', city: 'Chicago', state: 'IL', postalCode: '60637', phone: '773-702-9450', website: 'www.ucls.uchicago.edu', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Germantown Friends School', city: 'Philadelphia', state: 'PA', postalCode: '19144', phone: '215-951-2300', website: 'www.germantownfriends.org', gradeRange: 'PK-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Hill School', city: 'Pottstown', state: 'PA', postalCode: '19464', phone: '610-326-1000', website: 'www.thehill.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Kent School', city: 'Kent', state: 'CT', postalCode: '06757', phone: '860-927-6000', website: 'www.kent-school.edu', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Berkshire School', city: 'Sheffield', state: 'MA', postalCode: '01257', phone: '413-229-8511', website: 'www.berkshireschool.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Tabor Academy', city: 'Marion', state: 'MA', postalCode: '02738', phone: '508-748-2000', website: 'www.taboracademy.org', gradeRange: '9-12', gender: 'Co-ed', boarding: 'Boarding' },
      { name: 'Cranbrook Schools', city: 'Bloomfield Hills', state: 'MI', postalCode: '48304', phone: '248-645-3000', website: 'www.cranbrook.edu', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day/Boarding' },
      { name: 'Hockaday School', city: 'Dallas', state: 'TX', postalCode: '75229', phone: '214-363-6311', website: 'www.hockaday.org', gradeRange: 'K-12', gender: 'Girls', boarding: 'Day/Boarding' },
      { name: 'Greenhill School', city: 'Addison', state: 'TX', postalCode: '75001', phone: '972-628-5400', website: 'www.greenhill.org', gradeRange: 'K-12', gender: 'Co-ed', boarding: 'Day' },
      { name: 'Castilleja School', city: 'Palo Alto', state: 'CA', postalCode: '94301', phone: '650-328-3160', website: 'www.castilleja.org', gradeRange: '6-12', gender: 'Girls', boarding: 'Day' },
      { name: 'Crystal Springs Uplands School', city: 'Hillsborough', state: 'CA', postalCode: '94010', phone: '650-342-3631', website: 'www.csus.org', gradeRange: '6-12', gender: 'Co-ed', boarding: 'Day' }
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
        postalCode: school.postalCode,
        phone: school.phone,
        website: school.website,
        email: '',
        lowestGrade,
        highestGrade,
        dataSource: 'us_nces_pss',
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

    console.log(`Importing ${schools.length} US schools...`);

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

          // Check if school already exists (by slug and state)
          const matches = await base44.asServiceRole.entities.School.filter({
            slug: school.slug,
            provinceState: school.provinceState
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