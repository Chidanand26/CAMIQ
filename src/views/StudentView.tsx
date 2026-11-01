import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Footprints,
  Phone,
  QrCode,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { CesiumTwin } from "../components/CesiumTwin";
import {
  consumeGateToken,
  issuePassToken,
  raiseIncident,
  updateIncidentStatus,
  useCamiqStore,
} from "../lib/store";

const REPORT_CATEGORIES = [
  "Suspicious Activity",
  "Medical Emergency",
  "Harassment / Stalking",
  "Lab Safety Hazard",
  "Unlit / Unsafe Corridor",
];

export function StudentView() {
  const store = useCamiqStore();
  const site = store.sites[0];
  const center: [number, number] = [site?.lat ?? 28.545, site?.lng ?? 77.1926];

  // Press-and-Hold SOS state
  const [holdPct, setHoldPct] = useState(0);
  const [discreet, setDiscreet] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  // Quick Report Incident state (Syncs immediately to Website!)
  const [reportCategory, setReportCategory] = useState(REPORT_CATEGORIES[0]);
  const [reportDesc, setReportDesc] = useState("");
  const [reportSentMsg, setReportSentMsg] = useState<string | null>(null);

  // SafeWalk state
  const [destPoint, setDestPoint] = useState<[number, number] | null>([
    center[0] + 0.00032,
    center[1] + 0.00036,
  ]);
  const [femalePref, setFemalePref] = useState(false);

  // QR Pass state
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrRemaining, setQrRemaining] = useState<number>(0);

  const generateNewQr = async () => {
    const issued = issuePassToken();
    const url = await QRCode.toDataURL(issued.token, {
      margin: 1,
      width: 220,
      color: { dark: "#070b14", light: "#f8fafc" },
    });
    setQrDataUrl(url);
    setQrRemaining(
      Math.max(0, Math.round((issued.expires_at - Date.now()) / 1000)),
    );
  };

  useEffect(() => {
    void generateNewQr();
  }, []);

  useEffect(() => {
    const iv = window.setInterval(() => {
      const active = store.activePassToken;
      if (!active) return;
      const rem = Math.max(
        0,
        Math.round((active.expires_at - Date.now()) / 1000),
      );
      setQrRemaining(rem);
      if (rem === 0) {
        void generateNewQr();
      }
    }, 1000);
    return () => window.clearInterval(iv);
  }, [store.activePassToken]);

  const dispatchSosNow = () => {
    const inc = raiseIncident({
      kind: "sos",
      lat: center[0] + 0.00008,
      lng: center[1] + 0.0001,
      discreet,
      description: discreet
        ? "Discreet SOS triggered from Student APK"
        : "Emergency SOS triggered from Student APK",
    });
    setReportSentMsg(
      `SOS ${inc.ref} dispatched & synced to Website (Room: ${store.sync.roomCode})`,
    );
  };

  const startHold = () => {
    const start = performance.now();
    const duration = 1000;
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setHoldPct(pct);
      if (pct >= 100) {
        setHoldPct(0);
        dispatchSosNow();
      } else {
        holdTimerRef.current = requestAnimationFrame(tick);
      }
    };
    holdTimerRef.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) cancelAnimationFrame(holdTimerRef.current);
    setHoldPct(0);
  };

  const submitStudentReport = () => {
    const desc =
      reportDesc.trim() || `${reportCategory} reported at Main Campus Sector`;
    const inc = raiseIncident({
      kind: "report",
      lat: destPoint?.[0] ?? center[0] + 0.00018,
      lng: destPoint?.[1] ?? center[1] + 0.00022,
      category: reportCategory,
      description: desc,
      discreet,
    });
    setReportDesc("");
    setReportSentMsg(
      `Report ${inc.ref} sent! Check the Website Dashboard (${store.sync.roomCode}).`,
    );
  };

  const activeIncident = store.incidents.find(
    (i) => i.status !== "RESOLVED" && i.status !== "CANCELLED",
  );

  return (
    <div className="space-y-5">
      {/* APK <-> Website Live Connection Banner */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 text-emerald-300">
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>
            <strong>STUDENT APK ↔ WEBSITE SYNC ACTIVE</strong> · Room:{" "}
            <span className="underline">{store.sync.roomCode}</span>
          </span>
        </div>
        <span className="text-muted-foreground">
          Any SOS, Incident Report, SafeWalk, or QR Pass here reflects live on
          the Website.
        </span>
      </div>

      {reportSentMsg && (
        <div className="rounded-xl border border-primary/50 bg-primary/15 px-4 py-2.5 text-xs font-mono text-primary flex items-center justify-between">
          <span>✓ {reportSentMsg}</span>
          <button
            type="button"
            onClick={() => setReportSentMsg(null)}
            className="underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Row: Emergency SOS Orb + Report Incident to Website + Rotating 30s QR Pass */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Left: Press-and-Hold SOS Card */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-primary uppercase">
                STUDENT DISTRESS TRIGGER
              </div>
              <h2 className="text-lg font-bold">Emergency SOS</h2>
            </div>
            <span className="px-2.5 py-1 rounded-full border border-border font-mono text-xs">
              State:{" "}
              <strong className="text-primary">
                {store.studentProfile.campus_state}
              </strong>
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-3">
            <div className="relative flex items-center justify-center">
              <div className="w-36 h-36 rounded-full bg-destructive/20 pulse-ring" />
              <button
                type="button"
                data-testid="sos-hold-button"
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                className="w-32 h-32 rounded-full sos-orb text-white font-bold flex flex-col items-center justify-center select-none active:scale-95 transition cursor-pointer"
              >
                <ShieldAlert className="w-7 h-7 mb-1" />
                <span className="text-base tracking-wider">HOLD SOS</span>
                <span className="font-mono text-[10px] opacity-90">
                  {holdPct > 0 ? `${holdPct}%` : "1.0s OR TAP BELOW"}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              data-testid="instant-sos-button"
              onClick={dispatchSosNow}
              className="w-full py-2 rounded-lg bg-destructive text-white font-mono text-xs font-bold hover:opacity-95 transition"
            >
              🚨 SEND INSTANT SOS TO WEBSITE
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscreet((v) => !v)}
                className={`px-3 py-2 rounded-lg border font-mono text-xs flex items-center justify-center gap-1.5 transition ${
                  discreet
                    ? "bg-warning/20 border-warning text-warning"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                {discreet ? "Discreet ON" : "Discreet SOS"}
              </button>
              <a
                href="tel:112"
                onClick={() => {
                  window.CamiqNativeBridge?.dialEmergency?.("112");
                }}
                className="px-3 py-2 rounded-lg border border-destructive/40 bg-destructive/15 text-destructive font-mono text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" /> Call 112
              </a>
            </div>
          </div>

          {/* Active Incident Live Status */}
          {activeIncident && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-destructive">
                  ACTIVE {activeIncident.ref} · {activeIncident.status}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateIncidentStatus(activeIncident.id, "RESOLVED")
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[10px]"
                >
                  <CheckCircle2 className="w-3 h-3" /> I Am Safe
                </button>
              </div>
              {activeIncident.camera_plan && (
                <div className="space-y-1 pt-1 border-t border-destructive/20 font-mono text-[11px]">
                  <div className="text-muted-foreground">
                    COORDINATED CAMERA COVERAGE PLAN:
                  </div>
                  {activeIncident.camera_plan.map((cp) => (
                    <div
                      key={cp.code}
                      className="flex items-center justify-between"
                    >
                      <span
                        className={
                          cp.eligible
                            ? "text-emerald-400 font-semibold"
                            : "text-muted-foreground"
                        }
                      >
                        {cp.code} {cp.eligible ? "→ INVESTIGATE" : "→ SKIPPED"}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                        {cp.reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: Quick Incident Report Form (Reflects Immediately on Website) */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h3 className="font-semibold text-sm">
                Report Incident to Website
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Submit a campus safety report from the Student APK. It immediately
              triggers camera orchestration & appears on the Website dashboard.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                INCIDENT CATEGORY
              </label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 font-mono text-xs text-foreground"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-[11px] text-muted-foreground mb-1">
                DETAILS / LOCATION NOTE
              </label>
              <textarea
                rows={3}
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="Describe what you see (e.g., Unattended spark in Robotics Lab corridor)..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground resize-none"
              />
            </div>
          </div>

          <button
            type="button"
            data-testid="submit-student-report-btn"
            onClick={submitStudentReport}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-mono text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Report to Campus Website
          </button>

          {/* SafeWalk Quick Trigger */}
          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs flex items-center gap-1.5">
                <Footprints className="w-3.5 h-3.5 text-primary" /> SafeWalk
                Escort
              </span>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={femalePref}
                  onChange={(e) => setFemalePref(e.target.checked)}
                />
                <span>Female Guard</span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                const inc = raiseIncident({
                  kind: "safewalk",
                  lat: center[0],
                  lng: center[1],
                  dest_lat: destPoint?.[0] ?? center[0] + 0.0003,
                  dest_lng: destPoint?.[1] ?? center[1] + 0.0003,
                  female_pref: femalePref,
                  description:
                    "SafeWalk escort requested from Student APK to Residence Hall",
                });
                setReportSentMsg(
                  `SafeWalk ${inc.ref} synced to Website Guard & Admin consoles!`,
                );
              }}
              className="w-full py-2 rounded-lg border border-primary/40 bg-primary/15 text-primary font-mono text-xs font-semibold"
            >
              Request Monitored SafeWalk
            </button>
          </div>
        </div>

        {/* Right: Rotating 30s QR Gate Pass */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Campus Gate QR Pass</h3>
            </div>
            <span className="font-mono text-xs text-primary">
              {qrRemaining}s TTL
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Campus Entry QR Pass"
                className="w-40 h-40 rounded-lg border border-border p-1.5 bg-white"
              />
            )}
            <div className="font-mono text-xs mt-2 text-muted-foreground">
              {store.activePassToken?.token ?? "ISSUING..."}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground">
              Hold your phone screen up to{" "}
              <strong>CAM-01 (Laptop USB Webcam)</strong> or tap below to test
              gate verification:
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void generateNewQr()}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary font-mono text-xs flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Rotate QR
              </button>
              <button
                type="button"
                onClick={() => {
                  if (store.activePassToken) {
                    consumeGateToken(
                      store.activePassToken.token,
                      "CAM-01",
                      "Main Gate Entrance",
                      "AUTO",
                    );
                  }
                }}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-mono text-xs font-semibold"
              >
                Scan at CAM-01
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Interactive CesiumJS 3D Digital Twin */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase text-muted-foreground">
            LIVE 3D CAMPUS DIGITAL TWIN — CLICK ANY BUILDING TO SET REPORT / SAFEWALK LOCATION
          </h3>
        </div>
        <CesiumTwin
          center={center}
          cameras={store.cameras}
          cameraModes={store.cameraModes}
          incidents={store.incidents}
          safeWalkDest={destPoint}
          onPickPoint={(lat, lng) => setDestPoint([lat, lng])}
          height="360px"
        />
      </div>
    </div>
  );
}
