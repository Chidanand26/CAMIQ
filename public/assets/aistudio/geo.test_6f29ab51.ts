import { describe, it, expect } from "vitest";
import { planCameras, type CameraLike } from "./geo";

const now = Date.parse("2026-11-01T06:00:00Z");
const cam = (o: Partial<CameraLike>): CameraLike => ({
  id: "1", code: "CAM-01", name: "", lat: 12.0, lng: 77.0, direction: 0, fov: 90, range_m: 50,
  status: "ONLINE", fps: 20, last_seen: new Date(now - 1000).toISOString(), ...o,
});

describe("planCameras", () => {
  it("selects a camera facing the location within range", () => {
    const [d] = planCameras(12.0002, 77.0, [cam({})], now); // ~22m north
    expect(d.eligible).toBe(true);
  });
  it("rejects a camera facing away", () => {
    const [d] = planCameras(12.0002, 77.0, [cam({ direction: 180 })], now);
    expect(d.eligible).toBe(false);
  });
  it("rejects a location beyond range", () => {
    const [d] = planCameras(12.001, 77.0, [cam({})], now); // ~111m
    expect(d.eligible).toBe(false);
  });
  it("rejects an offline camera even when it covers the spot", () => {
    const [d] = planCameras(12.0002, 77.0, [cam({ last_seen: new Date(now - 60_000).toISOString() })], now);
    expect(d.eligible).toBe(false);
  });
});
