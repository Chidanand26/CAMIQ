import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export type CamMode = "WATCH" | "VERIFY" | "INVESTIGATE";
const INTERVAL: Record<CamMode, number> = { WATCH: 700, VERIFY: 300, INVESTIGATE: 120 };

export type CamRecord = { id: string; code: string; name: string; camera_type: string };

export function deviceKey(id: string) {
  return `camiq-device-${id}`;
}

export function CameraTile({
  cam,
  mode,
  qr,
  onMotion,
  onQR,
  ack,
}: {
  cam: CamRecord;
  mode: CamMode;
  qr?: boolean;
  onMotion?: (level: number) => void;
  onQR?: (text: string) => void;
  ack?: string | null;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"CONNECTING" | "ONLINE" | "DISCONNECTED" | "NOT ASSIGNED">("CONNECTING");
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [motion, setMotion] = useState(0);
  const cb = useRef({ onMotion, onQR });
  cb.current = { onMotion, onQR };
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const deviceId = localStorage.getItem(deviceKey(cam.id));
    if (!deviceId) { setState("NOT ASSIGNED"); return; }
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let hb: ReturnType<typeof setInterval>;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let prev: Uint8ClampedArray | null = null;
    let frames = 0;
    let lastFpsAt = performance.now();
    let lastQR = "";
    let curFps = 0;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        video.current!.srcObject = stream;
        await video.current!.play();
        setState("ONLINE");
        stream.getVideoTracks()[0].onended = () => { setState("DISCONNECTED"); retry(); };
        loop();
      } catch {
        setState("DISCONNECTED");
        retry();
      }
    };
    const retry = () => { if (!stopped) timer = setTimeout(start, 4000); };

    const loop = () => {
      if (stopped) return;
      const v = video.current;
      if (v && v.readyState >= 2) {
        const t0 = performance.now();
        const w = qr ? 480 : 96;
        const h = Math.round((w * v.videoHeight) / (v.videoWidth || 1)) || 72;
        canvas.width = w; canvas.height = h;
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        // motion: mean abs diff on green channel, sampled
        if (prev && prev.length === img.data.length) {
          let diff = 0, n = 0;
          for (let i = 1; i < img.data.length; i += 16) { diff += Math.abs(img.data[i] - prev[i]); n++; }
          const lvl = diff / n;
          setMotion(lvl);
          if (lvl > 12) cb.current.onMotion?.(lvl);
        }
        prev = new Uint8ClampedArray(img.data);
        if (qr) {
          const code = jsQR(img.data, w, h);
          if (code?.data && code.data !== lastQR) { lastQR = code.data; cb.current.onQR?.(code.data); setTimeout(() => { lastQR = ""; }, 4000); }
        }
        setLatency(Math.round(performance.now() - t0));
        frames++;
        const now = performance.now();
        if (now - lastFpsAt > 1000) { curFps = (frames * 1000) / (now - lastFpsAt); setFps(curFps); frames = 0; lastFpsAt = now; }
      }
      timer = setTimeout(loop, qr ? 150 : INTERVAL[modeRef.current]);
    };

    start();
    hb = setInterval(() => {
      const online = stream?.active && !stopped;
      supabase.from("cameras").update({ status: online ? "ONLINE" : "DISCONNECTED", fps: online ? Math.round(curFps * 10) / 10 : null, last_seen: new Date().toISOString() }).eq("id", cam.id).then(() => {});
    }, 10_000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(hb); stream?.getTracks().forEach((t) => t.stop()); };
  }, [cam.id, qr]);

  const tone = mode === "INVESTIGATE" ? "destructive" : mode === "VERIFY" ? "secondary" : "outline";
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-video bg-muted">
        <video ref={video} muted playsInline className={state === "ONLINE" ? "h-full w-full object-cover" : "hidden"} />
        {state !== "ONLINE" && (
          <div className="flex h-full items-center justify-center font-mono text-sm tracking-widest text-muted-foreground">{state}</div>
        )}
      </div>
      <div className="absolute left-2 top-2 flex gap-1">
        <Badge variant="secondary" className="font-mono">{cam.code}</Badge>
        <Badge variant={tone}>{mode}</Badge>
        {qr && <Badge>QR GATE</Badge>}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 font-mono text-xs text-muted-foreground">
        <span className="truncate">{cam.name || cam.camera_type}</span>
        <span>{fps.toFixed(1)}fps · {latency}ms · motion {motion.toFixed(0)}</span>
      </div>
      {ack && <div className="border-t border-border px-3 py-1 font-mono text-xs text-primary">{ack}</div>}
    </div>
  );
}
