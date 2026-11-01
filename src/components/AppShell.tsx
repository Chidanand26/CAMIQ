import { type ReactNode, useState } from "react";
import {
  Camera,
  Link2,
  Radio,
  RefreshCw,
  Shield,
  Smartphone,
  X,
} from "lucide-react";
import {
  clearSyncBanner,
  pollSyncChannelNow,
  type Role,
  setRole,
  updateSyncConfig,
  useCamiqStore,
} from "../lib/store";

export type AppShellProps = {
  title: string;
  subtitle: string;
  badge: string;
  onAutoAssignWebcams: () => void;
  usbCameraCount: number;
  children: ReactNode;
};

export function AppShell({
  title,
  subtitle,
  badge,
  onAutoAssignWebcams,
  usbCameraCount,
  children,
}: AppShellProps) {
  const store = useCamiqStore();
  const [showSyncBar, setShowSyncBar] = useState(false);
  const [roomInput, setRoomInput] = useState(store.sync.roomCode);
  const [serverInput, setServerInput] = useState(store.sync.laptopServerUrl);

  const roles: { role: Role; label: string; route: string }[] = [
    { role: "student", label: "SAFE · Student", route: "/student" },
    { role: "guard", label: "RESPONSE · Guard", route: "/guard" },
    { role: "admin", label: "COMMAND · Admin", route: "/admin" },
  ];

  const onlineCams = store.cameras.filter((c) => c.status === "ONLINE").length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Unified Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight truncate">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-sm">CAMIQ</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                  {badge}
                </span>
                {store.isAndroidApk && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <Smartphone className="w-3 h-3" /> STUDENT APK
                  </span>
                )}
                {!store.isAndroidApk && (
                  <span className="hidden md:inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                    <Radio className="w-3 h-3 text-emerald-400" /> {onlineCams}/3
                    CAMS LIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block truncate">
                {title} — {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* APK <-> Website Live Sync Status Button */}
            <button
              type="button"
              onClick={() => setShowSyncBar((v) => !v)}
              data-testid="toggle-sync-config-btn"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-mono text-[11px] font-semibold transition"
              title="Configure Student APK ↔ Website Live Sync Room"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                APK↔WEB: {store.sync.roomCode}
              </span>
            </button>

            {/* 1-Click USB 3-Camera Auto-Assign for Laptop Demo */}
            {!store.isAndroidApk && (
              <button
                type="button"
                onClick={onAutoAssignWebcams}
                data-testid="auto-connect-webcams-btn"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/15 hover:bg-primary/25 text-primary border border-primary/40 font-mono text-[11px] font-semibold transition"
                title="Discover and bind up to 3 connected USB webcams to CAM-01, CAM-02, CAM-03"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Auto-Connect 3 USB Cams</span>
                <span className="px-1.5 py-0.2 rounded bg-primary/20 text-[10px]">
                  {usbCameraCount}
                </span>
              </button>
            )}

            {/* Role Preview Switcher */}
            <div
              data-testid="role-preview-bar"
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-warning/40 bg-warning/10 text-warning text-[11px] font-mono"
            >
              <span className="hidden lg:inline font-bold mr-1">ROLE:</span>
              {roles.map((r) => (
                <button
                  key={r.role}
                  type="button"
                  data-testid={`switch-role-${r.role}`}
                  onClick={() => setRole(r.role)}
                  className={`px-2 py-0.5 rounded transition ${
                    store.role === r.role
                      ? "bg-warning text-warning-foreground font-semibold"
                      : "hover:bg-warning/20"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Expandable APK <-> Website Sync Configuration Bar */}
        {showSyncBar && (
          <div className="border-t border-border bg-secondary/60 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-emerald-400 font-semibold">
                  ● APK ↔ WEBSITE LIVE BRIDGE:
                </span>
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Room Code:</span>
                  <input
                    type="text"
                    value={roomInput}
                    onChange={(e) => setRoomInput(e.target.value)}
                    className="bg-background border border-border rounded px-2 py-1 text-xs w-40 text-foreground"
                    placeholder="CAMIQ-LIVE-2026"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">
                    Optional Laptop URL:
                  </span>
                  <input
                    type="text"
                    value={serverInput}
                    onChange={(e) => setServerInput(e.target.value)}
                    className="bg-background border border-border rounded px-2 py-1 text-xs w-48 text-foreground"
                    placeholder="http://192.168.1.x:3000"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    updateSyncConfig({
                      roomCode: roomInput.trim() || "CAMIQ-LIVE-2026",
                      laptopServerUrl: serverInput.trim(),
                    });
                    pollSyncChannelNow();
                  }}
                  className="px-2.5 py-1 rounded bg-primary text-primary-foreground font-semibold"
                >
                  Save & Connect
                </button>
                <button
                  type="button"
                  onClick={() => pollSyncChannelNow()}
                  className="px-2.5 py-1 rounded border border-border bg-background hover:bg-secondary inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Sync Now
                </button>
              </div>

              <div className="text-[11px] text-muted-foreground">
                {store.sync.lanIps.length > 0 && (
                  <span className="mr-3">
                    Laptop LAN:{" "}
                    <strong className="text-primary">
                      http://{store.sync.lanIps[0]}:3000
                    </strong>
                  </span>
                )}
                <span>
                  Last Sync:{" "}
                  <strong className="text-foreground">
                    {store.sync.lastSyncedAt ?? "Active"}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Incoming APK / Website Event Banner */}
        {store.sync.lastSyncBanner && (
          <div className="border-t border-primary/40 bg-primary/15 px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 text-xs font-mono text-primary">
              <span className="font-semibold truncate">
                {store.sync.lastSyncBanner}
              </span>
              <button
                type="button"
                onClick={clearSyncBanner}
                className="p-0.5 rounded hover:bg-primary/20"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        {children}
      </main>
    </div>
  );
}
