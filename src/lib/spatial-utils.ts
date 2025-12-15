/**
 * Menghitung jarak antara dua titik koordinat dalam Kilometer menggunakan Haversine Formula.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius bumi dalam KM
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Jarak dalam KM
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Mencari lokasi sensor terdekat dari titik referensi
 */
export function findNearestSensor(referenceLat: number, referenceLng: number, sensors: any[]) {
  let nearest = null;
  let minDistance = Infinity;

  for (const sensor of sensors) {
    // Validasi koordinat sensor
    const sLat = parseFloat(sensor.latitude);
    const sLng = parseFloat(sensor.longitude);

    if (isNaN(sLat) || isNaN(sLng) || sLat === 0 || sLng === 0) continue;

    const dist = calculateDistance(referenceLat, referenceLng, sLat, sLng);

    if (dist < minDistance) {
      minDistance = dist;
      nearest = { ...sensor, distance_km: dist };
    }
  }

  return nearest;
}
