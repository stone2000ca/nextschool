import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all schools
    const schools = await base44.asServiceRole.entities.School.filter({});
    const updates = [];
    const errors = [];

    for (const school of schools) {
      try {
        const updates_for_school = {};
        let needsUpdate = false;

        // 1. Capitalize city names
        if (school.city) {
          const capitalizedCity = school.city
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          if (capitalizedCity !== school.city) {
            updates_for_school.city = capitalizedCity;
            needsUpdate = true;
          }
        }

        // 2. Normalize province names to full names
        const provinceMap = {
          'ON': 'Ontario',
          'QC': 'Quebec',
          'BC': 'British Columbia',
          'AB': 'Alberta',
          'MB': 'Manitoba',
          'SK': 'Saskatchewan',
          'NS': 'Nova Scotia',
          'NB': 'New Brunswick',
          'PE': 'Prince Edward Island',
          'NL': 'Newfoundland and Labrador',
          'NT': 'Northwest Territories',
          'YT': 'Yukon',
          'NU': 'Nunavut'
        };
        
        if (school.provinceState && provinceMap[school.provinceState.toUpperCase()]) {
          updates_for_school.provinceState = provinceMap[school.provinceState.toUpperCase()];
          needsUpdate = true;
        } else if (school.provinceState) {
          // Ensure proper capitalization
          const capitalizedProvince = school.provinceState
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          if (capitalizedProvince !== school.provinceState) {
            updates_for_school.provinceState = capitalizedProvince;
            needsUpdate = true;
          }
        }

        // 3. Detect school type based on name and properties
        if (!school.schoolType) {
          let detectedType = 'General';
          
          const nameLower = school.name.toLowerCase();
          
          // Special needs detection
          if (nameLower.includes('special needs') || 
              nameLower.includes('learning disabilities') ||
              nameLower.includes('adhd') ||
              nameLower.includes('autism') ||
              (school.specialEdPrograms && school.specialEdPrograms.length > 0)) {
            detectedType = 'Special Needs';
          }
          // Boarding school detection
          else if (school.boardingAvailable === true || school.boardingType) {
            detectedType = 'Boarding School';
          }
          // Religious school detection
          else if (school.religiousAffiliation && school.religiousAffiliation.trim() !== '') {
            detectedType = 'Religious';
          }
          // Arts-focused detection
          else if (nameLower.includes('arts') || 
                   nameLower.includes('performing') ||
                   nameLower.includes('music')) {
            detectedType = 'Arts-Focused';
          }
          
          updates_for_school.schoolType = detectedType;
          needsUpdate = true;
        }

        // 4. Set status to active if not set
        if (!school.status) {
          updates_for_school.status = 'active';
          needsUpdate = true;
        }

        // 5. Fix Toronto coordinates if wildly wrong
        if (school.city?.toLowerCase() === 'toronto' && school.lat && school.lng) {
          const torontoLat = 43.65;
          const torontoLng = -79.38;
          
          // Check if coordinates are more than 1 degree off (roughly 111km)
          if (Math.abs(school.lat - torontoLat) > 1 || Math.abs(school.lng - torontoLng) > 1) {
            updates_for_school.lat = torontoLat;
            updates_for_school.lng = torontoLng;
            needsUpdate = true;
          }
        }

        // Apply updates if needed
        if (needsUpdate) {
          await base44.asServiceRole.entities.School.update(school.id, updates_for_school);
          updates.push({
            schoolId: school.id,
            schoolName: school.name,
            updates: updates_for_school
          });
        }
      } catch (error) {
        errors.push({
          schoolId: school.id,
          schoolName: school.name,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      totalSchools: schools.length,
      updatedCount: updates.length,
      errorCount: errors.length,
      updates,
      errors
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});