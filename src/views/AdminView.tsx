import { useState } from "react";
import {
  Activity,
  Camera,
  CheckCircle2,
  Crosshair,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { CameraTile } from "../components/CameraTile";
import { CesiumTwin } from "../components/CesiumTwin";
import { planCameras } from "../lib/geo";
import {
  raiseIncident,
  resetCamerasToWatch,
  triggerMotionCoordination,
  updateIncidentStatus,
  useCamiqStore,
} from "../lib/store";

export type AdminViewProps = {
  availableDevices: MediaDeviceInfo[];
  onRefreshDevices: () => void;
  onAutoAssignWebcams: () => void;
};

export function AdminView({
  availableDevices,
  onRefreshDevices,
  onAutoAssignWebcams,
}: AdminViewProps) {
  const store = useCamiqStore();
  const site = store.sites[0];
  const center: [number, number] = [site?.lat ?? 28.545, site?.lng ?? 77.1926];

  const [probePoint, setProbePoint] = useState<[number, number] | null>([
    center[0] + 0.00015,
    center[1] + 0.00018,
  ]);

  const probeDecisions = probePoint
    ? planCameras(probePoint[0], probePoint[1], store.cameras)
    : [];

  const openIncidents = store.incidents.filter(
    (i) => i.status !== "RESOLVED" && i.status !== "CANCELLED",
  );
  const onlineCams = store.cameras.filter((c) => c.status === "ONLINE").length;

  return (
    <div className="space-y-5">
      {/* KPI Overview Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="text-[11px] font-mono text-muted-foreground">
            ACTIVE INCIDENTS (APK + WEB)
          </div>
          <div className="text-2xl font-bold font-mono text-destructive mt-1">
            {openIncidents.length}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="text-[11px] font-mono text-muted-foreground">
            USB CAMERAS ONLINE
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {onlineCams} / 3
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="text-[11px] font-mono text-muted-foreground">
            COORDINATOR EVENTS
          </div>
          <div className="text-2xl font-bold font-mono text-primary mt-1">
            {store.coordinatorLogs.length}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="text-[11px] font-mono text-muted-foreground">
            GATE QR SCANS
          </div>
          <div className="text-2xl font-bold font-mono text-warning mt-1">
            {store.gateEvents.length}
          </div>
        </div>
      </div>

      {/* 3-Camera Live Wall + Laptop USB Webcam Orchestration Toolbar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              3-Camera Live Wall & USB Webcam Orchestrator
            </h2>
            <p className="text-xs text-muted-foreground">
              Plug all 3 USB webcams into your laptop and click{" "}
              <strong>Auto-Connect 3 USB Cams</strong>. Reports from the{" "}
              <strong>Student APK ({store.sync.roomCode})</strong> automatically
              switch cameras to INVESTIGATE.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAutoAssignWebcams}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-mono text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" /> Auto-Connect 3 USB Cams (
              {availableDevices.length} found)
            </button>
            <button
              type="button"
              onClick={() => triggerMotionCoordination("CAM-01")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 font-mono text-xs"
            >
              <Activity className="w-3.5 h-3.5 text-warning" /> Coordinate CAM-01 →
              Neighbors
            </button>
            <button
              type="button"
              onClick={resetCamerasToWatch}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary font-mono text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset WATCH
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {store.cameras.map((cam) => (
            <CameraTile
              key={cam.id}
              cam={cam}
              mode={store.cameraModes[cam.code] ?? "WATCH"}
              ackLabel={store.cameraAcks[cam.code]}
              enableQr={cam.code === "CAM-01"}
              availableDevices={availableDevices}
              onRefreshDevices={onRefreshDevices}
            />
          ))}
        </div>
      </div>

      {/* CesiumJS 3D Digital Twin + Coverage-to-Compute Probe & Logs */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase text-muted-foreground">
              CESIUMJS 3D CAMPUS DIGITAL TWIN — CLICK ANY POINT TO RUN COVERAGE-TO-COMPUTE
            </h3>
            <button
              type="button"
              onClick={() =>
                raiseIncident({
                  kind: "sos",
                  lat: probePoint?.[0] ?? center[0] + 0.0001,
                  lng: probePoint?.[1] ?? center[1] + 0.0001,
                  description: "Simulated SOS at 3D Probe Coordinate",
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-destructive/20 text-destructive border border-destructive/40 font-mono text-[11px] font-semibold"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Trigger SOS at Probe
            </button>
          </div>
          <CesiumTwin
            center={center}
            cameras={store.cameras}
            cameraModes={store.cameraModes}
            incidents={store.incidents}
            probePoint={probePoint}
            onPickPoint={(lat, lng) => setProbePoint([lat, lng])}
            height="420px"
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* Live APK & Web Incident Console */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Live APK & Web Incident Feed
              </h3>
              <span className="font-mono text-[10px] text-emerald-400">
                ● ROOM: {store.sync.roomCode}
              </span>
            </div>

            <div className="space-y-2 max-h-[210px] overflow-y-auto font-mono text-[11px]">
              {openIncidents.length === 0 ? (
                <div className="text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                  Report an incident or hold SOS on the Student APK to see it
                  appear live here.
                </div>
              ) : (
                openIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-destructive font-bold">
                        [{inc.ref}] {inc.kind.toUpperCase()} · {inc.student_name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-background text-[10px]">
                        {inc.source_device === "ANDROID_APK"
                          ? "📱 STUDENT APK"
                          : "💻 WEB"}
                      </span>
                    </div>
                    {(inc.category || inc.description) && (
                      <div className="text-foreground/90">
                        {inc.category ? `[${inc.category}] ` : ""}
                        {inc.description}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Status: <strong className="text-foreground">{inc.status}</strong>
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateIncidentStatus(inc.id, "RESPONDER EN ROUTE")
                          }
                          className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px]"
                        >
                          Dispatch Guard
                        </button>
                        <button
                          type="button"
                          onClick={() => updateIncidentStatus(inc.id, "RESOLVED")}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {store.coordinatorLogs.map((line, i) => (
                <div
                  key={i}
                  className="px-2.5 py-1.5 rounded bg-secondary/40 border border-border text-muted-foreground"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* Coverage-to-Compute Decision Engine */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">
                  Coverage-to-Compute Planner
                </h3>
              </div>
              {probePoint && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {probePoint[0].toFixed(4)}, {probePoint[1].toFixed(4)}
                </span>
              )}
            </div>

            <div className="space-y-2 font-mono text-xs">
              {probeDecisions.map((d) => (
                <div
                  key={d.camera.id}
                  className="p-2 rounded-lg border border-border bg-secondary/30 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-foreground">
                      {d.camera.code} · {d.camera.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.reason}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                      d.eligible
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    {d.eligible ? "ELIGIBLE" : "SKIPPED"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
