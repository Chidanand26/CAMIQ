import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, QrCode, RefreshCw, Video, VideoOff, Zap } from "lucide-react";
import type { CameraLike } from "../lib/geo";
import {
  type CamMode,
  triggerMotionCoordination,
  updateCameraTelemetry,
} from "../lib/store";

export type CameraTileProps = {
  cam: CameraLike;
  mode?: CamMode;
  ackLabel?: string;
  enableQr?: boolean;
  onQrDecoded?: (data: string) => void;
  availableDevices?: MediaDeviceInfo[];
  onRefreshDevices?: () => void;
};

export function CameraTile({
  cam,
  mode = "WATCH",
  ackLabel,
  enableQr = false,
  onQrDecoded,
  availableDevices = [],
  onRefreshDevices,
}: CameraTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const lastMotionFireRef = useRef<number>(0);

  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [motionScore, setMotionScore] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`camiq-device-${cam.id}`) ?? "";
  });

  const stopStream = useCallback(() => {
    const v = videoRef.current;
    if (v && v.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setStreaming(false);
    setFps(0);
    updateCameraTelemetry(cam.id, { status: "OFFLINE", fps: 0 });
  }, [cam.id]);

  const startStream = useCallback(
    async (overrideDeviceId?: string) => {
      setErr(null);
      const targetDeviceId =
        overrideDeviceId !== undefined
          ? overrideDeviceId
          : localStorage.getItem(`camiq-device-${cam.id}`) ?? selectedDeviceId;

      try {
        // Stop existing tracks before switching device
        const existing = videoRef.current?.srcObject as MediaStream | null;
        if (existing) {
          existing.getTracks().forEach((t) => t.stop());
        }

        const constraints: MediaStreamConstraints = targetDeviceId
          ? {
              video: {
                deviceId: { exact: targetDeviceId },
                width: { ideal: 640 },
                height: { ideal: 360 },
              },
              audio: false,
            }
          : {
              video: { width: { ideal: 640 }, height: { ideal: 360 } },
              audio: false,
            };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreaming(true);
        }
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings();
        if (settings?.deviceId) {
          localStorage.setItem(`camiq-device-${cam.id}`, settings.deviceId);
          setSelectedDeviceId(settings.deviceId);
        }
        updateCameraTelemetry(cam.id, {
          status: "ONLINE",
          device_label: track?.label || "USB Webcam",
        });
        onRefreshDevices?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Camera unavailable";
        setErr(msg);
        setStreaming(false);
        updateCameraTelemetry(cam.id, { status: "CAMERA ERROR", fps: 0 });
      }
    },
    [cam.id, selectedDeviceId, onRefreshDevices],
  );

  // Listen for global "Auto-Connect 3 USB Webcams" event
  useEffect(() => {
    const handler = () => {
      const assigned = localStorage.getItem(`camiq-device-${cam.id}`) ?? "";
      setSelectedDeviceId(assigned);
      if (assigned) {
        void startStream(assigned);
      }
    };
    window.addEventListener("camiq-devices-updated", handler);
    return () => window.removeEventListener("camiq-devices-updated", handler);
  }, [cam.id, startStream]);

  // Auto-start if previously assigned in localStorage
  useEffect(() => {
    const assigned = localStorage.getItem(`camiq-device-${cam.id}`);
    if (assigned) {
      void startStream(assigned);
    }
    return () => {
      const v = videoRef.current;
      if (v && v.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.id]);

  // Real frame analysis loop: FPS, frame latency, pixel-diff motion, and jsQR decoding
  useEffect(() => {
    if (!streaming) return;
    let raf = 0;
    let frames = 0;
    let lastReport = performance.now();
    let lastQrAt = 0;

    const loop = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      const t0 = performance.now();
      if (v && c && v.readyState >= 2) {
        const w = 160;
        const h = 90;
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          if (prevFrameRef.current) {
            let diff = 0;
            for (let i = 0; i < img.data.length; i += 16) {
              diff += Math.abs(img.data[i] - prevFrameRef.current[i]);
            }
            const norm = Math.min(
              100,
              Math.round((diff / (img.data.length / 16)) * 2),
            );
            setMotionScore(norm);
            if (norm > 30 && t0 - lastMotionFireRef.current > 6000) {
              lastMotionFireRef.current = t0;
              triggerMotionCoordination(cam.code);
            }
          }
          prevFrameRef.current = new Uint8ClampedArray(img.data);

          if (enableQr && onQrDecoded && t0 - lastQrAt > 650) {
            lastQrAt = t0;
            const qrCanvas = document.createElement("canvas");
            qrCanvas.width = v.videoWidth || 480;
            qrCanvas.height = v.videoHeight || 270;
            const qctx = qrCanvas.getContext("2d");
            if (qctx && qrCanvas.width > 0) {
              qctx.drawImage(v, 0, 0, qrCanvas.width, qrCanvas.height);
              const qimg = qctx.getImageData(
                0,
                0,
                qrCanvas.width,
                qrCanvas.height,
              );
              const hit = jsQR(qimg.data, qimg.width, qimg.height);
              if (hit?.data) {
                onQrDecoded(hit.data);
              }
            }
          }
        }
        frames++;
        setLatencyMs(Math.round(performance.now() - t0));
      }

      const now = performance.now();
      if (now - lastReport >= 1500) {
        const currentFps = Math.round((frames * 1000) / (now - lastReport));
        setFps(currentFps);
        frames = 0;
        lastReport = now;
        updateCameraTelemetry(cam.id, { status: "ONLINE", fps: currentFps });
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [streaming, cam.id, cam.code, enableQr, onQrDecoded]);

  const modeBadgeClass =
    mode === "INVESTIGATE"
      ? "bg-destructive/20 text-destructive border-destructive/40"
      : mode === "VERIFY"
        ? "bg-warning/20 text-warning border-warning/40"
        : "bg-primary/15 text-primary border-primary/30";

  const statusColor = streaming
    ? "text-success border-success/40"
    : err
      ? "text-destructive border-destructive/40"
      : "text-muted-foreground border-border";

  return (
    <div
      data-testid={`camera-tile-${cam.code}`}
      className="rounded-xl border border-border bg-card/85 overflow-hidden flex flex-col shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-primary">{cam.code}</span>
          <span className="font-medium truncate">{cam.name}</span>
          {enableQr && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px]">
              <QrCode className="w-3 h-3" /> QR GATE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2 py-0.5 rounded border font-mono text-[10px] font-semibold ${modeBadgeClass}`}
          >
            {mode}
          </span>
          <span
            className={`px-2 py-0.5 rounded border font-mono text-[10px] ${statusColor}`}
          >
            {streaming ? "ONLINE" : err ? "ERROR" : cam.status}
          </span>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`w-full h-full object-cover ${streaming ? "block" : "hidden"}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!streaming && (
          <div className="text-center p-4 text-xs text-muted-foreground space-y-1.5">
            <VideoOff className="w-6 h-6 mx-auto opacity-60" />
            <div className="font-mono font-medium text-foreground/80">
              {err ? `CAMERA ERROR: ${err}` : "USB WEBCAM READY TO CONNECT"}
            </div>
            <div className="text-[11px] max-w-[240px] mx-auto">
              Select a connected USB webcam below or click Start Stream.
            </div>
          </div>
        )}

        {streaming && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/70 border border-white/10 font-mono text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE · {fps} FPS · {latencyMs}ms
          </div>
        )}

        {ackLabel && (
          <div className="absolute bottom-2 left-2 right-2 bg-background/90 backdrop-blur border border-primary/40 rounded px-2 py-1 font-mono text-[10px] text-primary truncate">
            {ackLabel}
          </div>
        )}
      </div>

      {/* USB Device Picker + Telemetry Footer */}
      <div className="px-3 py-2 border-t border-border bg-secondary/20 space-y-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <select
            aria-label={`Select USB webcam for ${cam.code}`}
            value={selectedDeviceId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDeviceId(val);
              localStorage.setItem(`camiq-device-${cam.id}`, val);
              if (streaming || val) {
                void startStream(val);
              }
            }}
            className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 font-mono text-[11px] text-foreground truncate"
          >
            <option value="">Default / Auto Webcam</option>
            {availableDevices.map((d, idx) => (
              <option key={d.deviceId || idx} value={d.deviceId}>
                {d.label || `USB Camera #${idx + 1} (${d.deviceId.slice(0, 6)})`}
              </option>
            ))}
          </select>
          {onRefreshDevices && (
            <button
              type="button"
              onClick={onRefreshDevices}
              title="Refresh connected USB cameras"
              className="p-1 rounded border border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between font-mono text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>FPS {fps}</span>
            <span>MOTION {motionScore}%</span>
            <span>FOV {cam.fov}°</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => triggerMotionCoordination(cam.code)}
              title="Trigger neighbor camera coordination"
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/50 text-foreground text-[10px]"
            >
              <Zap className="w-3 h-3 text-warning" /> Motion
            </button>
            {!streaming ? (
              <button
                type="button"
                onClick={() => void startStream()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-foreground font-semibold text-[10px]"
              >
                <Video className="w-3 h-3" /> Start
              </button>
            ) : (
              <button
                type="button"
                onClick={stopStream}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border hover:bg-secondary text-foreground text-[10px]"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
