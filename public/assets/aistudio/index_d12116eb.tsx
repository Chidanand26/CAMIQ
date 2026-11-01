import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Siren, Footprints, Cctv, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAMIQ — Collaborative Intelligence for Existing Cameras" },
      { name: "description", content: "Campus safety orchestration: SOS, SafeWalk, QR gate entry and coordinated camera response." },
      { property: "og:title", content: "CAMIQ — Campus Safety Orchestration" },
      { property: "og:description", content: "From student distress to coordinated campus response." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Siren, t: "SOS in one hold", d: "Students raise an alert; guards see it live with the cameras covering that spot." },
  { icon: Footprints, t: "SafeWalk escorts", d: "Request an escort, choose a female responder, share location only during the walk." },
  { icon: QrCode, t: "Smart gate entry", d: "Rotating 30-second passes read by the gate camera, with anti-passback." },
  { icon: Cctv, t: "Cameras that cooperate", d: "Motion on one camera puts its neighbours into investigate mode." },
];

function Index() {
  return (
    <div className="bg-grid min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <nav className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold">CAMIQ</span>
          <Button asChild className="ml-auto"><Link to="/auth">Sign in</Link></Button>
        </nav>
        <section className="py-24">
          <p className="font-mono text-sm tracking-widest text-primary">CAMPUS SAFETY ORCHESTRATION</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
            From student distress to <span className="text-primary">coordinated</span> campus response.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">One platform for students, guards and administrators — built on the cameras you already have.</p>
          <Button asChild size="lg" className="mt-8"><Link to="/auth">Get started</Link></Button>
        </section>
        <section className="grid gap-4 pb-16 md:grid-cols-4">
          {features.map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-3 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
