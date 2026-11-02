import { useCallback, useRef, useState } from "react";
import { CheckCircle2, QrCode, Shield, Siren } from "lucide-react";
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
      consumeGateToken(raw, "CAM-01", "KLE Tech Main Gate", gateMode);
    },
    [gateMode],
  );

  const openIncidents = store.incidents.filter(
    (i) => i.status !== "RESOLVED" && i.status !== "CANCELLED",
  );

  return (
    <div className="space-y-4">
      {/* Guard Status Bar */}
      <div className="rounded-xl glass-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#00e5ff]" />
          <div>
            <div className="text-sm font-bold">
              KLE Tech Security Responder Console
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {openIncidents.length} ACTIVE INCIDENTS ·{" "}
              {store.cameras.filter((c) => c.status === "ONLINE").length}/3 USB
              CAMERAS ONLINE
            </div>
          </div>
        </div>

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

      {/* 3-Camera Live Wall */}
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

      {/* KLE Tech 3D Digital Twin + Active Queue & Gate Monitor */}
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <CesiumTwin
            cameras={store.cameras}
            cameraModes={store.cameraModes}
            incidents={store.incidents}
            height="400px"
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* Active Incident Queue */}
          <div className="rounded-xl glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Siren className="w-4 h-4 text-destructive" />
                <h3 className="font-bold text-sm">Active Incident Queue</h3>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {openIncidents.length} Open
              </span>
            </div>

            {openIncidents.length === 0 ? (
              <div className="text-xs text-muted-foreground font-mono py-6 text-center border border-dashed border-white/15 rounded-lg">
                NO ACTIVE INCIDENTS — ALL KLE TECH SECTORS NOMINAL
              </div>
            ) : (
              <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                {openIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-destructive">
                        {inc.ref} · {inc.kind.toUpperCase()}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/60">
                        {inc.student_gender === "girl" ? "👧 GIRL" : "👦 BOY"} ·{" "}
                        {inc.status}
                      </span>
                    </div>
                    <div className="text-foreground">
                      <strong>{inc.student_name}</strong>
                      {inc.building_name && ` · ${inc.building_name}`}
                      {inc.female_pref && " · Female Responder"}
                    </div>
                    {inc.description && (
                      <div className="text-[11px] text-muted-foreground">
                        {inc.description}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateIncidentStatus(inc.id, "ACKNOWLEDGED")
                        }
                        className="px-2.5 py-1 rounded border border-white/15 bg-black/40 hover:bg-white/10 font-mono text-[10px]"
                      >
                        Acknowledge
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateIncidentStatus(inc.id, "RESPONDER EN ROUTE")
                        }
                        className="px-2.5 py-1 rounded bg-[#00e5ff] text-[#05090d] font-mono text-[10px] font-semibold"
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

          {/* CAM-01 Gate QR Scanner */}
          <div className="rounded-xl glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#00e5ff]" />
                <h3 className="font-bold text-sm">CAM-01 Gate QR Monitor</h3>
              </div>
              <select
                value={gateMode}
                onChange={(e) =>
                  setGateMode(e.target.value as "AUTO" | "IN" | "OUT")
                }
                className="bg-[#060c11] border border-white/15 rounded px-2 py-0.5 font-mono text-[10px]"
              >
                <option value="AUTO">MODE: AUTO</option>
                <option value="IN">MODE: ENTRY (IN)</option>
                <option value="OUT">MODE: EXIT (OUT)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="CAMIQ-XXXX token..."
                className="flex-1 bg-black/40 border border-white/15 rounded px-2.5 py-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!manualToken.trim()) return;
                  consumeGateToken(
                    manualToken,
                    "CAM-01",
                    "KLE Tech Main Gate",
                    gateMode,
                  );
                  setManualToken("");
                }}
                className="px-3 py-1 rounded bg-[#00e5ff] text-[#05090d] font-mono text-xs font-semibold"
              >
                Verify
              </button>
            </div>

            <div className="space-y-1 max-h-[95px] overflow-y-auto font-mono text-[11px]">
              {store.gateEvents.slice(0, 4).map((ge) => (
                <div
                  key={ge.id}
                  className="flex items-center justify-between px-2 py-1 rounded bg-black/30 border border-white/10"
                >
                  <span>
                    [{ge.direction}] {ge.subject}
                  </span>
                  <span
                    className={
                      ge.result === "ACCESS RECORDED"
                        ? "text-emerald-400"
                        : "text-destructive"
                    }
                  >
                    {ge.result}
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
