import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { useCamiqStore } from "./lib/store";
import { AdminView } from "./views/AdminView";
import { GuardView } from "./views/GuardView";
import { StudentView } from "./views/StudentView";

export function App() {
  const store = useCamiqStore();
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const vids = all.filter((d) => d.kind === "videoinput");
      setVideoDevices(vids);
      return vids;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        refreshDevices,
      );
    };
  }, [refreshDevices]);

  // 1-Click Auto-Connect for all 3 USB Webcams plugged into the presentation laptop
  const handleAutoAssignWebcams = useCallback(async () => {
    try {
      // Request permission once so browser unlocks all USB deviceId labels
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      tempStream.getTracks().forEach((t) => t.stop());
    } catch {
      // Continue enumeration even if default stream had an issue
    }

    const devices = (await refreshDevices()) ?? [];
    if (devices.length > 0) {
      store.cameras.forEach((cam, idx) => {
        const picked = devices[idx % devices.length];
        if (picked?.deviceId) {
          localStorage.setItem(`camiq-device-${cam.id}`, picked.deviceId);
        }
      });
      window.dispatchEvent(new Event("camiq-devices-updated"));
    }
  }, [refreshDevices, store.cameras]);

  const meta =
    store.role === "student"
      ? {
          badge: "SAFE",
          title: "CAMIQ SAFE · Student Companion",
          subtitle: "Press-and-Hold SOS, Rotating 30s QR Pass & SafeWalk",
        }
      : store.role === "guard"
        ? {
            badge: "RESPONSE",
            title: "CAMIQ RESPONSE · Security Guard Console",
            subtitle: "3-Camera Live Wall, QR Gate Monitor & 3D Dispatch",
          }
        : {
            badge: "COMMAND",
            title: "CAMIQ COMMAND · Unified Campus Safety Platform",
            subtitle:
              "CesiumJS 3D Digital Twin, 3-Camera USB Wall & Coverage-to-Compute",
          };

  return (
    <AppShell
      badge={meta.badge}
      title={meta.title}
      subtitle={meta.subtitle}
      onAutoAssignWebcams={() => void handleAutoAssignWebcams()}
      usbCameraCount={videoDevices.length}
    >
      {store.role === "student" && <StudentView />}
      {store.role === "guard" && (
        <GuardView
          availableDevices={videoDevices}
          onRefreshDevices={() => void refreshDevices()}
        />
      )}
      {store.role === "admin" && (
        <AdminView
          availableDevices={videoDevices}
          onRefreshDevices={() => void refreshDevices()}
          onAutoAssignWebcams={() => void handleAutoAssignWebcams()}
        />
      )}
    </AppShell>
  );
}
