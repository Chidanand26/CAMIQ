import { useEffect, useRef, useState } from "react";
import { Compass, Eye, Layers, Orbit } from "lucide-react";
import type { CameraLike } from "../lib/geo";
import type { CamMode, IncidentRecord } from "../lib/store";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Cesium?: any;
  }
}

export type CesiumTwinProps = {
  center: [number, number];
  cameras: CameraLike[];
  cameraModes: Record<string, CamMode>;
  incidents: IncidentRecord[];
  probePoint?: [number, number] | null;
  safeWalkDest?: [number, number] | null;
  onPickPoint?: (lat: number, lng: number) => void;
  height?: string;
};

const CAMPUS_BUILDINGS = [
  {
    name: "Academic Block A",
    dLat: 0.00022,
    dLng: -0.00018,
    w: 0.00018,
    h: 0.00014,
    elevation: 28,
  },
  {
    name: "Robotics & AI Lab",
    dLat: 0.00038,
    dLng: 0.00042,
    w: 0.0002,
    h: 0.00015,
    elevation: 34,
  },
  {
    name: "Central Library Tower",
    dLat: -0.00015,
    dLng: 0.00012,
    w: 0.00016,
    h: 0.00016,
    elevation: 42,
  },
  {
    name: "North Student Residence",
    dLat: -0.00034,
    dLng: 0.00038,
    w: 0.00022,
    h: 0.00014,
    elevation: 24,
  },
  {
    name: "Main Gate Security Plaza",
    dLat: -0.00004,
    dLng: -0.00006,
    w: 0.00012,
    h: 0.0001,
    elevation: 14,
  },
];

function computeConePolygonLatLng(
  lat: number,
  lng: number,
  directionDeg: number,
  fovDeg: number,
  rangeM: number,
): number[] {
  const coords: number[] = [lng, lat];
  const half = fovDeg / 2;
  const steps = 14;
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
  center,
  cameras,
  cameraModes,
  incidents,
  probePoint,
  safeWalkDest,
  onPickPoint,
  height = "400px",
}: CesiumTwinProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const onPickRef = useRef(onPickPoint);
  onPickRef.current = onPickPoint;

  const [shader, setShader] = useState<"STD" | "NVG" | "FLIR">("STD");
  const [activePov, setActivePov] = useState<string>("ORBIT");
  const [cesiumReady, setCesiumReady] = useState<boolean>(false);

  // Initialize Cesium Viewer
  useEffect(() => {
    let cancelled = false;
    const init = () => {
      const Cesium = window.Cesium;
      if (!Cesium || !containerRef.current || viewerRef.current) return;

      try {
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
          imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            maximumLevel: 19,
          }),
        });

        viewer.scene.globe.baseColor =
          Cesium.Color.fromCssColorString("#090d16");
        viewer.scene.backgroundColor =
          Cesium.Color.fromCssColorString("#090d16");
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0003;

        // Click handler for coverage probe / SafeWalk destination
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
            center[1],
            center[0] - 0.0018,
            240,
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 0,
        });

        viewerRef.current = viewer;
        if (!cancelled) setCesiumReady(true);
      } catch {
        // Fallback if WebGL is unavailable in headless environment
      }
    };

    init();
    const timer = window.setInterval(() => {
      if (!viewerRef.current && window.Cesium) init();
    }, 400);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync 3D Entities whenever cameras, modes, incidents, or probe points update
  useEffect(() => {
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || !cesiumReady) return;

    viewer.entities.removeAll();

    // 1. 3D Extruded Campus Buildings
    CAMPUS_BUILDINGS.forEach((b) => {
      const bLat = center[0] + b.dLat;
      const bLng = center[1] + b.dLng;
      viewer.entities.add({
        name: b.name,
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            bLng - b.w / 2,
            bLat - b.h / 2,
            bLng + b.w / 2,
            bLat - b.h / 2,
            bLng + b.w / 2,
            bLat + b.h / 2,
            bLng - b.w / 2,
            bLat + b.h / 2,
          ]),
          extrudedHeight: b.elevation,
          material: Cesium.Color.fromCssColorString("#162338").withAlpha(0.82),
          outline: true,
          outlineColor:
            Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.45),
        },
        position: Cesium.Cartesian3.fromDegrees(bLng, bLat, b.elevation + 6),
        label: {
          text: b.name,
          font: "600 11px JetBrains Mono, monospace",
          fillColor: Cesium.Color.fromCssColorString("#94a3b8"),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 900),
        },
      });
    });

    // 2. 3D Volumetric Camera FOV Cones + Pylon Markers
    cameras.forEach((cam) => {
      const mode = cameraModes[cam.code] ?? "WATCH";
      const hex =
        mode === "INVESTIGATE"
          ? "#f43f5e"
          : mode === "VERIFY"
            ? "#f59e0b"
            : "#22d3ee";
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
          extrudedHeight: 8,
          material: coneColor.withAlpha(mode === "INVESTIGATE" ? 0.34 : 0.2),
          outline: true,
          outlineColor: coneColor.withAlpha(0.85),
        },
      });

      viewer.entities.add({
        name: cam.code,
        position: Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, 12),
        point: {
          pixelSize: 11,
          color: coneColor,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        label: {
          text: `${cam.code} [${mode}]\n${cam.status === "ONLINE" ? `${cam.fps} FPS` : cam.status}`,
          font: "700 11px JetBrains Mono, monospace",
          fillColor: coneColor,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#090d16").withAlpha(
            0.85,
          ),
          pixelOffset: new Cesium.Cartesian2(0, -24),
        },
      });
    });

    // 3. Active SOS & SafeWalk 3D Beacons
    incidents
      .filter((i) => i.status !== "RESOLVED" && i.status !== "CANCELLED")
      .forEach((inc) => {
        if (inc.lat == null || inc.lng == null) return;
        const isSos = inc.kind === "sos";
        const color = Cesium.Color.fromCssColorString(
          isSos ? "#f43f5e" : "#f59e0b",
        );

        viewer.entities.add({
          name: inc.ref,
          position: Cesium.Cartesian3.fromDegrees(inc.lng, inc.lat, 18),
          cylinder: {
            length: 36,
            topRadius: 6,
            bottomRadius: 1.5,
            material: color.withAlpha(0.55),
            outline: true,
            outlineColor: color,
          },
          label: {
            text: `🚨 ${inc.ref} (${inc.kind.toUpperCase()})\n${inc.student_name}`,
            font: "700 12px JetBrains Mono, monospace",
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: color.withAlpha(0.9),
            pixelOffset: new Cesium.Cartesian2(0, -30),
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
              width: 4,
              material: Cesium.Color.fromCssColorString("#22d3ee"),
            },
          });
        }
      });

    // 4. Coverage Probe Marker
    if (probePoint) {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          probePoint[1],
          probePoint[0],
          10,
        ),
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString("#f59e0b"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: "COVERAGE PROBE",
          font: "700 10px JetBrains Mono, monospace",
          fillColor: Cesium.Color.fromCssColorString("#f59e0b"),
          pixelOffset: new Cesium.Cartesian2(0, -18),
        },
      });
    }

    // 5. SafeWalk Destination Marker
    if (safeWalkDest) {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          safeWalkDest[1],
          safeWalkDest[0],
          10,
        ),
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString("#10b981"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: "SAFEWALK DESTINATION",
          font: "700 10px JetBrains Mono, monospace",
          fillColor: Cesium.Color.fromCssColorString("#10b981"),
          pixelOffset: new Cesium.Cartesian2(0, -18),
        },
      });
    }
  }, [
    cesiumReady,
    center,
    cameras,
    cameraModes,
    incidents,
    probePoint,
    safeWalkDest,
  ]);

  const flyToOrbit = () => {
    setActivePov("ORBIT");
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        center[1],
        center[0] - 0.0018,
        240,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 1.1,
    });
  };

  const flyToCameraPov = (cam: CameraLike) => {
    setActivePov(cam.code);
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, 18),
      orientation: {
        heading: Cesium.Math.toRadians(cam.direction),
        pitch: Cesium.Math.toRadians(-18),
        roll: 0,
      },
      duration: 1.1,
    });
  };

  const shaderClass =
    shader === "NVG"
      ? "shader-nvg"
      : shader === "FLIR"
        ? "shader-flir"
        : "";

  return (
    <div
      style={{ height }}
      className="relative w-full rounded-xl overflow-hidden border border-border bg-card shadow-inner"
    >
      {/* Cesium 3D Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-full ${shaderClass}`}
      />

      {/* Top Left Tactical HUD Overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 pointer-events-auto">
        <div className="px-2.5 py-1 rounded-md bg-background/90 backdrop-blur border border-primary/40 font-mono text-[11px] flex items-center gap-1.5 text-primary">
          <Orbit className="w-3.5 h-3.5" />
          <span>CESIUM 3D DIGITAL TWIN</span>
        </div>

        <button
          type="button"
          onClick={flyToOrbit}
          className={`px-2 py-1 rounded-md font-mono text-[10px] border transition ${
            activePov === "ORBIT"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background/85 text-foreground border-border hover:border-primary/50"
          }`}
        >
          3D ORBIT
        </button>

        {cameras.map((cam) => (
          <button
            key={cam.id}
            type="button"
            onClick={() => flyToCameraPov(cam)}
            className={`px-2 py-1 rounded-md font-mono text-[10px] border transition inline-flex items-center gap-1 ${
              activePov === cam.code
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background/85 text-foreground border-border hover:border-primary/50"
            }`}
          >
            <Eye className="w-3 h-3" /> POV {cam.code}
          </button>
        ))}
      </div>

      {/* Top Right Shader Mode Switcher */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-background/90 backdrop-blur border border-border rounded-md p-1 pointer-events-auto">
        <Layers className="w-3.5 h-3.5 text-muted-foreground mx-1" />
        {(["STD", "NVG", "FLIR"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setShader(mode)}
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold transition ${
              shader === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Bottom Status Bar */}
      <div className="absolute bottom-2.5 left-3 right-3 z-10 flex items-center justify-between px-3 py-1.5 rounded-md bg-background/85 backdrop-blur border border-border/80 font-mono text-[10px] text-muted-foreground pointer-events-none">
        <span className="flex items-center gap-1.5">
          <Compass className="w-3 h-3 text-primary" />
          POV: <strong className="text-foreground">{activePov}</strong> · SHADER:{" "}
          <strong className="text-foreground">{shader}</strong>
        </span>
        <span>
          {onPickPoint
            ? "CLICK ANY POINT IN 3D TWIN TO PROBE CAMERA COVERAGE"
            : "3D VOLUMETRIC FOV CONES + SOS BEACONS ACTIVE"}
        </span>
      </div>
    </div>
  );
}
