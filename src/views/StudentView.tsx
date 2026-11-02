import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  CheckCircle2,
  EyeOff,
  Footprints,
  Phone,
  QrCode,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import { CesiumTwin } from "../components/CesiumTwin";
import { KLE_BUILDINGS, KLE_CAMPUS } from "../lib/kleCampusData";
import {
  consumeGateToken,
  issuePassToken,
  raiseIncident,
  setStudentGender,
  updateIncidentStatus,
  useCamiqStore,
} from "../lib/store";

const GIRL_CATEGORIES = [
  "Uncomfortable / Followed",
  "Harassment / Stalking",
  "Unlit / Unsafe Walkway",
  "Ladies Hostel Escort Needed",
  "Medical Assistance",
];

const BOY_CATEGORIES = [
  "Suspicious Activity",
  "Medical Emergency",
  "Lab / Workshop Hazard",
  "Hostel / Late-Night Escort",
  "Campus Security Alert",
];

export function StudentView() {
  const store = useCamiqStore();
  const isGirl = store.studentGender === "girl";

  const [holdPct, setHoldPct] = useState(0);
  const [discreet, setDiscreet] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  const categories = isGirl ? GIRL_CATEGORIES : BOY_CATEGORIES;
  const [reportCategory, setReportCategory] = useState(categories[0]);
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    isGirl ? "way-381451253" : "way-552744239",
  );
  const [reportDesc, setReportDesc] = useState("");
  const [reportSentMsg, setReportSentMsg] = useState<string | null>(null);

  const [femalePref, setFemalePref] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrRemaining, setQrRemaining] = useState<number>(0);

  // Sync default category & hostel when switching Girl / Boy
  useEffect(() => {
    setReportCategory((isGirl ? GIRL_CATEGORIES : BOY_CATEGORIES)[0]);
    setSelectedBuildingId(isGirl ? "way-381451253" : "way-552744239");
    setFemalePref(isGirl);
  }, [isGirl]);

  const selectedBuilding =
    KLE_BUILDINGS.find((b) => b.id === selectedBuildingId) ?? KLE_BUILDINGS[0];

  const generateNewQr = async () => {
    const issued = issuePassToken();
    const url = await QRCode.toDataURL(issued.token, {
      margin: 1,
      width: 190,
      color: { dark: "#05090d", light: "#ffffff" },
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
      lat: selectedBuilding.centerLat,
      lng: selectedBuilding.centerLng,
      building_name: selectedBuilding.name,
      discreet,
      female_pref: femalePref,
      description: `${isGirl ? "Girl" : "Boy"} Student SOS near ${selectedBuilding.name}`,
    });
    setReportSentMsg(
      `SOS (${inc.ref}) at ${selectedBuilding.name} synced to Website!`,
    );
  };

  const startHold = () => {
    const start = performance.now();
    const duration = 900;
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
      reportDesc.trim() || `${reportCategory} at ${selectedBuilding.name}`;
    const inc = raiseIncident({
      kind: "report",
      lat: selectedBuilding.centerLat,
      lng: selectedBuilding.centerLng,
      building_name: selectedBuilding.name,
      category: reportCategory,
      description: desc,
      female_pref: femalePref,
      discreet,
    });
    setReportDesc("");
    setReportSentMsg(
      `Report (${inc.ref}) at ${selectedBuilding.name} sent to Website!`,
    );
  };

  const activeIncident = store.incidents.find(
    (i) => i.status !== "RESOLVED" && i.status !== "CANCELLED",
  );

  // Student-only dynamic accent styling (Rose Pink for Girl, Cyan Blue for Boy)
  const cardBorder = isGirl
    ? "border-pink-500/35 bg-[#140a12]/90"
    : "border-[#00e5ff]/30 bg-[#060c11]/90";
  const accentText = isGirl ? "text-pink-400" : "text-[#00e5ff]";
  const primaryBtn = isGirl
    ? "bg-pink-500 hover:bg-pink-600 text-white"
    : "bg-[#00e5ff] hover:opacity-90 text-[#05090d]";

  return (
    <div className="space-y-4">
      {/* Student App Top Bar: Girl / Boy Mode Switcher + KLE Tech Campus Location Dropdown */}
      <div
        className={`rounded-xl border ${cardBorder} px-4 py-3 flex flex-wrap items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-black/40 border border-white/15">
            <button
              type="button"
              data-testid="student-gender-girl"
              onClick={() => setStudentGender("girl")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                isGirl
                  ? "bg-pink-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              👧 Girl Mode
            </button>
            <button
              type="button"
              data-testid="student-gender-boy"
              onClick={() => setStudentGender("boy")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                !isGirl
                  ? "bg-[#00e5ff] text-[#05090d]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              👦 Boy Mode
            </button>
          </div>

          <div className="text-xs">
            <div className="font-bold text-foreground">
              {store.studentProfile.full_name}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {store.studentProfile.student_id} · Gate:{" "}
              <strong className={accentText}>
                {store.studentProfile.campus_state}
              </strong>
            </div>
          </div>
        </div>

        {/* KLE Tech Building Location Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-[10px] text-muted-foreground">
            CURRENT LOCATION:
          </span>
          <select
            aria-label="Select KLE Tech Campus Building"
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value)}
            className="bg-black/50 border border-white/20 rounded-lg px-2.5 py-1.5 font-mono text-xs text-foreground"
          >
            {KLE_BUILDINGS.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#060c11]">
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {reportSentMsg && (
        <div
          className={`rounded-xl border px-4 py-2 text-xs font-mono flex items-center justify-between ${
            isGirl
              ? "border-pink-400/50 bg-pink-500/15 text-pink-200"
              : "border-[#00e5ff]/50 bg-[#00e5ff]/15 text-[#00e5ff]"
          }`}
        >
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

      {/* Clean 3-Card Row: 1. SOS Trigger | 2. Report & SafeWalk (with Dropdowns) | 3. Gate QR Pass */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* 1. SOS Emergency Card */}
        <div
          className={`rounded-xl border ${cardBorder} p-5 flex flex-col justify-between space-y-4`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className={`font-mono text-[10px] uppercase ${accentText}`}>
                {isGirl ? "WOMEN'S CAMPUS SAFETY" : "STUDENT EMERGENCY SOS"}
              </span>
              <h2 className="text-base font-bold">Emergency SOS</h2>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {selectedBuilding.name}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-36 h-36 rounded-full pulse-ring ${
                  isGirl ? "bg-pink-500/25" : "bg-rose-500/25"
                }`}
              />
              <button
                type="button"
                data-testid="sos-hold-button"
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                onClick={dispatchSosNow}
                className={`w-32 h-32 rounded-full text-white font-bold flex flex-col items-center justify-center select-none active:scale-95 transition cursor-pointer ${
                  isGirl ? "sos-orb-girl" : "sos-orb-boy"
                }`}
              >
                <ShieldAlert className="w-7 h-7 mb-1" />
                <span className="text-base tracking-wider">SOS</span>
                <span className="font-mono text-[10px] opacity-90">
                  {holdPct > 0 ? `${holdPct}%` : "TAP OR HOLD"}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDiscreet((v) => !v)}
              className={`px-3 py-2 rounded-lg border font-mono text-xs flex items-center justify-center gap-1.5 transition ${
                discreet
                  ? "bg-warning/20 border-warning text-warning"
                  : "border-white/15 bg-black/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              {discreet ? "Silent ON" : "Silent SOS"}
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

          {activeIncident && (
            <div className="rounded-lg border border-white/15 bg-black/40 p-2.5 flex items-center justify-between text-xs font-mono">
              <span className={accentText}>
                {activeIncident.ref} · {activeIncident.status}
              </span>
              <button
                type="button"
                onClick={() =>
                  updateIncidentStatus(activeIncident.id, "RESOLVED")
                }
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]"
              >
                <CheckCircle2 className="w-3 h-3" /> Safe
              </button>
            </div>
          )}
        </div>

        {/* 2. Quick Report & SafeWalk with Dropdowns */}
        <div
          className={`rounded-xl border ${cardBorder} p-5 flex flex-col justify-between space-y-3`}
        >
          <div>
            <span className={`font-mono text-[10px] uppercase ${accentText}`}>
              INSTANT WEBSITE SYNC
            </span>
            <h3 className="font-bold text-base">Report Incident & SafeWalk</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block font-mono text-[10px] text-muted-foreground mb-1">
                CATEGORY
              </label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 font-mono text-xs text-foreground"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-[#060c11]">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              placeholder="Optional note (e.g., Near C-LITE stairs)..."
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-foreground"
            />

            <button
              type="button"
              data-testid="submit-student-report-btn"
              onClick={submitStudentReport}
              className={`w-full py-2 rounded-lg font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition ${primaryBtn}`}
            >
              <Send className="w-3.5 h-3.5" /> Report to Website
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-1.5">
                <Footprints className={`w-3.5 h-3.5 ${accentText}`} /> SafeWalk
                Escort
              </span>
              {isGirl && (
                <label className="flex items-center gap-1.5 text-[11px] text-pink-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={femalePref}
                    onChange={(e) => setFemalePref(e.target.checked)}
                    className="accent-pink-500"
                  />
                  <span>Female Guard</span>
                </label>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const inc = raiseIncident({
                  kind: "safewalk",
                  lat: KLE_CAMPUS.latitude,
                  lng: KLE_CAMPUS.longitude,
                  dest_lat: selectedBuilding.centerLat,
                  dest_lng: selectedBuilding.centerLng,
                  building_name: selectedBuilding.name,
                  female_pref: femalePref,
                  description: `SafeWalk escort to ${selectedBuilding.name}`,
                });
                setReportSentMsg(
                  `SafeWalk (${inc.ref}) to ${selectedBuilding.name} active on Website!`,
                );
              }}
              className="w-full py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 font-mono text-xs font-semibold transition"
            >
              Request Escort to {selectedBuilding.name.split(" ")[0]}
            </button>
          </div>
        </div>

        {/* 3. Rotating 30s Gate QR Pass */}
        <div
          className={`rounded-xl border ${cardBorder} p-5 flex flex-col justify-between space-y-3`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className={`w-4 h-4 ${accentText}`} />
              <h3 className="font-bold text-base">Gate QR Pass</h3>
            </div>
            <span className={`font-mono text-xs font-semibold ${accentText}`}>
              {qrRemaining}s TTL
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-1">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Campus Entry QR Pass"
                className="w-36 h-36 rounded-xl border border-white/20 p-1.5 bg-white"
              />
            )}
            <div className="font-mono text-xs mt-2 text-muted-foreground">
              {store.activePassToken?.token ?? "ISSUING..."}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void generateNewQr()}
              className="flex-1 py-2 rounded-lg border border-white/15 bg-black/30 hover:bg-white/10 font-mono text-xs flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Rotate
            </button>
            <button
              type="button"
              onClick={() => {
                if (store.activePassToken) {
                  consumeGateToken(
                    store.activePassToken.token,
                    "CAM-01",
                    "KLE Tech Main Gate",
                    "AUTO",
                  );
                }
              }}
              className={`flex-1 py-2 rounded-lg font-mono text-xs font-semibold ${primaryBtn}`}
            >
              Scan CAM-01
            </button>
          </div>
        </div>
      </div>

      {/* KLE Tech Hubballi 3D Digital Twin */}
      <CesiumTwin
        cameras={store.cameras}
        cameraModes={store.cameraModes}
        incidents={store.incidents}
        safeWalkDest={[selectedBuilding.centerLat, selectedBuilding.centerLng]}
        height="360px"
      />
    </div>
  );
}
