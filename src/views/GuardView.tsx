import { useCallback, useRef, useState } from "react";
import { CheckCircle2, QrCode, Shield, Siren, Smartphone } from "lucide-react";
import { CameraTile } from "../components/CameraTile";
import { CesiumTwin } from "../components/CesiumTwin";
import {
  consumeGateToken,
  toggleGuardDuty,
  updateIncidentStatus,
  useCamiqStore,
} from "../lib/store";

export type GuardViewProps = {
  availableDevices: MediaDeviceInfo[];
  onRefreshDevices: () => void;
};

export function GuardView({
  availableDevices,
  onRefreshDevices,
}: GuardViewProps) {
  const store = useCamiqStore();
  const site = store.sites[0];
  const center: [number, number] = [site?.lat ?? 28.545, site?.lng ?? 77.1926];

  const [gateMode, setGateMode] = useState<"AUTO" | "IN" | "OUT">("AUTO");
  const [manualToken, setManualToken] = useState("");
  const lastDecodedRef = useRef<{ token: string; at: number }>({
    token: "",
    at: 0,
  });

  const handleQrDecoded = useCallback(
    (raw: string) => {
      const now = Date.now();
      if (
        lastDecodedRef.current.token === raw &&
        now - lastDecodedRef.current.at < 3500
      ) {
        return;
      }
      lastDecodedRef.current = { token: raw, at: now };
      consumeGateToken(raw, "CAM-01", "Main Gate Entrance", gateMode);
    },
    [gateMode],
  );

  const openIncidents = store.incidents.filter(
    (i) => i.status !== "RESOLVED" && i.status !== "CANCELLED",
  );

  return (
    <div className="space-y-5">
      {/* Top Guard Duty Bar */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">
              Security Responder Dispatch Console
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {openIncidents.length} ACTIVE INCIDENTS ·{" "}
              {store.cameras.filter((c) => c.status === "ONLINE").length}/3 USB
              CAMERAS STREAMING · SYNC ROOM: {store.sync.roomCode}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleGuardDuty(!store.guardOnDuty)}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold border transition ${
              store.guardOnDuty
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-secondary text-muted-foreground border-border"
            }`}
          >
            {store.guardOnDuty ? "● ON DUTY" : "○ OFF DUTY"}
          </button>
        </div>
      </div>

      {/* 3-Camera Live Wall (CAM-01 with jsQR Gate Scanner, CAM-02, CAM-03) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase text-muted-foreground">
            LIVE 3-CAMERA USB WEBCAM WALL (CAM-01 DECODES STUDENT APK QR PASSES IN REAL TIME)
          </h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {store.cameras.map((cam) => (
            <CameraTile
              key={cam.id}
              cam={cam}
              mode={store.cameraModes[cam.code] ?? "WATCH"}
              ackLabel={store.cameraAcks[cam.code]}
              enableQr={cam.code === "CAM-01"}
              onQrDecoded={cam.code === "CAM-01" ? handleQrDecoded : undefined}
              availableDevices={availableDevices}
              onRefreshDevices={onRefreshDevices}
            />
          ))}
        </div>
      </div>

      {/* Middle Row: Cesium 3D Digital Twin + Active Incident Queue & QR Gate Log */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-2">
          <h3 className="text-xs font-mono uppercase text-muted-foreground">
            3D DIGITAL TWIN — VOLUMETRIC CAMERA CONES & ACTIVE SOS BEACONS
          </h3>
          <CesiumTwin
            center={center}
            cameras={store.cameras}
            cameraModes={store.cameraModes}
            incidents={store.incidents}
            height="400px"
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* Incident Queue */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Siren className="w-4 h-4 text-destructive" />
                <h3 className="font-semibold text-sm">
                  Active Incident Queue (APK & Web)
                </h3>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {openIncidents.length} Open
              </span>
            </div>

            {openIncidents.length === 0 ? (
              <div className="text-xs text-muted-foreground font-mono py-6 text-center border border-dashed border-border rounded-lg">
                NO ACTIVE INCIDENTS — WAITING FOR STUDENT APK OR WEB TRIGGER
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                {openIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-destructive">
                          {inc.ref} · {inc.kind.toUpperCase()}
                        </span>
                        {inc.source_device === "ANDROID_APK" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[10px]">
                            <Smartphone className="w-2.5 h-2.5" /> APK
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-background/80">
                        {inc.status}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Student:{" "}
                      <strong className="text-foreground">
                        {inc.student_name}
                      </strong>
                      {inc.category && ` · ${inc.category}`}
                      {inc.female_pref && " · Prefers Female Responder"}
                    </div>
                    {inc.description && (
                      <div className="text-[11px] text-foreground/90 bg-background/60 rounded px-2 py-1">
                        {inc.description}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateIncidentStatus(inc.id, "ACKNOWLEDGED")
                        }
                        className="px-2.5 py-1 rounded border border-border bg-background hover:bg-secondary font-mono text-[10px]"
                      >
                        Acknowledge
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateIncidentStatus(inc.id, "RESPONDER EN ROUTE")
                        }
                        className="px-2.5 py-1 rounded bg-primary text-primary-foreground font-mono text-[10px] font-semibold"
                      >
                        Accept & Go
                      </button>
                      <button
                        type="button"
                        onClick={() => updateIncidentStatus(inc.id, "RESOLVED")}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CAM-01 QR Gate Access Control */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">CAM-01 Gate QR Monitor</h3>
              </div>
              <div className="flex gap-1 font-mono text-[10px]">
                {(["AUTO", "IN", "OUT"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setGateMode(m)}
                    className={`px-2 py-0.5 rounded border ${
                      gateMode === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste or scan CAMIQ-XXXX token..."
                className="flex-1 bg-background border border-border rounded px-2.5 py-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!manualToken.trim()) return;
                  consumeGateToken(
                    manualToken,
                    "CAM-01",
                    "Main Gate Entrance",
                    gateMode,
                  );
                  setManualToken("");
                }}
                className="px-3 py-1 rounded bg-primary text-primary-foreground font-mono text-xs font-semibold"
              >
                Verify
              </button>
            </div>

            <div className="space-y-1.5 max-h-[120px] overflow-y-auto font-mono text-[11px]">
              {store.gateEvents.length === 0 ? (
                <div className="text-muted-foreground text-center py-2">
                  Hold Student APK QR code up to CAM-01 webcam to log entry/exit.
                </div>
              ) : (
                store.gateEvents.slice(0, 6).map((ge) => (
                  <div
                    key={ge.id}
                    className="flex items-center justify-between px-2 py-1 rounded bg-secondary/40 border border-border"
                  >
                    <span>
                      [{ge.direction}] {ge.subject}
                    </span>
                    <span
                      className={
                        ge.result === "ACCESS RECORDED"
                          ? "text-emerald-400 font-semibold"
                          : "text-destructive font-semibold"
                      }
                    >
                      {ge.result}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
