import { useState, useEffect } from 'react';

// In-memory cache shared across all hook instances within the same page lifecycle.
// No need to persist across sessions — backend already has resolvedLat/Lng in conversation_context.
let cachedLocation = null;

export function useUserLocation() {
  const [userLocation, setUserLocation] = useState(cachedLocation);

  useEffect(() => {
    if (cachedLocation) {
      setUserLocation(cachedLocation);
      return;
    }
    loadUserLocation();
  }, []);

  const loadUserLocation = async () => {
    // Default to Toronto if geolocation unavailable or fails
    const defaultLocation = {
      lat: 43.6532,
      lng: -79.3832,
      address: 'Toronto, Ontario'
    };

    // Try browser geolocation
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          // Reverse geocode to get address
          try {
            const apiKey = Deno?.env?.get('GOOGLE_MAPS_API_KEY');
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
            );
            const data = await response.json();

            const location = {
              lat: latitude,
              lng: longitude,
              address: data.results[0]?.formatted_address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            };

            cachedLocation = location;
            setUserLocation(location);
          } catch (error) {
            console.error('Geocoding failed:', error);
            const location = { lat: latitude, lng: longitude, address: null };
            cachedLocation = location;
            setUserLocation(location);
          }
        },
        (error) => {
          console.log('Geolocation denied or failed:', error);
          // Fall back to Toronto
          cachedLocation = defaultLocation;
          setUserLocation(defaultLocation);
        }
      );
    } else {
      // Fall back to Toronto if geolocation not available
      cachedLocation = defaultLocation;
      setUserLocation(defaultLocation);
    }
  };

  return userLocation;
}
