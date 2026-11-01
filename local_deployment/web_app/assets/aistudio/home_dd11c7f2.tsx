import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { homeFor, type Role } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/home")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id);
    throw redirect({ to: homeFor((data ?? []).map((r) => r.role as Role)) });
  },
});
