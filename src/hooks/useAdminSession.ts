import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface AdminInfo {
  id: string;
  username: string;
  full_name: string;
  role: string;
  college_id: string | null;
  department_id: string | null;
}

export function useAdminSession(requiredRoles?: string[]) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin");
        return;
      }

      const { data, error } = await (supabase as any)
        .from("hierarchy_admins")
        .select("id, username, full_name, role, college_id, department_id")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        await supabase.auth.signOut();
        navigate("/admin");
        return;
      }

      if (requiredRoles && !requiredRoles.includes(data.role)) {
        if (data.role === "master_admin") navigate("/master/dashboard");
        else navigate("/admin/dashboard");
        return;
      }

      if (mounted) {
        setAdmin(data as AdminInfo);
        setLoading(false);
      }
    };

    check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        if (mounted) navigate("/admin");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // 2-hour inactivity timeout
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.replace("/admin");
      }, 2 * 60 * 60 * 1000);
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/admin");
  };

  return { admin, loading, logout };
}
