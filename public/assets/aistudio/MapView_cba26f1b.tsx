import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tone: "primary" | "destructive" | "accent" | "muted";
  cone?: { direction: number; fov: number; range: number };
};

const toneVar: Record<MapMarker["tone"], string> = {
  primary: "var(--primary)",
  destructive: "var(--destructive)",
  accent: "var(--accent)",
  muted: "var(--muted-foreground)",
};

function conePoints(lat: number, lng: number, dir: number, fov: number, range: number) {
  const pts: [number, number][] = [[lat, lng]];
  for (let a = dir - fov / 2; a <= dir + fov / 2; a += fov / 12) {
    const r = (a * Math.PI) / 180;
    pts.push([lat + (range * Math.cos(r)) / 111320, lng + (range * Math.sin(r)) / (111320 * Math.cos((lat * Math.PI) / 180))]);
  }
  return pts;
}

export default function MapView({
  center,
  markers = [],
  onPick,
  height = 360,
  route,
}: {
  center: [number, number];
  markers?: MapMarker[];
  onPick?: (lat: number, lng: number) => void;
  height?: number;
  route?: [number, number][];
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !el.current || map.current) return;
      const Lf = (mod as unknown as { default: typeof import("leaflet") }).default ?? mod;
      L.current = Lf;
      map.current = Lf.map(el.current).setView(center, 17);
      Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map.current);
      layer.current = Lf.layerGroup().addTo(map.current);
      map.current.on("click", (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
      draw();
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const Lf = L.current;
    if (!Lf || !layer.current) return;
    layer.current.clearLayers();
    const css = getComputedStyle(document.documentElement);
    const color = (t: MapMarker["tone"]) => css.getPropertyValue(toneVar[t].slice(4, -1)).trim() || "currentColor";
    for (const m of markers) {
      if (m.cone) {
        Lf.polygon(conePoints(m.lat, m.lng, m.cone.direction, m.cone.fov, m.cone.range), {
          color: color(m.tone), weight: 1, fillOpacity: 0.15,
        }).addTo(layer.current);
      }
      Lf.circleMarker([m.lat, m.lng], { radius: 8, color: color(m.tone), fillColor: color(m.tone), fillOpacity: 0.85, weight: 2 })
        .bindTooltip(m.label)
        .addTo(layer.current);
    }
    if (route && route.length > 1) Lf.polyline(route, { color: color("accent"), dashArray: "6 6" }).addTo(layer.current);
  }

  useEffect(() => { draw(); }); // redraw on every render with fresh markers
  useEffect(() => { map.current?.setView(center); }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-xl border border-border" />;
}
