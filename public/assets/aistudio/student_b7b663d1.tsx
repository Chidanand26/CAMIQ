import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Phone, Footprints, Timer, Flag, QrCode, User, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Map } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe, audit } from "@/lib/auth";
import { planCameras, type CameraLike } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/student")({
  head: () => ({ meta: [{ title: "CAMIQ SAFE" }, { name: "description", content: "Student safety: SOS, SafeWalk, check-ins and campus pass." }] }),
  component: Student,
});

type Pos = { lat: number; lng: number } | null;
function getPos(): Promise<Pos> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 8000 });
  });
}

async function cameraPlan(pos: Pos) {
  if (!pos) return null;
  const { data } = await supabase.from("cameras").select("*");
  const plan = planCameras(pos.lat, pos.lng, (data ?? []) as CameraLike[]);
  return plan.map((d) => ({ code: d.camera.code, eligible: d.eligible, reason: d.reason }));
}

function useMyIncidents(uid?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!uid) return;
    const ch = supabase.channel(`my-inc-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents", filter: `student_id=eq.${uid}` }, () => qc.invalidateQueries({ queryKey: ["my-incidents"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, qc]);
  return useQuery({
    queryKey: ["my-incidents"],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("incidents").select("*").eq("student_id", uid!).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
}

function Student() {
  const me = useMe();
  const uid = me.data?.user.id;
  const inc = useMyIncidents(uid);
  return (
    <AppShell role="student" wide={false}>
      <Tabs defaultValue="sos">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sos">SOS</TabsTrigger>
          <TabsTrigger value="walk"><Footprints className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="timer"><Timer className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="pass"><QrCode className="h-4 w-4" /></TabsTrigger>
          <TabsTrigger value="me"><User className="h-4 w-4" /></TabsTrigger>
        </TabsList>
        <TabsContent value="sos"><Sos uid={uid} incidents={inc.data ?? []} /></TabsContent>
        <TabsContent value="walk"><SafeWalk uid={uid} incidents={inc.data ?? []} /></TabsContent>
        <TabsContent value="timer"><CheckIn uid={uid} /><Report uid={uid} /></TabsContent>
        <TabsContent value="pass"><Pass uid={uid} state={me.data?.profile?.campus_state} /></TabsContent>
        <TabsContent value="me"><Profile /><History incidents={inc.data ?? []} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

type Inc = { id: string; ref: string; kind: string; status: string; created_at: string; female_pref: boolean; assigned_to: string | null; acknowledged_at: string | null };
const active = (i: Inc) => !["RESOLVED", "CANCELLED"].includes(i.status);

function Sos({ uid, incidents }: { uid?: string; incidents: Inc[] }) {
  const [hold, setHold] = useState(0);
  const t = useRef<ReturnType<typeof setInterval>>(undefined);
  const current = incidents.find((i) => i.kind === "sos" && active(i));

  async function fire(discreet: boolean) {
    if (!uid) return;
    const pos = await getPos();
    const plan = await cameraPlan(pos);
    const { data, error } = await supabase.from("incidents").insert({
      kind: "sos", student_id: uid, lat: pos?.lat, lng: pos?.lng, discreet, camera_plan: plan as never,
    }).select().single();
    if (error) return toast.error(error.message);
    audit("SOS_RAISED", { incident: data.id, discreet });
    if (!discreet) toast.success(`SOS ${data.ref} sent to security`);
  }

  function down() {
    setHold(0);
    t.current = setInterval(() => setHold((h) => {
      if (h >= 100) { clearInterval(t.current); fire(false); return 0; }
      return h + 7;
    }), 100);
  }
  function up() { clearInterval(t.current); setHold(0); }

  async function cancel() {
    if (!current || !confirm("Cancel this SOS? Security will see it was cancelled by you.")) return;
    await supabase.from("incidents").update({ status: "CANCELLED", resolved_at: new Date().toISOString() }).eq("id", current.id);
    audit("SOS_CANCELLED", { incident: current.id });
  }

  return (
    <div className="flex flex-col items-center py-6">
      {current ? (
        <div className="w-full rounded-2xl border border-destructive/60 bg-card p-6 text-center">
          <p className="font-mono text-xs tracking-widest text-destructive">SOS ACTIVE · {current.ref}</p>
          <p className="mt-3 text-2xl font-bold">{current.status === "OPEN" ? "Waiting for a guard…" : current.status}</p>
          <p className="mt-1 text-sm text-muted-foreground">{current.acknowledged_at ? "A guard has acknowledged your alert." : "Your alert is on the security screen."}</p>
          <Button variant="outline" className="mt-5" onClick={cancel}>Cancel SOS</Button>
        </div>
      ) : (
        <>
          <button
            onPointerDown={down} onPointerUp={up} onPointerLeave={up}
            className="sos-orb relative flex h-56 w-56 select-none items-center justify-center rounded-full text-destructive-foreground"
            aria-label="Hold for SOS"
          >
            <span className="pulse-ring absolute inset-0 rounded-full border-4 border-destructive" />
            <span className="text-5xl font-extrabold tracking-tight">SOS</span>
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${hold * 3.02} 302`} /></svg>
          </button>
          <p className="mt-6 text-sm text-muted-foreground">Press and hold for 1.5 seconds</p>
          <button onClick={() => fire(true)} className="mt-4 flex items-center gap-1 text-xs text-muted-foreground"><EyeOff className="h-3 w-3" /> Discreet alert</button>
        </>
      )}
      <Button asChild variant="secondary" className="mt-8 w-full"><a href="tel:112"><Phone className="h-4 w-4" /> Call 112 (India emergency)</a></Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Opens your phone dialer. CAMIQ is not connected to emergency services.</p>
    </div>
  );
}

function SafeWalk({ uid, incidents }: { uid?: string; incidents: Inc[] }) {
  const [start, setStart] = useState<[number, number] | null>(null);
  const [dest, setDest] = useState<[number, number] | null>(null);
  const [center, setCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [female, setFemale] = useState(false);
  const [share, setShare] = useState(true);
  const [every, setEvery] = useState(5);
  const walk = incidents.find((i) => i.kind === "safewalk" && active(i));

  useEffect(() => { getPos().then((p) => { if (p) { setCenter([p.lat, p.lng]); setStart([p.lat, p.lng]); } }); }, []);

  // live location only while walk active and consented
  useEffect(() => {
    if (!walk || !share || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((p) => {
      supabase.from("incidents").update({ lat: p.coords.latitude, lng: p.coords.longitude }).eq("id", walk.id).then(() => {});
    });
    return () => navigator.geolocation.clearWatch(id);
  }, [walk?.id, share]); // eslint-disable-line react-hooks/exhaustive-deps

  // check-in reminders, missed -> escalate
  useEffect(() => {
    if (!walk) return;
    const iv = setInterval(() => {
      const ok = confirm("SafeWalk check-in: are you OK?");
      if (!ok) {
        supabase.from("incidents").insert({ kind: "missed_checkin", student_id: uid!, description: `Missed check-in during SafeWalk ${walk.ref}` }).then(() => {});
      }
    }, every * 60_000);
    return () => clearInterval(iv);
  }, [walk?.id, every]); // eslint-disable-line react-hooks/exhaustive-deps

  async function request() {
    if (!uid || !start || !dest) return toast.error("Pick a start and destination on the map");
    const plan = await cameraPlan({ lat: start[0], lng: start[1] });
    const { error } = await supabase.from("incidents").insert({
      kind: "safewalk", student_id: uid, lat: start[0], lng: start[1], dest_lat: dest[0], dest_lng: dest[1], female_pref: female, camera_plan: plan as never,
    });
    if (error) return toast.error(error.message);
    toast.success("Escort requested");
  }
  async function setStatus(status: string) {
    if (!walk) return;
    await supabase.from("incidents").update({ status, ...(status === "RESOLVED" ? { resolved_at: new Date().toISOString() } : {}) }).eq("id", walk.id);
    audit(`SAFEWALK_${status}`, { incident: walk.id });
  }

  if (walk) {
    return (
      <div className="space-y-4 py-4">
        <div className="rounded-2xl border border-primary/50 bg-card p-5">
          <p className="font-mono text-xs tracking-widest text-primary">SAFEWALK · {walk.ref}</p>
          <p className="mt-2 text-xl font-bold">{walk.status === "OPEN" ? "Finding a responder…" : walk.status === "NO_FEMALE_AVAILABLE" ? "No female responder available" : walk.status}</p>
          {walk.female_pref && <p className="text-sm text-muted-foreground">Female responder requested.</p>}
          {walk.status === "NO_FEMALE_AVAILABLE" && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={async () => { await supabase.from("incidents").update({ status: "OPEN", female_pref: false }).eq("id", walk.id); }}>Accept any responder</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus("CANCELLED")}>Cancel</Button>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-sm"><span>Share live location</span><Switch checked={share} onCheckedChange={setShare} /></div>
        </div>
        <Button className="h-14 w-full text-lg" onClick={() => setStatus("RESOLVED")}>I'm safe — end walk</Button>
      </div>
    );
  }

  const markers = [
    ...(start ? [{ id: "s", lat: start[0], lng: start[1], label: "Start", tone: "primary" as const }] : []),
    ...(dest ? [{ id: "d", lat: dest[0], lng: dest[1], label: "Destination", tone: "accent" as const }] : []),
  ];
  return (
    <div className="space-y-4 py-4">
      <p className="text-sm text-muted-foreground">Tap the map to set your {start ? "destination" : "start"}.</p>
      <Map center={center} markers={markers} route={start && dest ? [start, dest] : undefined} height={280}
        onPick={(lat, lng) => (!start ? setStart([lat, lng]) : setDest([lat, lng]))} />
      <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => { setStart(null); setDest(null); }}>Reset points</Button></div>
      <div className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"><span>Prefer a female responder</span><Switch checked={female} onCheckedChange={setFemale} /></div>
      <div className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"><span>Share live location during walk</span><Switch checked={share} onCheckedChange={setShare} /></div>
      <div className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"><span>Check-in every (min)</span><Input type="number" min={1} className="w-20" value={every} onChange={(e) => setEvery(Math.max(1, +e.target.value))} /></div>
      <Button className="h-12 w-full" onClick={request}>Request security escort</Button>
    </div>
  );
}

function CheckIn({ uid }: { uid?: string }) {
  const [mins, setMins] = useState(15);
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!end) return;
    const iv = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= end) {
        setEnd(null);
        supabase.from("incidents").insert({ kind: "missed_checkin", student_id: uid!, description: `Journey timer of ${mins} min expired without confirmation` }).then(() => toast.warning("Timer expired — security has been notified"));
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [end]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = end ? Math.max(0, Math.round((end - now) / 1000)) : 0;
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold">Journey check-in timer</h3>
      {end ? (
        <>
          <p className="mt-3 font-mono text-4xl">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</p>
          <Button className="mt-4 w-full" onClick={() => setEnd(null)}>I've arrived safely</Button>
        </>
      ) : (
        <div className="mt-3 flex gap-2">
          <Input type="number" min={1} value={mins} onChange={(e) => setMins(Math.max(1, +e.target.value))} />
          <Button onClick={() => { setEnd(Date.now() + mins * 60_000); setNow(Date.now()); }}>Start</Button>
        </div>
      )}
    </div>
  );
}

const CATS = ["Poor lighting", "Unsafe pathway", "Harassment", "Broken safety equipment", "Camera outage", "Other"];
function Report({ uid }: { uid?: string }) {
  const [cat, setCat] = useState(CATS[0]);
  const [desc, setDesc] = useState("");
  const [withLoc, setWithLoc] = useState(true);
  async function send() {
    const pos = withLoc ? await getPos() : null;
    const { error } = await supabase.from("incidents").insert({ kind: "report", student_id: uid!, category: cat, description: desc, lat: pos?.lat, lng: pos?.lng });
    if (error) return toast.error(error.message);
    setDesc(""); toast.success("Report sent to campus security");
  }
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold"><Flag className="h-4 w-4" /> Report unsafe location</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {CATS.map((c) => <Badge key={c} variant={c === cat ? "default" : "outline"} className="cursor-pointer" onClick={() => setCat(c)}>{c}</Badge>)}
      </div>
      <Textarea className="mt-3" placeholder="What did you notice?" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="mt-3 flex items-center justify-between text-sm"><span>Attach my current location</span><Switch checked={withLoc} onCheckedChange={setWithLoc} /></div>
      <Button className="mt-3 w-full" onClick={send}>Send report</Button>
    </div>
  );
}

function Pass({ uid, state }: { uid?: string; state?: string }) {
  const [img, setImg] = useState("");
  const [exp, setExp] = useState(0);
  const [now, setNow] = useState(Date.now());
  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ["my-gate"], enabled: !!uid,
    queryFn: async () => (await supabase.from("gate_events").select("*").eq("user_id", uid!).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc("issue_pass_token");
      if (error || !data?.[0] || !alive) return;
      setImg(await QRCode.toDataURL(data[0].token, { margin: 1, width: 280 }));
      setExp(new Date(data[0].expires_at).getTime());
    };
    refresh();
    const iv = setInterval(refresh, 25_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const ch = supabase.channel(`gate-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gate_events", filter: `user_id=eq.${uid}` }, () => { refresh(); qc.invalidateQueries({ queryKey: ["my-gate"] }); qc.invalidateQueries({ queryKey: ["me"] }); })
      .subscribe();
    return () => { alive = false; clearInterval(iv); clearInterval(tick); supabase.removeChannel(ch); };
  }, [uid, qc]);
  return (
    <div className="space-y-4 py-4">
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="font-mono text-xs tracking-widest text-muted-foreground">CAMPUS PASS · {state ?? "OUT"}</p>
        {img ? <img src={img} alt="Rotating campus pass QR" className="mx-auto mt-4 rounded-lg" /> : <div className="mx-auto mt-4 h-[280px] w-[280px] animate-pulse rounded-lg bg-muted" />}
        <p className="mt-3 text-sm text-muted-foreground">Refreshes in {Math.max(0, Math.round((exp - now) / 1000))}s · contains no personal details</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-semibold">Gate history</h3>
        {(history.data ?? []).length === 0 && <p className="mt-2 text-sm text-muted-foreground">No gate events yet.</p>}
        {(history.data ?? []).map((g) => (
          <div key={g.id} className="mt-2 flex justify-between text-sm"><span>{g.direction ?? "—"} · {g.result}</span><span className="font-mono text-muted-foreground">{new Date(g.created_at).toLocaleString()}</span></div>
        ))}
      </div>
    </div>
  );
}

function Profile() {
  const me = useMe();
  const p = me.data?.profile;
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", student_id: "", department: "", gender: "", contacts: "" });
  useEffect(() => {
    if (p) setF({ full_name: p.full_name ?? "", student_id: p.student_id ?? "", department: p.department ?? "", gender: p.gender ?? "", contacts: ((p.trusted_contacts as { name: string; phone: string }[]) ?? []).map((c) => `${c.name}: ${c.phone}`).join("\n") });
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    const contacts = f.contacts.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [name, phone] = l.split(":"); return { name: name.trim(), phone: (phone ?? "").trim() }; });
    await supabase.from("profiles").update({ full_name: f.full_name, student_id: f.student_id, department: f.department, gender: f.gender, trusted_contacts: contacts }).eq("id", me.data!.user.id);
    qc.invalidateQueries({ queryKey: ["me"] }); toast.success("Saved");
  }
  return (
    <div className="space-y-3 py-4">
      {(["full_name", "student_id", "department", "gender"] as const).map((k) => (
        <div key={k}><Label className="capitalize">{k.replace("_", " ")}</Label><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
      ))}
      <div>
        <Label>Trusted contacts (one per line, "Name: phone")</Label>
        <Textarea value={f.contacts} onChange={(e) => setF({ ...f, contacts: e.target.value })} />
        <p className="mt-1 font-mono text-xs text-accent">MESSAGING: NOT CONFIGURED — contacts are saved but no messages are sent yet.</p>
      </div>
      <Button className="w-full" onClick={save}>Save profile</Button>
    </div>
  );
}

function History({ incidents }: { incidents: Inc[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold">My incidents</h3>
      {incidents.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing yet.</p>}
      {incidents.map((i) => (
        <div key={i.id} className="mt-2 flex justify-between text-sm"><span className="font-mono">{i.ref} · {i.kind}</span><Badge variant="outline">{i.status}</Badge></div>
      ))}
    </div>
  );
}
