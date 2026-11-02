import { useState } from "react";
import {
  Camera,
  CheckCircle2,
  Crosshair,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { CameraTile } from "../components/CameraTile";
import { CesiumTwin } from "../components/CesiumTwin";
import { planCameras } from "../lib/geo";
import { KLE_CAMPUS } from "../lib/kleCampusData";
import {
  raiseIncident,
  resetCamerasToWatch,
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

  const [probePoint, setProbePoint] = useState<[number, number]>([
    KLE_CAMPUS.latitude,
    KLE_CAMPUS.longitude,
  ]);

  const probeDecisions = planCameras(
    probePoint[0],
    probePoint[1],
    store.cameras,
  );

  const openIncidents = store.incidents.filter(
    (i) => i.status !== "RESOLVED" && i.status !== "CANCELLED",
  );
  const onlineCams = store.cameras.filter((c) => c.status === "ONLINE").length;

  return (
    <div className="space-y-4">
      {/* Top 4 Metric Cards (Matching KLE Tech Digital Twin Reference) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl glass-card p-3.5">
          <div className="text-[10px] font-mono tracking-wider text-muted-foreground">
            ACTIVE SOS / REPORTS
          </div>
          <div className="text-2xl font-bold font-mono text-destructive mt-1">
            {String(openIncidents.length).padStart(2, "0")}
          </div>
        </div>
        <div className="rounded-xl glass-card p-3.5">
          <div className="text-[10px] font-mono tracking-wider text-muted-foreground">
            USB CAMERAS ONLINE
          </div>
          <div className="text-2xl font-bold font-mono text-[#00e5ff] mt-1">
            {onlineCams} / 3
          </div>
        </div>
        <div className="rounded-xl glass-card p-3.5">
          <div className="text-[10px] font-mono tracking-wider text-muted-foreground">
            KLE TECH 3D BUILDINGS
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            16 OSM
          </div>
        </div>
        <div className="rounded-xl glass-card p-3.5">
          <div className="text-[10px] font-mono tracking-wider text-muted-foreground">
            GATE QR SCANS
          </div>
          <div className="text-2xl font-bold font-mono text-warning mt-1">
            {String(store.gateEvents.length).padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* 3-Camera Live Wall */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#00e5ff]" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              LIVE 3-CAMERA USB WALL · KLE TECH HUBBALLI
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAutoAssignWebcams}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#00e5ff] text-[#05090d] font-mono text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" /> Auto-Connect 3 USB Cams
            </button>
            <button
              type="button"
              onClick={resetCamerasToWatch}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/15 hover:bg-white/10 font-mono text-xs"
            >
              <RotateCcw className="w-3 h-3" /> Reset Watch
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

      {/* KLE Tech Hubballi 3D Digital Twin + Incident & Spatial Coverage Console */}
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted-foreground">
              KLE TECHNOLOGICAL UNIVERSITY (B. V. BHOOMARADDI CAMPUS, HUBBALLI)
            </span>
            <button
              type="button"
              onClick={() =>
                raiseIncident({
                  kind: "sos",
                  lat: probePoint[0],
                  lng: probePoint[1],
                  building_name: "Main Building (BVBCET Block)",
                  description: "Demo SOS on KLE Tech Hubballi 3D Twin",
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-destructive/20 text-destructive border border-destructive/40 font-mono text-[11px] font-semibold"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Run Demo SOS
            </button>
          </div>

          <CesiumTwin
            cameras={store.cameras}
            cameraModes={store.cameraModes}
            incidents={store.incidents}
            probePoint={probePoint}
            onPickPoint={(lat, lng) => setProbePoint([lat, lng])}
            height="430px"
          />
        </div>

        <div className="lg:col-span-4 space-y-4">
          {/* Active Incident Console */}
          <div className="rounded-xl glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  INCIDENT CONSOLE
                </div>
                <h3 className="font-bold text-sm">
                  {openIncidents.length > 0
                    ? "Active Student Alerts"
                    : "Situation Nominal"}
                </h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                  openIncidents.length > 0
                    ? "bg-destructive/15 text-destructive border-destructive/40"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                }`}
              >
                {openIncidents.length > 0 ? "SOS ACTIVE" : "NOMINAL"}
              </span>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto font-mono text-[11px]">
              {openIncidents.length === 0 ? (
                <div className="text-muted-foreground text-center py-5 border border-dashed border-white/15 rounded-lg">
                  Report an incident from the Student APK ({store.sync.roomCode}
                  ) or click Run Demo SOS.
                </div>
              ) : (
                openIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-2.5 rounded-lg border border-destructive/40 bg-destructive/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-destructive font-bold">
                        {inc.ref} · {inc.kind.toUpperCase()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px]">
                        {inc.student_gender === "girl" ? "👧 Girl" : "👦 Boy"}
                      </span>
                    </div>
                    <div className="text-foreground">
                      {inc.student_name}
                      {inc.building_name ? ` · ${inc.building_name}` : ""}
                    </div>
                    {inc.description && (
                      <div className="text-muted-foreground text-[10px]">
                        {inc.description}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-warning">
                        {inc.status}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateIncidentStatus(inc.id, "RESPONDER EN ROUTE")
                          }
                          className="px-2 py-0.5 rounded bg-[#00e5ff] text-[#05090d] font-semibold text-[10px]"
                        >
                          Dispatch
                        </button>
                        <button
                          type="button"
                          onClick={() => updateIncidentStatus(inc.id, "RESOLVED")}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Clear
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Spatial Camera Coverage Planner */}
          <div className="rounded-xl glass-card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-[#00e5ff]" />
                <h3 className="font-bold text-sm">Cameras Covering Location</h3>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {probePoint[0].toFixed(4)}, {probePoint[1].toFixed(4)}
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              {probeDecisions.map((d) => (
                <div
                  key={d.camera.id}
                  className="p-2 rounded-lg border border-white/10 bg-black/30 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-foreground">
                      {d.camera.code} · {d.camera.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {d.reason}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                      d.eligible
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-white/5 text-muted-foreground border border-white/10"
                    }`}
                  >
                    {d.eligible ? "IN FOV" : "OUT"}
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
