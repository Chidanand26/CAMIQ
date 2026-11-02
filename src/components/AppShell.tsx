import { type ReactNode, useState } from "react";
import { Camera, Link2, RefreshCw, X } from "lucide-react";
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
  badge,
  onAutoAssignWebcams,
  usbCameraCount,
  children,
}: AppShellProps) {
  const store = useCamiqStore();
  const [showSyncBar, setShowSyncBar] = useState(false);
  const [roomInput, setRoomInput] = useState(store.sync.roomCode);
  const [serverInput, setServerInput] = useState(store.sync.laptopServerUrl);

  const roles: { role: Role; label: string }[] = [
    { role: "student", label: "SAFE · Student" },
    { role: "guard", label: "RESPONSE · Guard" },
    { role: "admin", label: "COMMAND · Admin" },
  ];

  return (
    <div className="min-h-screen bg-[#05090d] text-foreground flex flex-col">
      {/* Clean Glass Command Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060c11]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full border border-[#00e5ff]/60 bg-[#00e5ff]/10 flex items-center justify-center text-[#00e5ff] font-bold text-sm shrink-0">
              ◉
            </div>
            <div className="leading-tight truncate">
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-widest text-sm">
                  CAMIQ <span className="text-[#00e5ff] font-medium">{badge}</span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  KLE TECH · HUBBALLI
                </span>
              </div>
              <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase hidden sm:block truncate">
                B. V. BHOOMARADDI CAMPUS · COLLABORATIVE INTELLIGENCE NETWORK
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* APK <-> Website Sync Button */}
            <button
              type="button"
              onClick={() => setShowSyncBar((v) => !v)}
              data-testid="toggle-sync-config-btn"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[11px] transition"
              title="Student APK ↔ Website Live Sync"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{store.sync.roomCode}</span>
            </button>

            {/* 1-Click USB 3-Camera Connect */}
            {!store.isAndroidApk && (
              <button
                type="button"
                onClick={onAutoAssignWebcams}
                data-testid="auto-connect-webcams-btn"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00e5ff]/15 hover:bg-[#00e5ff]/25 text-[#00e5ff] border border-[#00e5ff]/40 font-mono text-[11px] font-semibold transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Connect 3 Cams</span>
                <span className="px-1.5 py-0.2 rounded bg-[#00e5ff]/20 text-[10px]">
                  {usbCameraCount}
                </span>
              </button>
            )}

            {/* Clean Role Dropdown / Switcher */}
            <select
              aria-label="Select Role View"
              data-testid="role-preview-bar"
              value={store.role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-[#060c11] border border-[#00e5ff]/40 text-[#00e5ff] rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold cursor-pointer focus:outline-none"
            >
              {roles.map((r) => (
                <option key={r.role} value={r.role} className="bg-[#060c11]">
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expandable Sync Drawer */}
        {showSyncBar && (
          <div className="border-t border-white/10 bg-[#060c11] px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-emerald-400">APK↔WEB ROOM:</span>
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  className="bg-black/50 border border-white/15 rounded px-2.5 py-1 text-xs w-40 text-foreground"
                />
                <input
                  type="text"
                  value={serverInput}
                  onChange={(e) => setServerInput(e.target.value)}
                  className="bg-black/50 border border-white/15 rounded px-2.5 py-1 text-xs w-44 text-foreground"
                  placeholder="Optional Laptop IP"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateSyncConfig({
                      roomCode: roomInput.trim() || "CAMIQ-LIVE-2026",
                      laptopServerUrl: serverInput.trim(),
                    });
                    pollSyncChannelNow();
                  }}
                  className="px-2.5 py-1 rounded bg-[#00e5ff] text-[#05090d] font-semibold"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => pollSyncChannelNow()}
                  className="px-2.5 py-1 rounded border border-white/15 hover:bg-white/10 inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Sync
                </button>
              </div>
              {store.sync.lanIps.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Laptop LAN: http://{store.sync.lanIps[0]}:3000
                </span>
              )}
            </div>
          </div>
        )}

        {/* Incoming Live Sync Toast */}
        {store.sync.lastSyncBanner && (
          <div className="border-t border-[#00e5ff]/30 bg-[#00e5ff]/10 px-4 py-1.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 text-xs font-mono text-[#00e5ff]">
              <span className="truncate">{store.sync.lastSyncBanner}</span>
              <button
                type="button"
                onClick={clearSyncBanner}
                className="p-0.5 rounded hover:bg-[#00e5ff]/20"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}
