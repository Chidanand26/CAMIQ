import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "guard" | "student";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      ]);
      return {
        user: u.user,
        roles: (roles ?? []).map((r) => r.role as Role),
        profile,
      };
    },
  });
}

export function homeFor(roles: Role[]) {
  if (roles.includes("admin")) return "/admin" as const;
  if (roles.includes("guard")) return "/guard" as const;
  return "/student" as const;
}

export async function audit(action: string, detail?: Record<string, unknown>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_logs").insert({ actor_id: data.user.id, action, detail: (detail ?? null) as never });
}
