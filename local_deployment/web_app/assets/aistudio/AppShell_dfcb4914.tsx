import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type Role } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const labels: Record<Role, string> = { student: "SAFE", guard: "RESPONSE", admin: "COMMAND" };

export function AppShell({ role, children, wide = true }: { role: Role; children: ReactNode; wide?: boolean }) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const roles = me.data?.roles ?? [];
  const allowed = role === "student" || roles.includes(role) || roles.includes("admin");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-[1000] border-b border-border bg-background/90 backdrop-blur">
        <div className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? "max-w-7xl" : "max-w-md"}`}>
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div className="font-bold tracking-tight">
            CAMIQ <span className="font-mono text-sm text-primary">{labels[role]}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {roles.includes("admin") && (
              <div className="hidden items-center gap-1 rounded-lg border border-accent/50 px-2 py-1 sm:flex">
                <span className="font-mono text-[10px] tracking-widest text-accent">ROLE PREVIEW</span>
                {(["student", "guard", "admin"] as const).map((r) => (
                  <Link key={r} to={`/${r}`} className="rounded px-2 py-0.5 text-xs text-muted-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
                    {labels[r]}
                  </Link>
                ))}
              </div>
            )}
            <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${wide ? "max-w-7xl" : "max-w-md"}`}>
        {me.isLoading ? <div className="text-muted-foreground">Loading…</div> : allowed ? children : (
          <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">Your account doesn't have {labels[role]} access.</div>
        )}
      </main>
    </div>
  );
}
