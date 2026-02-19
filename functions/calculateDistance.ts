import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userLat, userLng, schoolId, schoolLat, schoolLng } = await req.json();

    let lat2, lng2;

    // Get school coordinates
    if (schoolId) {
      const schools = await base44.entities.School.filter({ id: schoolId });
      if (!schools || schools.length === 0) {
        return Response.json({ error: 'School not found' }, { status: 404 });
      }
      lat2 = schools[0].lat;
      lng2 = schools[0].lng;
    } else {
      lat2 = schoolLat;
      lng2 = schoolLng;
    }

    // Haversine formula to calculate distance
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - userLat);
    const dLng = toRadians(lng2 - userLng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(userLat)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    const distanceMiles = distanceKm * 0.621371;

    // Estimate driving time (assuming average speed of 50 km/h in urban areas)
    const drivingTimeMinutes = Math.round((distanceKm / 50) * 60);

    return Response.json({
      distanceKm: Math.round(distanceKm * 10) / 10,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      drivingTimeMinutes,
      method: 'haversine'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});