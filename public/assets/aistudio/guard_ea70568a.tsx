import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { IncidentConsole, CameraWall, GateMonitor, Visitors } from "@/components/ops";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useMe, audit } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/guard")({
  head: () => ({ meta: [{ title: "CAMIQ RESPONSE" }, { name: "description", content: "Guard control room: incidents, cameras, gate and visitors." }] }),
  component: Guard,
});

function Guard() {
  const me = useMe();
  const qc = useQueryClient();
  const duty = !!me.data?.profile?.on_duty;
  async function toggle(v: boolean) {
    await supabase.from("profiles").update({ on_duty: v }).eq("id", me.data!.user.id);
    audit(v ? "ON_DUTY" : "OFF_DUTY");
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  return (
    <AppShell role="guard">
      <Tabs defaultValue="queue">
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="queue">Incidents</TabsTrigger>
            <TabsTrigger value="cams">Camera wall</TabsTrigger>
            <TabsTrigger value="gate">Gate</TabsTrigger>
            <TabsTrigger value="visitors">Visitors</TabsTrigger>
          </TabsList>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className={duty ? "text-success" : "text-muted-foreground"}>{duty ? "ON DUTY" : "OFF DUTY"}</span>
            <Switch checked={duty} onCheckedChange={toggle} />
          </label>
        </div>
        <TabsContent value="queue" className="mt-4"><IncidentConsole /></TabsContent>
        <TabsContent value="cams" className="mt-4"><CameraWall /></TabsContent>
        <TabsContent value="gate" className="mt-4"><GateMonitor /></TabsContent>
        <TabsContent value="visitors" className="mt-4"><Visitors /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
