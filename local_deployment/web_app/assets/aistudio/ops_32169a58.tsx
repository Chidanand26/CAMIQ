import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Map, type MapMarker } from "@/components/Map";
import { CameraTile, type CamMode } from "@/components/CameraTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { audit, useMe } from "@/lib/auth";
import { planCameras, type CameraLike } from "@/lib/geo";

export function useLive(table: "incidents" | "gate_events" | "incident_notes", key: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel(`${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => qc.invalidateQueries({ queryKey: [key] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table, key, qc]);
}

export function useCameras() {
  return useQuery({ queryKey: ["cameras"], queryFn: async () => (await supabase.from("cameras").select("*").order("code")).data ?? [], refetchInterval: 10_000 });
}
export function useIncidents() {
  useLive("incidents", "incidents");
  return useQuery({ queryKey: ["incidents"], queryFn: async () => (await supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [] });
}

const KIND: Record<string, string> = { sos: "SOS", safewalk: "SAFEWALK", missed_checkin: "MISSED CHECK-IN", report: "REPORT" };

export function IncidentConsole() {
  const inc = useIncidents();
  const cams = useCameras();
  const [sel, setSel] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(i); }, []);
  const open = (inc.data ?? []).filter((i) => !["RESOLVED", "CANCELLED"].includes(i.status));
  const cur = (inc.data ?? []).find((i) => i.id === sel) ?? open[0];

  // audible-ish cue for new SOS
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const i of open) if (!seen.current.has(i.id)) { if (seen.current.size && i.kind === "sos") toast.error(`New SOS ${i.ref}`); seen.current.add(i.id); }
  }, [open]);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="space-y-2">
        <h3 className="font-mono text-xs tracking-widest text-muted-foreground">QUEUE · {open.length} ACTIVE</h3>
        {open.length === 0 && <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">No active incidents.</div>}
        {open.map((i) => {
          const escalated = !i.acknowledged_at && now - new Date(i.created_at).getTime() > 60_000;
          return (
            <button key={i.id} onClick={() => setSel(i.id)}
              className={`w-full rounded-xl border p-3 text-left ${cur?.id === i.id ? "border-primary bg-secondary" : "border-border bg-card"} ${escalated ? "ring-2 ring-destructive" : ""}`}>
              <div className="flex items-center justify-between">
                <Badge variant={i.kind === "sos" ? "destructive" : "secondary"}>{KIND[i.kind] ?? i.kind}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{i.ref}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm"><span>{i.status}{escalated && " · ESCALATED"}</span><span className="text-muted-foreground">{new Date(i.created_at).toLocaleTimeString()}</span></div>
            </button>
          );
        })}
      </div>
      {cur ? <IncidentDetail key={cur.id} inc={cur} cameras={(cams.data ?? []) as CameraLike[]} /> : <div />}
    </div>
  );
}

type IncRow = NonNullable<ReturnType<typeof useIncidents>["data"]>[number];

function IncidentDetail({ inc, cameras }: { inc: IncRow; cameras: CameraLike[] }) {
  const me = useMe();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  useLive("incident_notes", `notes-${inc.id}`);
  const notes = useQuery({ queryKey: [`notes-${inc.id}`], queryFn: async () => (await supabase.from("incident_notes").select("*").eq("incident_id", inc.id).order("created_at")).data ?? [] });
  const student = useQuery({ queryKey: ["profile", inc.student_id], queryFn: async () => (await supabase.from("profiles").select("full_name,student_id,department,phone").eq("id", inc.student_id).maybeSingle()).data });
  const plan = inc.lat != null ? planCameras(inc.lat, inc.lng!, cameras) : [];
  const covered = plan.filter((p) => p.eligible);
  const located = inc.lat != null && !["RESOLVED", "CANCELLED"].includes(inc.status);

  async function update(patch: Record<string, unknown>, action: string) {
    await supabase.from("incidents").update(patch as never).eq("id", inc.id);
    audit(action, { incident: inc.id });
    qc.invalidateQueries({ queryKey: ["incidents"] });
  }
  async function addNote() {
    if (!note.trim()) return;
    await supabase.from("incident_notes").insert({ incident_id: inc.id, author_id: me.data!.user.id, body: note });
    setNote("");
  }
  const markers: MapMarker[] = [
    ...cameras.filter((c) => c.lat != null).map((c) => ({ id: c.id, lat: c.lat!, lng: c.lng!, label: c.code, tone: covered.some((p) => p.camera.id === c.id) ? ("primary" as const) : ("muted" as const), cone: { direction: c.direction, fov: c.fov, range: c.range_m } })),
    ...(located ? [{ id: "inc", lat: inc.lat!, lng: inc.lng!, label: inc.ref, tone: "destructive" as const }] : []),
    ...(inc.dest_lat != null ? [{ id: "dst", lat: inc.dest_lat, lng: inc.dest_lng!, label: "Destination", tone: "accent" as const }] : []),
  ];

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={inc.kind === "sos" ? "destructive" : "secondary"}>{KIND[inc.kind] ?? inc.kind}</Badge>
        <span className="font-mono">{inc.ref}</span>
        <Badge variant="outline">{inc.status}</Badge>
        {inc.female_pref && <Badge className="bg-accent text-accent-foreground">FEMALE RESPONDER REQUESTED</Badge>}
        {inc.discreet && <Badge variant="outline">DISCREET</Badge>}
      </div>
      <div className="text-sm">
        <span className="font-semibold">{student.data?.full_name || "Student"}</span>
        <span className="text-muted-foreground"> · {student.data?.student_id ?? "no ID"} · {student.data?.department ?? "—"}</span>
        {inc.category && <p className="mt-1">{inc.category}</p>}
        {inc.description && <p className="mt-1 text-muted-foreground">{inc.description}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {!inc.acknowledged_at && <Button size="sm" onClick={() => update({ acknowledged_at: new Date().toISOString(), status: "ACKNOWLEDGED" }, "INCIDENT_ACK")}>Acknowledge</Button>}
        <Button size="sm" variant="secondary" onClick={() => update({ assigned_to: me.data!.user.id, status: "RESPONDER EN ROUTE", acknowledged_at: inc.acknowledged_at ?? new Date().toISOString() }, "INCIDENT_ACCEPT")}>Accept & go</Button>
        {inc.kind === "safewalk" && inc.female_pref && <Button size="sm" variant="outline" onClick={() => update({ status: "NO_FEMALE_AVAILABLE" }, "NO_FEMALE_AVAILABLE")}>No female responder available</Button>}
        <Button size="sm" variant="outline" onClick={() => update({ status: "ON SCENE" }, "INCIDENT_ON_SCENE")}>On scene</Button>
        <Button size="sm" variant="outline" onClick={() => update({ status: "RESOLVED", resolved_at: new Date().toISOString() }, "INCIDENT_RESOLVE")}>Resolve</Button>
        {student.data?.phone && <Button size="sm" variant="ghost" asChild><a href={`tel:${student.data.phone}`}>Call student</a></Button>}
      </div>
      {located ? <Map center={[inc.lat!, inc.lng!]} markers={markers} height={300} /> : <p className="text-sm text-muted-foreground">No consented location for this incident.</p>}
      {inc.lat != null && (
        <div>
          <h4 className="font-mono text-xs tracking-widest text-muted-foreground">CAMERA ORCHESTRATOR</h4>
          {covered.length === 0 && <p className="mt-1 font-mono text-sm text-destructive">CAMERA COVERAGE GAP</p>}
          {plan.map((p) => (
            <div key={p.camera.id} className="mt-1 flex justify-between text-sm"><span className="font-mono">{p.camera.code}</span><span className={p.eligible ? "text-primary" : "text-muted-foreground"}>{p.eligible ? "SELECTED · " : "REJECTED · "}{p.reason}</span></div>
          ))}
        </div>
      )}
      <div>
        <h4 className="font-mono text-xs tracking-widest text-muted-foreground">NOTES</h4>
        {(notes.data ?? []).map((n) => <p key={n.id} className="mt-1 text-sm"><span className="text-muted-foreground">{new Date(n.created_at).toLocaleTimeString()} </span>{n.body}</p>)}
        <div className="mt-2 flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" /><Button onClick={addNote}>Add</Button></div>
      </div>
    </div>
  );
}

type Ack = { event: string; at: string };
export function CameraWall() {
  const cams = useCameras();
  const [modes, setModes] = useState<Record<string, CamMode>>({});
  const [acks, setAcks] = useState<Record<string, Ack>>({});
  const [log, setLog] = useState<string[]>([]);
  const last = useRef<Record<string, number>>({});
  const list = cams.data ?? [];

  function onMotion(code: string) {
    const now = Date.now();
    if (now - (last.current[code] ?? 0) < 10_000) return; // dedupe
    last.current[code] = now;
    const src = list.find((c) => c.code === code);
    const neighbors = (src?.neighbors ?? []).filter((n) => list.some((c) => c.code === n));
    const evt = `EVT-${now.toString(36).toUpperCase()}`;
    setLog((l) => [`${new Date().toLocaleTimeString()} ${evt} MOTION_DETECTED ${code} → INVESTIGATE ${neighbors.join(", ") || "(no neighbours configured)"}`, ...l].slice(0, 30));
    if (!neighbors.length) return;
    setModes((m) => ({ ...m, [code]: "VERIFY", ...Object.fromEntries(neighbors.map((n) => [n, "INVESTIGATE" as CamMode])) }));
    for (const n of neighbors) {
      const cam = list.find((c) => c.code === n)!;
      const online = cam.status === "ONLINE";
      setAcks((a) => ({ ...a, [n]: { event: evt, at: online ? `ACK ${evt} ${new Date().toLocaleTimeString()}` : `TIMEOUT ${evt} — camera offline` } }));
    }
    audit("MOTION_COORDINATION", { event: evt, source: code, neighbors });
    setTimeout(() => setModes((m) => { const c = { ...m }; [code, ...neighbors].forEach((k) => delete c[k]); return c; }), 20_000);
  }

  if (!list.length) return <p className="text-muted-foreground">No cameras configured yet. An administrator can add them under Cameras.</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <CameraTile key={c.id} cam={c} mode={modes[c.code] ?? "WATCH"} onMotion={() => onMotion(c.code)} ack={acks[c.code]?.at} />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="font-mono text-xs tracking-widest text-muted-foreground">COORDINATOR EVENTS</h4>
        {log.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Waiting for motion…</p>}
        {log.map((l, i) => <p key={i} className="mt-1 font-mono text-xs">{l}</p>)}
      </div>
    </div>
  );
}

const RESULT_TONE: Record<string, string> = { "ACCESS RECORDED": "text-success", "EXPIRED QR": "text-accent" };
export function GateMonitor() {
  const cams = useCameras();
  useLive("gate_events", "gate");
  const events = useQuery({ queryKey: ["gate"], queryFn: async () => (await supabase.from("gate_events").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [] });
  const gateCams = (cams.data ?? []).filter((c) => c.camera_type === "entrance");
  const [camId, setCamId] = useState<string>("");
  const [mode, setMode] = useState<"AUTO" | "IN" | "OUT">("AUTO");
  const [result, setResult] = useState<{ result: string; direction?: string; subject?: string } | null>(null);
  const cam = gateCams.find((c) => c.id === camId) ?? gateCams[0];
  const busy = useRef(false);

  async function scan(text: string) {
    if (busy.current || !cam) return;
    busy.current = true;
    const { data, error } = await supabase.rpc("consume_gate_token", { _token: text, _camera: cam.code, _gate: cam.name || cam.code, _mode: mode });
    busy.current = false;
    if (error) return toast.error(error.message);
    setResult(data as never);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {!cam ? <p className="text-muted-foreground">No entrance camera configured. Set a camera's type to "entrance".</p> : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {gateCams.length > 1 && gateCams.map((c) => <Button key={c.id} size="sm" variant={c.id === cam.id ? "default" : "outline"} onClick={() => setCamId(c.id)}>{c.code}</Button>)}
              <span className="ml-auto text-sm text-muted-foreground">Gate mode</span>
              {(["AUTO", "IN", "OUT"] as const).map((m) => <Button key={m} size="sm" variant={m === mode ? "default" : "outline"} onClick={() => setMode(m)}>{m}</Button>)}
            </div>
            <CameraTile cam={cam} mode="VERIFY" qr onQR={scan} />
            {result && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className={`font-mono text-2xl font-bold ${RESULT_TONE[result.result] ?? "text-destructive"}`}>{result.result}</p>
                <p className="text-sm text-muted-foreground">{result.subject ?? "Unknown"} · {result.direction ?? ""} · QR credential presented and validated (not a biometric check)</p>
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => setResult({ result: "MANUAL VERIFICATION REQUIRED" })}>Flag for manual verification</Button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="font-mono text-xs tracking-widest text-muted-foreground">GATE EVENTS</h4>
        {(events.data ?? []).map((e) => (
          <div key={e.id} className="mt-2 text-sm"><span className={RESULT_TONE[e.result] ?? "text-destructive"}>{e.result}</span> <span className="text-muted-foreground">{e.direction ?? ""} · {e.visitor_id ? "visitor" : "student"} · {e.camera_code} · {new Date(e.created_at).toLocaleTimeString()}</span></div>
        ))}
      </div>
    </div>
  );
}

export function Visitors() {
  const me = useMe();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["visitors"], queryFn: async () => (await supabase.from("visitors").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [f, setF] = useState({ name: "", organisation: "", reason: "", host: "", destination: "", hours: 4 });
  const [qr, setQr] = useState<{ name: string; img: string } | null>(null);
  async function create() {
    if (!f.name) return toast.error("Visitor name required");
    const { hours, ...rest } = f;
    const { error } = await supabase.from("visitors").insert({ ...rest, valid_until: new Date(Date.now() + hours * 3600_000).toISOString(), created_by: me.data!.user.id });
    if (error) return toast.error(error.message);
    audit("VISITOR_PASS_ISSUED", { name: f.name });
    setF({ name: "", organisation: "", reason: "", host: "", destination: "", hours: 4 });
    qc.invalidateQueries({ queryKey: ["visitors"] });
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h4 className="font-semibold">Issue visitor pass</h4>
        {(["name", "organisation", "reason", "host", "destination"] as const).map((k) => <div key={k}><Label className="capitalize">{k}</Label><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
        <div><Label>Valid for (hours)</Label><Input type="number" min={1} value={f.hours} onChange={(e) => setF({ ...f, hours: +e.target.value })} /></div>
        <Button className="w-full" onClick={create}>Issue pass</Button>
      </div>
      <div className="space-y-2">
        {qr && <div className="rounded-xl border border-primary p-4 text-center"><p className="font-semibold">{qr.name}</p><img src={qr.img} alt="Visitor pass QR" className="mx-auto mt-2" /><Button size="sm" variant="ghost" onClick={() => setQr(null)}>Close</Button></div>}
        {(list.data ?? []).map((v) => {
          const valid = new Date(v.valid_until).getTime() > Date.now();
          return (
            <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex-1"><p className="font-semibold">{v.name} <span className="font-normal text-muted-foreground">· {v.organisation} · host {v.host}</span></p><p className="text-muted-foreground">{v.destination} · until {new Date(v.valid_until).toLocaleString()}</p></div>
              <Badge variant="outline">{v.campus_state}</Badge>
              <Badge variant={valid ? "secondary" : "destructive"}>{valid ? "VALID" : "EXPIRED"}</Badge>
              <Button size="sm" variant="outline" onClick={async () => setQr({ name: v.name, img: await QRCode.toDataURL(v.pass_token, { width: 240, margin: 1 }) })}>QR</Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function useStats() {
  const inc = useIncidents();
  return useMemo(() => {
    const d = inc.data ?? [];
    return { total: d.length, open: d.filter((i) => !["RESOLVED", "CANCELLED"].includes(i.status)).length, sos: d.filter((i) => i.kind === "sos").length, walks: d.filter((i) => i.kind === "safewalk").length, all: d };
  }, [inc.data]);
}

export { Textarea };
