import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { 
      region, 
      country,
      minGrade, 
      maxGrade, 
      minTuition, 
      maxTuition, 
      curriculumType,
      specializations,
      userLat,
      userLng,
      maxDistanceKm,
      limit = 20
    } = await req.json();

    // Build filter
    let schools = await base44.entities.School.filter({ status: 'active' });

    // Apply filters
    if (region) {
      schools = schools.filter(s => s.region === region);
    }
    if (country) {
      schools = schools.filter(s => s.country === country);
    }
    if (minGrade !== undefined) {
      schools = schools.filter(s => s.lowestGrade <= minGrade && s.highestGrade >= minGrade);
    }
    if (maxGrade !== undefined) {
      schools = schools.filter(s => s.lowestGrade <= maxGrade && s.highestGrade >= maxGrade);
    }
    if (minTuition !== undefined) {
      schools = schools.filter(s => s.tuition >= minTuition);
    }
    if (maxTuition !== undefined) {
      schools = schools.filter(s => s.tuition <= maxTuition);
    }
    if (curriculumType) {
      schools = schools.filter(s => s.curriculumType === curriculumType);
    }
    if (specializations && specializations.length > 0) {
      schools = schools.filter(s => 
        s.specializations && specializations.some(spec => s.specializations.includes(spec))
      );
    }

    // Calculate distances if user location provided
    if (userLat && userLng) {
      schools = schools.map(school => {
        if (school.lat && school.lng) {
          const distance = calculateDistance(userLat, userLng, school.lat, school.lng);
          return { ...school, distanceKm: distance };
        }
        return school;
      });

      if (maxDistanceKm) {
        schools = schools.filter(s => s.distanceKm && s.distanceKm <= maxDistanceKm);
      }

      schools.sort((a, b) => (a.distanceKm || 999999) - (b.distanceKm || 999999));
    }

    // Limit results
    schools = schools.slice(0, limit);

    return Response.json({ schools, total: schools.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}