const EARTH_RADIUS = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

export function destinationPoint(lat, lon, bearingDeg, distanceM) {
  const bearing = toRad(bearingDeg);
  const angularDistance = distanceM / EARTH_RADIUS;
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );
  return [toDeg(lon2), toDeg(lat2)];
}

export function distanceAndBearing(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const dLat = p2 - p1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  const distance = 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return { distance, bearing };
}

export function isPointCovered(camera, point) {
  const { distance, bearing } = distanceAndBearing(
    camera.latitude, camera.longitude, point.latitude, point.longitude
  );
  const difference = Math.abs(((bearing - camera.heading + 540) % 360) - 180);
  return distance <= camera.range && difference <= camera.fov / 2;
}

export function createCoverageArc(camera, segments = 28) {
  const start = camera.heading - camera.fov / 2;
  const points = [[camera.longitude, camera.latitude]];
  for (let i = 0; i <= segments; i += 1) {
    const bearing = start + (camera.fov * i) / segments;
    points.push(destinationPoint(camera.latitude, camera.longitude, bearing, camera.range));
  }
  points.push([camera.longitude, camera.latitude]);
  return points;
}
