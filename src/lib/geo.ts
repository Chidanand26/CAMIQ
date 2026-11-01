export type CameraLike = {
  id: string;
  code: string;
  name: string;
  camera_type: "entrance" | "laboratory" | "corridor" | "perimeter" | "other";
  lat: number | null;
  lng: number | null;
  direction: number;
  fov: number;
  range_m: number;
  neighbors: string[];
  status: "ONLINE" | "DISCONNECTED" | "NOT ASSIGNED";
  fps: number | null;
  last_seen: string | null;
  device_label?: string | null;
};

export type CameraDecision = {
  camera: CameraLike;
  eligible: boolean;
  distance: number | null;
  score: number;
  reason: string;
};

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number) {
  const y = Math.sin(rad(bLng - aLng)) * Math.cos(rad(bLat));
  const x =
    Math.cos(rad(aLat)) * Math.sin(rad(bLat)) -
    Math.sin(rad(aLat)) * Math.cos(rad(bLat)) * Math.cos(rad(bLng - aLng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function angleDiff(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** A camera is "online" if it reported a heartbeat in the last 30 seconds or is actively streaming. */
export function isOnline(c: CameraLike, now = Date.now()) {
  if (c.status === "ONLINE") return true;
  return (
    c.status === "ONLINE" &&
    !!c.last_seen &&
    now - new Date(c.last_seen).getTime() < 30_000
  );
}

/** Coverage-to-compute orchestrator: rank cameras for a location and explain each decision. */
export function planCameras(
  lat: number,
  lng: number,
  cameras: CameraLike[],
  now = Date.now(),
): CameraDecision[] {
  const out = cameras.map<CameraDecision>((c) => {
    if (c.lat == null || c.lng == null)
      return {
        camera: c,
        eligible: false,
        distance: null,
        score: 0,
        reason: "No position configured",
      };
    const d = distanceM(c.lat, c.lng, lat, lng);
    if (d > c.range_m)
      return {
        camera: c,
        eligible: false,
        distance: d,
        score: 0,
        reason: `Out of range (${Math.round(d)}m > ${c.range_m}m)`,
      };
    const off = angleDiff(bearingDeg(c.lat, c.lng, lat, lng), c.direction);
    if (d > 3 && off > c.fov / 2)
      return {
        camera: c,
        eligible: false,
        distance: d,
        score: 0,
        reason: `Outside field of view (${Math.round(off)}° off axis)`,
      };
    if (!isOnline(c, now))
      return {
        camera: c,
        eligible: false,
        distance: d,
        score: 0,
        reason: "Covers location but camera is offline",
      };
    const score = (1 - d / c.range_m) * 70 + Math.min(c.fps ?? 0, 30);
    return {
      camera: c,
      eligible: true,
      distance: d,
      score,
      reason: `Covers location at ${Math.round(d)}m, ${Math.round(c.fps ?? 0)} fps`,
    };
  });
  return out.sort(
    (a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score,
  );
}
