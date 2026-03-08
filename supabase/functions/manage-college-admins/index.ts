import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...payload } = await req.json();

    // === LOGIN (no auth required) ===
    if (action === "login") {
      const { username, password } = payload;
      if (!username || !password) return json({ error: "Username and password required" }, 400);

      // Find college admin record by username
      const { data: admin, error: findErr } = await supabaseAdmin
        .from("college_admins")
        .select("*")
        .eq("username", username)
        .single();

      if (findErr || !admin) return json({ error: "Invalid username or password" }, 401);
      if (!admin.is_active) return json({ error: "Account is deactivated. Contact master admin." }, 403);

      // Direct password comparison
      if (admin.password !== password) {
        return json({ error: "Invalid username or password" }, 401);
      }

      return json({
        success: true,
        college_name: admin.college_name,
        admin_id: admin.id,
        username: admin.username,
      });
    }

    // === All other actions require master admin auth ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: callerAdmin } = await supabaseAdmin
      .from("hierarchy_admins")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!callerAdmin || callerAdmin.role !== "master_admin") return json({ error: "Forbidden" }, 403);

    // === CREATE COLLEGE ADMIN ===
    if (action === "create") {
      const { college_name, username, password } = payload;
      if (!college_name || !username || !password) return json({ error: "All fields required" }, 400);
      if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      // Check username uniqueness
      const { data: existing } = await supabaseAdmin
        .from("college_admins")
        .select("id")
        .eq("username", username)
        .single();
      if (existing) return json({ error: "Username already exists" }, 400);

      // Create college_admins record with password stored directly
      const { error: insertErr } = await supabaseAdmin.from("college_admins").insert({
        college_name,
        username,
        password,
        is_active: true,
        created_by: callerAdmin.id,
        user_id: user.id,
      });
      if (insertErr) {
        return json({ error: insertErr.message }, 400);
      }

      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: callerAdmin.id,
        action: "create_college_admin",
        details: `Created college admin "${username}" for "${college_name}"`,
      });

      return json({ success: true });
    }

    // === TOGGLE COLLEGE ADMIN ===
    if (action === "toggle") {
      const { admin_id, is_active } = payload;
      if (!admin_id) return json({ error: "admin_id required" }, 400);

      const { error } = await supabaseAdmin
        .from("college_admins")
        .update({ is_active })
        .eq("id", admin_id);
      if (error) return json({ error: error.message }, 400);

      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: callerAdmin.id,
        action: is_active ? "activate_college_admin" : "deactivate_college_admin",
        details: `College admin ${admin_id} set to ${is_active ? "active" : "inactive"}`,
      });

      return json({ success: true });
    }

    // === LIST COLLEGE ADMINS ===
    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("college_admins")
        .select("id, college_name, username, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
