import { useEffect, useRef, useState } from "react";
import { Compass, MapPin, Orbit } from "lucide-react";
import type { CameraLike } from "../lib/geo";
import {
  KLE_BOUNDARY_COORDS,
  KLE_BUILDINGS,
  KLE_CAMPUS,
  KLE_RESPONDERS,
} from "../lib/kleCampusData";
import type { CamMode, IncidentRecord } from "../lib/store";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Cesium?: any;
  }
}

export type CesiumTwinProps = {
  center?: [number, number];
  cameras: CameraLike[];
  cameraModes: Record<string, CamMode>;
  incidents: IncidentRecord[];
  probePoint?: [number, number] | null;
  safeWalkDest?: [number, number] | null;
  onPickPoint?: (lat: number, lng: number) => void;
  height?: string;
};

function computeConePolygonLatLng(
  lat: number,
  lng: number,
  directionDeg: number,
  fovDeg: number,
  rangeM: number,
): number[] {
  const coords: number[] = [lng, lat];
  const half = fovDeg / 2;
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const ang = ((directionDeg - half + (fovDeg * i) / steps) * Math.PI) / 180;
    const dLat = (rangeM * Math.cos(ang)) / 111320;
    const dLng =
      (rangeM * Math.sin(ang)) / (111320 * Math.cos((lat * Math.PI) / 180));
    coords.push(lng + dLng, lat + dLat);
  }
  return coords;
}

export function CesiumTwin({
  cameras,
  cameraModes,
  incidents,
  probePoint,
  safeWalkDest,
  onPickPoint,
  height = "420px",
}: CesiumTwinProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const onPickRef = useRef(onPickPoint);
  onPickRef.current = onPickPoint;

  const [sceneMode, setSceneMode] = useState<"2D" | "2.5D" | "3D">("3D");
  const [selectedPov, setSelectedPov] = useState<string>("CAMPUS");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [cesiumReady, setCesiumReady] = useState<boolean>(false);

  // Initialize Cesium Viewer on KLE Tech Hubballi Satellite Imagery
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const Cesium = window.Cesium;
      if (!Cesium || !containerRef.current || viewerRef.current) return;

      try {
        let imageryProvider;
        try {
          if (Cesium.ArcGisMapServerImageryProvider?.fromUrl) {
            imageryProvider =
              await Cesium.ArcGisMapServerImageryProvider.fromUrl(
                "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
              );
          } else {
            imageryProvider = new Cesium.ArcGisMapServerImageryProvider({
              url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            });
          }
        } catch {
          imageryProvider = new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          });
        }
        if (cancelled || !containerRef.current) return;

        const viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          creditContainer: document.createElement("div"),
          imageryProvider,
        });

        viewer.scene.globe.baseColor =
          Cesium.Color.fromCssColorString("#05090d");
        viewer.scene.backgroundColor =
          Cesium.Color.fromCssColorString("#05090d");
        viewer.scene.fog.enabled = false;

        // Click handler for coverage probe / location pick
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler.setInputAction((movement: any) => {
          if (!onPickRef.current) return;
          const cartesian = viewer.camera.pickEllipsoid(
            movement.position,
            viewer.scene.globe.ellipsoid,
          );
          if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);
            const lng = Cesium.Math.toDegrees(cartographic.longitude);
            onPickRef.current(lat, lng);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            KLE_CAMPUS.longitude,
            KLE_CAMPUS.latitude - 0.0042,
            520,
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-48),
            roll: 0,
          },
          duration: 0,
        });

        viewerRef.current = viewer;
        if (!cancelled) setCesiumReady(true);
      } catch {
        // Fallback if WebGL unavailable
      }
    };

    void init();
    const timer = window.setInterval(() => {
      if (!viewerRef.current && window.Cesium) void init();
    }, 400);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Re-sync KLE Tech Hubballi 3D Entities
  useEffect(() => {
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || !cesiumReady) return;

    viewer.entities.removeAll();

    // 1. KLE Tech Institutional Boundary Outline (OSM Way 381443665)
    const boundaryFlat = KLE_BOUNDARY_COORDS.flatMap(([lon, lat]) => [
      lon,
      lat,
    ]);
    viewer.entities.add({
      id: "kle-boundary",
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(boundaryFlat),
        height: 0,
        material: Cesium.Color.fromCssColorString("#00d7ff").withAlpha(0.04),
        outline: true,
        outlineColor:
          Cesium.Color.fromCssColorString("#00d7ff").withAlpha(0.85),
      },
    });

    // 2. KLE Tech Hubballi Anchor Marker
    viewer.entities.add({
      id: "kle-anchor",
      position: Cesium.Cartesian3.fromDegrees(
        KLE_CAMPUS.anchorLng,
        KLE_CAMPUS.anchorLat,
        4,
      ),
      point: {
        pixelSize: 8,
        color: Cesium.Color.fromCssColorString("#00e5ff"),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
      label: {
        text: "KLE TECH · B. V. BHOOMARADDI CAMPUS",
        font: "700 10px IBM Plex Mono, monospace",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -16),
      },
    });

    // 3. All 16 Real OSM Mapped 3D Extruded Buildings on KLE Tech Campus
    KLE_BUILDINGS.forEach((b) => {
      const flat = b.coords.flatMap(([lon, lat]) => [lon, lat]);
      const fillHex =
        b.category === "hostel_girl"
          ? "#ec4899"
          : b.category === "hostel_boy"
            ? "#38bdf8"
            : b.category === "innovation"
              ? "#a855f7"
              : "#55c7d9";
      const outlineHex =
        b.category === "hostel_girl"
          ? "#fbcfe8"
          : b.category === "hostel_boy"
            ? "#bae6fd"
            : "#a6f4ff";

      viewer.entities.add({
        id: b.id,
        name: b.name,
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
          height: 0,
          extrudedHeight: b.height,
          material: Cesium.Color.fromCssColorString(fillHex).withAlpha(0.38),
          outline: true,
          outlineColor:
            Cesium.Color.fromCssColorString(outlineHex).withAlpha(0.9),
        },
        position: Cesium.Cartesian3.fromDegrees(
          b.centerLng,
          b.centerLat,
          b.height + 5,
        ),
        label: {
          text: b.name,
          font: "600 10px IBM Plex Mono, monospace",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0,
            1200,
          ),
        },
      });
    });

    // 4. 3D Volumetric Camera FOV Cones + Markers
    cameras.forEach((cam) => {
      const mode = cameraModes[cam.code] ?? "WATCH";
      const hex =
        mode === "INVESTIGATE"
          ? "#ff475e"
          : mode === "VERIFY"
            ? "#ffbf5f"
            : "#00e5ff";
      const coneColor = Cesium.Color.fromCssColorString(hex);
      const flatDegrees = computeConePolygonLatLng(
        cam.lat,
        cam.lng,
        cam.direction,
        cam.fov,
        cam.range_m,
      );

      viewer.entities.add({
        name: `${cam.code} FOV`,
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
          height: 0.5,
          extrudedHeight: 6,
          material: coneColor.withAlpha(mode === "INVESTIGATE" ? 0.32 : 0.16),
          outline: true,
          outlineColor: coneColor.withAlpha(0.85),
        },
      });

      viewer.entities.add({
        name: cam.code,
        position: Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, 8),
        point: {
          pixelSize: 11,
          color: coneColor,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        label: {
          text: `${cam.code} [${mode}]`,
          font: "700 10px IBM Plex Mono, monospace",
          fillColor: coneColor,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -18),
        },
      });
    });

    // 5. Security Responders on KLE Tech Campus
    KLE_RESPONDERS.forEach((r) => {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(r.lng, r.lat, 4),
        point: {
          pixelSize: 9,
          color: Cesium.Color.fromCssColorString("#66e6a2"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        label: {
          text: r.id,
          font: "700 9px IBM Plex Mono, monospace",
          fillColor: Cesium.Color.fromCssColorString("#a9ffd0"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -14),
        },
      });
    });

    // 6. Active SOS & SafeWalk 3D Beacons
    incidents
      .filter((i) => i.status !== "RESOLVED" && i.status !== "CANCELLED")
      .forEach((inc) => {
        if (inc.lat == null || inc.lng == null) return;
        const color = Cesium.Color.fromCssColorString("#ff475e");

        viewer.entities.add({
          name: inc.ref,
          position: Cesium.Cartesian3.fromDegrees(inc.lng, inc.lat, 18),
          cylinder: {
            length: 36,
            topRadius: 7,
            bottomRadius: 1.5,
            material: color.withAlpha(0.55),
            outline: true,
            outlineColor: Cesium.Color.WHITE,
          },
          label: {
            text: `SOS · ${inc.ref}\n${inc.student_name}${inc.building_name ? ` (${inc.building_name})` : ""}`,
            font: "700 11px IBM Plex Mono, monospace",
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString(
              "#8e1426",
            ).withAlpha(0.92),
            pixelOffset: new Cesium.Cartesian2(0, -28),
          },
        });

        if (inc.dest_lat != null && inc.dest_lng != null) {
          viewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                inc.lng,
                inc.lat,
                4,
                inc.dest_lng,
                inc.dest_lat,
                4,
              ]),
              width: 3,
              material: Cesium.Color.fromCssColorString("#00e5ff"),
            },
          });
        }
      });

    // 7. Coverage Probe / Selected Point Marker
    const markerPt = probePoint ?? safeWalkDest;
    if (markerPt) {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(markerPt[1], markerPt[0], 6),
        point: {
          pixelSize: 11,
          color: Cesium.Color.fromCssColorString("#ffbf5f"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
      });
    }
  }, [
    cesiumReady,
    cameras,
    cameraModes,
    incidents,
    probePoint,
    safeWalkDest,
  ]);

  const handlePovChange = (val: string) => {
    setSelectedPov(val);
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;

    if (val === "CAMPUS") {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          KLE_CAMPUS.longitude,
          KLE_CAMPUS.latitude - 0.0042,
          520,
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-48),
          roll: 0,
        },
        duration: 1.1,
      });
      return;
    }

    const cam = cameras.find((c) => c.code === val);
    if (cam) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, 24),
        orientation: {
          heading: Cesium.Math.toRadians(cam.direction),
          pitch: Cesium.Math.toRadians(-20),
          roll: 0,
        },
        duration: 1.1,
      });
    }
  };

  const handleBuildingJump = (bId: string) => {
    setSelectedBuildingId(bId);
    const b = KLE_BUILDINGS.find((x) => x.id === bId);
    if (!b) return;
    onPickRef.current?.(b.centerLat, b.centerLng);
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        b.centerLng,
        b.centerLat - 0.0014,
        190,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 1.0,
    });
  };

  const switchSceneMode = (mode: "2D" | "2.5D" | "3D") => {
    setSceneMode(mode);
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (mode === "2D") viewer.scene.morphTo2D(0.7);
    if (mode === "3D") viewer.scene.morphTo3D(0.7);
    if (mode === "2.5D") viewer.scene.morphToColumbusView(0.7);
  };

  return (
    <div
      style={{ height }}
      className="relative w-full rounded-xl overflow-hidden border border-border glass-card"
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Clean Top-Left Dropdowns: Building Jump + Camera POV */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="px-2.5 py-1.5 rounded-lg bg-[#060c11]/90 backdrop-blur border border-[#00e5ff]/40 font-mono text-[10px] flex items-center gap-1.5 text-[#00e5ff]">
          <Orbit className="w-3.5 h-3.5" />
          <span className="font-semibold tracking-wider">
            KLE TECH · HUBBALLI 3D TWIN
          </span>
        </div>

        {/* Dropdown 1: Jump to any KLE Tech Hubballi Building */}
        <div className="flex items-center bg-[#060c11]/90 backdrop-blur border border-white/15 rounded-lg px-2 py-1">
          <MapPin className="w-3 h-3 text-[#00e5ff] mr-1.5 shrink-0" />
          <select
            aria-label="Jump to KLE Tech Hubballi Building"
            value={selectedBuildingId}
            onChange={(e) => handleBuildingJump(e.target.value)}
            className="bg-transparent font-mono text-[11px] text-foreground focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-[#060c11]">
              Jump to Campus Building...
            </option>
            {KLE_BUILDINGS.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#060c11]">
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown 2: Camera View / POV Switcher */}
        <select
          aria-label="Select 3D Camera View"
          value={selectedPov}
          onChange={(e) => handlePovChange(e.target.value)}
          className="bg-[#060c11]/90 backdrop-blur border border-white/15 rounded-lg px-2.5 py-1 font-mono text-[11px] text-foreground focus:outline-none cursor-pointer"
        >
          <option value="CAMPUS" className="bg-[#060c11]">
            ⌖ 3D Campus Overview
          </option>
          {cameras.map((cam) => (
            <option key={cam.id} value={cam.code} className="bg-[#060c11]">
              POV · {cam.code} ({cam.name})
            </option>
          ))}
        </select>
      </div>

      {/* Clean Top-Right 2D / 2.5D / 3D Switcher */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-[#060c11]/90 backdrop-blur border border-white/15 rounded-lg p-1 pointer-events-auto">
        {(["2D", "2.5D", "3D"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchSceneMode(m)}
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold transition ${
              sceneMode === m
                ? "bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Minimal Bottom Coordinate Bar */}
      <div className="absolute bottom-2.5 left-3 right-3 z-10 flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#060c11]/85 backdrop-blur border border-white/10 font-mono text-[10px] text-muted-foreground pointer-events-none">
        <span className="flex items-center gap-1.5">
          <Compass className="w-3 h-3 text-[#00e5ff]" />
          <strong className="text-foreground">15.3693° N, 75.1224° E</strong> ·
          B. V. Bhoomaraddi Campus, Hubballi
        </span>
        <span className="hidden sm:inline text-[#00e5ff]">
          SATELLITE + 16 OSM 3D BUILDINGS
        </span>
      </div>
    </div>
  );
}
