import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Map, type MapMarker } from "@/components/Map";
import { IncidentConsole, CameraWall, GateMonitor, Visitors, useCameras, useStats } from "@/components/ops";
import { deviceKey } from "@/components/CameraTile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { audit } from "@/lib/auth";
import { planCameras, type CameraLike } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "CAMIQ COMMAND" }, { name: "description", content: "Administrator command center for campus safety." }] }),
  component: Admin,
});

function Admin() {
  return (
    <AppShell role="admin">
      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          {["overview", "incidents", "cameras", "coverage", "sites", "users", "live", "gate", "visitors", "audit", "cims"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === "cims" ? "CIMS" : t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-4"><Overview /></TabsContent>
        <TabsContent value="incidents" className="mt-4"><IncidentConsole /></TabsContent>
        <TabsContent value="cameras" className="mt-4"><CameraConfig /></TabsContent>
        <TabsContent value="coverage" className="mt-4"><Coverage /></TabsContent>
        <TabsContent value="sites" className="mt-4"><Sites /></TabsContent>
        <TabsContent value="users" className="mt-4"><Users /></TabsContent>
        <TabsContent value="live" className="mt-4"><CameraWall /></TabsContent>
        <TabsContent value="gate" className="mt-4"><GateMonitor /></TabsContent>
        <TabsContent value="visitors" className="mt-4"><Visitors /></TabsContent>
        <TabsContent value="audit" className="mt-4"><Audit /></TabsContent>
        <TabsContent value="cims" className="mt-4"><Cims /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="font-mono text-xs tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></div>;
}

function Overview() {
  const s = useStats();
  const cams = useCameras();
  const online = (cams.data ?? []).filter((c) => c.status === "ONLINE").length;
  const byKind = ["sos", "safewalk", "missed_checkin", "report"].map((k) => ({ kind: k, count: s.all.filter((i) => i.kind === k).length }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="ACTIVE INCIDENTS" value={s.open} />
        <Stat label="TOTAL INCIDENTS" value={s.total} />
        <Stat label="SAFEWALKS" value={s.walks} />
        <Stat label="CAMERAS ONLINE" value={`${online}/${cams.data?.length ?? 0}`} />
      </div>
      <div className="h-64 rounded-xl border border-border bg-card p-4">
        {s.total === 0 ? <p className="text-sm text-muted-foreground">No incident data yet.</p> : (
          <ResponsiveContainer><BarChart data={byKind}><XAxis dataKey="kind" stroke="currentColor" fontSize={12} /><YAxis allowDecimals={false} stroke="currentColor" fontSize={12} /><Tooltip /><Bar dataKey="count" fill="var(--primary)" radius={6} /></BarChart></ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function useSites() {
  return useQuery({ queryKey: ["sites"], queryFn: async () => (await supabase.from("sites").select("*").order("created_at")).data ?? [] });
}

function Sites() {
  const sites = useSites();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", institution: "" });
  const [pt, setPt] = useState<[number, number] | null>(null);
  const [q, setQ] = useState("");
  const [center, setCenter] = useState<[number, number]>([20.5937, 78.9629]);
  async function search() {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`).then((r) => r.json());
    if (r[0]) { setCenter([+r[0].lat, +r[0].lon]); setPt([+r[0].lat, +r[0].lon]); } else toast.error("Place not found");
  }
  async function add() {
    if (!f.name || !pt) return toast.error("Name and map location required");
    await supabase.from("sites").insert({ ...f, lat: pt[0], lng: pt[1] });
    audit("SITE_CREATED", { name: f.name });
    setF({ name: "", institution: "" }); qc.invalidateQueries({ queryKey: ["sites"] });
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="flex gap-2"><Input placeholder="Search a place" value={q} onChange={(e) => setQ(e.target.value)} /><Button variant="secondary" onClick={search}>Find</Button></div>
        <Label>Site name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Label>Institution</Label><Input value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} />
        <p className="text-xs text-muted-foreground">{pt ? `${pt[0].toFixed(5)}, ${pt[1].toFixed(5)}` : "Click the map to place the site"}</p>
        <Button className="w-full" onClick={add}>Add site</Button>
        {(sites.data ?? []).map((s) => <div key={s.id} className="flex justify-between text-sm"><span>{s.name}</span><button className="text-muted-foreground" onClick={() => setCenter([s.lat, s.lng])}>view</button></div>)}
      </div>
      <Map center={center} height={460} onPick={(a, b) => setPt([a, b])}
        markers={[...(sites.data ?? []).map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: s.name, tone: "accent" as const })), ...(pt ? [{ id: "new", lat: pt[0], lng: pt[1], label: "New site", tone: "primary" as const }] : [])]} />
    </div>
  );
}

const TYPES = ["entrance", "laboratory", "corridor", "perimeter", "other"];
function CameraConfig() {
  const cams = useCameras();
  const sites = useSites();
  const qc = useQueryClient();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [, force] = useState(0);
  const cam = (cams.data ?? []).find((c) => c.id === sel);
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { if (cam) setF({ code: cam.code, name: cam.name, camera_type: cam.camera_type, site_id: cam.site_id ?? "", lat: String(cam.lat ?? ""), lng: String(cam.lng ?? ""), direction: String(cam.direction), fov: String(cam.fov), range_m: String(cam.range_m), neighbors: cam.neighbors.join(",") }); }, [cam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function discover() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"));
    } catch { toast.error("Camera permission denied"); }
  }
  async function addCam() {
    const n = (cams.data?.length ?? 0) + 1;
    const { data } = await supabase.from("cameras").insert({ code: `CAM-${String(n).padStart(2, "0")}`, camera_type: n === 1 ? "entrance" : "corridor" }).select().single();
    qc.invalidateQueries({ queryKey: ["cameras"] }); if (data) setSel(data.id);
  }
  async function save() {
    if (!cam) return;
    await supabase.from("cameras").update({
      code: f.code, name: f.name, camera_type: f.camera_type, site_id: f.site_id || null,
      lat: f.lat ? +f.lat : null, lng: f.lng ? +f.lng : null, direction: +f.direction, fov: +f.fov, range_m: +f.range_m,
      neighbors: f.neighbors.split(",").map((s) => s.trim()).filter(Boolean),
    }).eq("id", cam.id);
    audit("CAMERA_UPDATED", { code: f.code }); qc.invalidateQueries({ queryKey: ["cameras"] }); toast.success("Camera saved");
  }
  async function remove() {
    if (!cam || !confirm(`Delete ${cam.code}?`)) return;
    await supabase.from("cameras").delete().eq("id", cam.id); setSel(null); qc.invalidateQueries({ queryKey: ["cameras"] });
  }
  const assigned = cam ? (typeof window !== "undefined" ? localStorage.getItem(deviceKey(cam.id)) : null) : null;
  const site = (sites.data ?? []).find((s) => s.id === f.site_id);
  const center: [number, number] = f.lat ? [+f.lat, +f.lng] : site ? [site.lat, site.lng] : [20.5937, 78.9629];

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        <Button className="w-full" onClick={addCam}>Add camera</Button>
        {(cams.data ?? []).map((c) => (
          <button key={c.id} onClick={() => setSel(c.id)} className={`flex w-full justify-between rounded-lg border p-2 text-sm ${sel === c.id ? "border-primary" : "border-border"}`}>
            <span className="font-mono">{c.code}</span><Badge variant="outline">{c.status}</Badge>
          </button>
        ))}
      </div>
      {cam ? (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Code</Label><Input value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
              <div><Label>Name</Label><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            </div>
            <Label>Type</Label>
            <div className="flex flex-wrap gap-1">{TYPES.map((t) => <Badge key={t} className="cursor-pointer" variant={f.camera_type === t ? "default" : "outline"} onClick={() => setF({ ...f, camera_type: t })}>{t}</Badge>)}</div>
            <Label>Site</Label>
            <div className="flex flex-wrap gap-1">{(sites.data ?? []).map((s) => <Badge key={s.id} className="cursor-pointer" variant={f.site_id === s.id ? "default" : "outline"} onClick={() => setF({ ...f, site_id: s.id })}>{s.name}</Badge>)}{!sites.data?.length && <span className="text-xs text-muted-foreground">Create a site first</span>}</div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Direction°</Label><Input type="number" value={f.direction ?? ""} onChange={(e) => setF({ ...f, direction: e.target.value })} /></div>
              <div><Label>FOV°</Label><Input type="number" value={f.fov ?? ""} onChange={(e) => setF({ ...f, fov: e.target.value })} /></div>
              <div><Label>Range m</Label><Input type="number" value={f.range_m ?? ""} onChange={(e) => setF({ ...f, range_m: e.target.value })} /></div>
            </div>
            <Label>Neighbour cameras (codes, comma separated)</Label>
            <Input value={f.neighbors ?? ""} onChange={(e) => setF({ ...f, neighbors: e.target.value })} placeholder="CAM-02, CAM-03" />
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between"><Label>Physical webcam on this computer</Label><Button size="sm" variant="secondary" onClick={discover}>Discover</Button></div>
              {devices.map((d, i) => (
                <button key={d.deviceId} onClick={() => { localStorage.setItem(deviceKey(cam.id), d.deviceId); supabase.from("cameras").update({ device_label: d.label }).eq("id", cam.id); force((x) => x + 1); }}
                  className={`mt-1 block w-full rounded px-2 py-1 text-left text-sm ${assigned === d.deviceId ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  [{i}] {d.label || "Unnamed camera"}
                </button>
              ))}
              <p className="mt-1 text-xs text-muted-foreground">{assigned ? `Assigned: ${cam.device_label ?? "device"}` : "No device assigned on this computer"}</p>
            </div>
            <div className="flex gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={remove}>Delete</Button></div>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Click the map to set the camera position.</p>
            <Map center={center} height={420} onPick={(a, b) => setF({ ...f, lat: String(a), lng: String(b) })}
              markers={f.lat ? [{ id: "c", lat: +f.lat, lng: +f.lng, label: f.code, tone: "primary", cone: { direction: +f.direction, fov: +f.fov, range: +f.range_m } }] : []} />
          </div>
        </div>
      ) : <p className="text-muted-foreground">Select or add a camera.</p>}
    </div>
  );
}

function Coverage() {
  const cams = useCameras();
  const sites = useSites();
  const s = useStats();
  const [pt, setPt] = useState<[number, number] | null>(null);
  const list = (cams.data ?? []) as CameraLike[];
  const first = list.find((c) => c.lat != null);
  const center: [number, number] = first ? [first.lat!, first.lng!] : sites.data?.[0] ? [sites.data[0].lat, sites.data[0].lng] : [20.5937, 78.9629];
  const plan = pt ? planCameras(pt[0], pt[1], list) : [];
  const markers: MapMarker[] = [
    ...list.filter((c) => c.lat != null).map((c) => ({ id: c.id, lat: c.lat!, lng: c.lng!, label: c.code, tone: "primary" as const, cone: { direction: c.direction, fov: c.fov, range: c.range_m } })),
    ...s.all.filter((i) => i.lat != null && !["RESOLVED", "CANCELLED"].includes(i.status)).map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, label: `${i.ref} ${i.kind}`, tone: "destructive" as const })),
    ...s.all.filter((i) => i.kind === "report" && i.lat != null).map((i) => ({ id: `r${i.id}`, lat: i.lat!, lng: i.lng!, label: i.category ?? "Report", tone: "accent" as const })),
    ...(pt ? [{ id: "probe", lat: pt[0], lng: pt[1], label: "Probe", tone: "muted" as const }] : []),
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Map center={center} markers={markers} height={520} onPick={(a, b) => setPt([a, b])} />
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="font-semibold">Coverage probe</h4>
        <p className="text-sm text-muted-foreground">Click any point on the map to see which cameras would be selected.</p>
        {pt && plan.every((p) => !p.eligible) && <p className="mt-3 font-mono text-destructive">CAMERA COVERAGE GAP</p>}
        {plan.map((p) => <div key={p.camera.id} className="mt-2 text-sm"><span className="font-mono">{p.camera.code}</span> <span className={p.eligible ? "text-primary" : "text-muted-foreground"}>{p.reason}</span></div>)}
      </div>
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([supabase.from("profiles").select("*").order("created_at"), supabase.from("user_roles").select("*")]);
      return (p ?? []).map((x) => ({ ...x, roles: (r ?? []).filter((y) => y.user_id === x.id).map((y) => y.role) }));
    },
  });
  async function toggle(uid: string, role: "admin" | "guard" | "student", has: boolean) {
    const { error } = has ? await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role) : await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    audit(has ? "ROLE_REVOKED" : "ROLE_GRANTED", { user: uid, role }); qc.invalidateQueries({ queryKey: ["users"] });
  }
  return (
    <div className="space-y-2">
      {(data.data ?? []).map((u) => (
        <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="flex-1"><p className="font-semibold">{u.full_name || "Unnamed"}</p><p className="text-muted-foreground">{u.student_id ?? "—"} · {u.department ?? "—"} · {u.campus_state}{u.on_duty ? " · ON DUTY" : ""}</p></div>
          {(["student", "guard", "admin"] as const).map((r) => { const has = u.roles.includes(r); return <Button key={r} size="sm" variant={has ? "default" : "outline"} onClick={() => toggle(u.id, r, has)}>{r}</Button>; })}
        </div>
      ))}
    </div>
  );
}

function Audit() {
  const q = useQuery({ queryKey: ["audit"], queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [] });
  return (
    <div className="rounded-xl border border-border bg-card p-4 font-mono text-xs">
      {(q.data ?? []).length === 0 && <p className="text-muted-foreground">No audit entries.</p>}
      {(q.data ?? []).map((a) => <p key={a.id} className="mt-1"><span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span> {a.action} {a.detail ? JSON.stringify(a.detail) : ""}</p>)}
    </div>
  );
}

function Cims() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["cims"], queryFn: async () => (await supabase.from("integrations").select("*").eq("key", "cims").maybeSingle()).data });
  const [f, setF] = useState({ base_url: "", auth_type: "api_key", sync_minutes: "60" });
  useEffect(() => { if (q.data) setF({ base_url: q.data.base_url ?? "", auth_type: q.data.auth_type ?? "api_key", sync_minutes: String(q.data.sync_minutes ?? 60) }); }, [q.data]);
  async function save() {
    await supabase.from("integrations").upsert({ key: "cims", base_url: f.base_url, auth_type: f.auth_type, sync_minutes: +f.sync_minutes, state: "NOT CONNECTED" });
    audit("CIMS_SETTINGS_SAVED"); qc.invalidateQueries({ queryKey: ["cims"] }); toast.success("Saved");
  }
  return (
    <div className="max-w-lg space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between"><h4 className="font-semibold">CIMS integration</h4><Badge variant="outline" className="font-mono">{q.data?.state ?? "NOT CONNECTED"}</Badge></div>
      <div><Label>API base URL</Label><Input value={f.base_url} onChange={(e) => setF({ ...f, base_url: e.target.value })} placeholder="https://cims.example.edu/api" /></div>
      <div><Label>Authentication type</Label><Input value={f.auth_type} onChange={(e) => setF({ ...f, auth_type: e.target.value })} /></div>
      <div><Label>Sync every (minutes)</Label><Input type="number" value={f.sync_minutes} onChange={(e) => setF({ ...f, sync_minutes: e.target.value })} /></div>
      <p className="text-xs text-muted-foreground">The API credential will be stored securely on the server once your CIMS API documentation is available. Last sync: {q.data?.last_sync ?? "never"}{q.data?.last_error ? ` · ${q.data.last_error}` : ""}</p>
      <Button onClick={save}>Save settings</Button>
    </div>
  );
}
