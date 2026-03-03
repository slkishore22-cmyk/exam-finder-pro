import { supabase } from "@/integrations/supabase/client";

const getUrl = () =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-management`;

async function call(body: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(getUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const adminApi = {
  checkMasterExists: () => call({ action: "check-master-exists" }),

  seedMaster: (username: string, password: string, full_name?: string) =>
    call({ action: "seed-master", username, password, full_name }),

  login: (username: string, password: string, login_type: "master" | "admin") =>
    call({ action: "login", username, password, login_type }),

  createAdmin: (p: {
    username: string;
    password: string;
    full_name: string;
    role: string;
    college_name?: string;
    department_name?: string;
  }) => call({ action: "create-admin", ...p }),

  resetPassword: (target_admin_id: string, new_password: string) =>
    call({ action: "reset-password", target_admin_id, new_password }),

  changePassword: (current_password: string, new_password: string) =>
    call({ action: "change-password", current_password, new_password }),

  toggleActive: (target_id: string, is_active: boolean, target_type: string) =>
    call({ action: "toggle-active", target_id, is_active, target_type }),
};
