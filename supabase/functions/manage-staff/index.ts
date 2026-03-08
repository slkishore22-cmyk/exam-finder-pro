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

    const body = await req.json();
    const { action, ...payload } = body;

    // Auth: get caller from token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Get caller's admin record
    const { data: caller } = await supabaseAdmin
      .from("hierarchy_admins")
      .select("id, role, department_id, college_id, username, full_name")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!caller) return json({ error: "Unauthorized: no active admin record" }, 401);

    // === CREATE STAFF (dept_admin only, max 3) ===
    if (action === "create_staff") {
      if (caller.role !== "dept_admin") return json({ error: "Only department admins can create staff" }, 403);

      const { full_name, username, password } = payload;
      if (!full_name || !username || !password) return json({ error: "All fields required" }, 400);
      if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      // Check staff count
      const { data: tracker } = await supabaseAdmin
        .from("staff_count_tracker")
        .select("current_staff_count, max_staff_count")
        .eq("department_id", caller.department_id)
        .single();

      const currentCount = tracker?.current_staff_count || 0;
      const maxCount = tracker?.max_staff_count || 3;
      if (currentCount >= maxCount) return json({ error: "Maximum 3 staff accounts reached" }, 400);

      // Check username uniqueness
      const { data: existing } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id")
        .eq("username", username)
        .single();
      if (existing) return json({ error: "Username already exists" }, 400);

      // Create auth user
      const syntheticEmail = `${username}@deptadmin.examhall.internal`;
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
      });
      if (authErr || !authData.user) return json({ error: "Failed to create auth user: " + (authErr?.message || "") }, 500);

      // Insert hierarchy_admins
      const { error: insertErr } = await supabaseAdmin.from("hierarchy_admins").insert({
        user_id: authData.user.id,
        username,
        full_name,
        role: "dept_staff",
        college_id: caller.college_id,
        department_id: caller.department_id,
        is_active: true,
        created_by: caller.id,
      });
      if (insertErr) return json({ error: "Failed to create staff record: " + insertErr.message }, 500);

      // Create user_roles entry so RLS works
      await supabaseAdmin.from("user_roles").insert({ user_id: authData.user.id, role: "admin" });

      // Update staff count
      await supabaseAdmin
        .from("staff_count_tracker")
        .update({ current_staff_count: currentCount + 1 })
        .eq("department_id", caller.department_id);

      // Log activity
      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: caller.id,
        action: "create_staff",
        details: `Staff account created: ${username} by ${caller.full_name}`,
      });

      return json({ success: true });
    }

    // === LIST STAFF (dept_admin or dept_staff - same department) ===
    if (action === "list_staff") {
      if (!["dept_admin", "dept_staff"].includes(caller.role)) return json({ error: "Forbidden" }, 403);

      const { data, error } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id, username, full_name, is_active, last_login, role, created_at")
        .eq("department_id", caller.department_id)
        .in("role", ["dept_admin", "dept_staff"])
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);

      return json({ data: data || [] });
    }

    // === LIST ACTIVITY LOG (dept_admin or dept_staff - same department) ===
    if (action === "list_activity") {
      if (!["dept_admin", "dept_staff"].includes(caller.role)) return json({ error: "Forbidden" }, 403);

      // Get all admin IDs in this department
      const { data: deptAdmins } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id")
        .eq("department_id", caller.department_id);

      const adminIds = (deptAdmins || []).map(a => a.id);
      if (adminIds.length === 0) return json({ data: [] });

      const { data, error } = await supabaseAdmin
        .from("admin_activity_logs")
        .select("id, admin_id, action, details, created_at")
        .in("admin_id", adminIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 400);

      // Enrich with admin names
      const { data: admins } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id, full_name, username")
        .in("id", adminIds);
      const nameMap: Record<string, string> = {};
      (admins || []).forEach(a => { nameMap[a.id] = a.full_name || a.username; });

      const enriched = (data || []).map(log => ({
        ...log,
        admin_name: log.admin_id ? nameMap[log.admin_id] || "Unknown" : "System",
      }));

      return json({ data: enriched });
    }

    // === TOGGLE STAFF (dept_admin only) ===
    if (action === "toggle_staff") {
      if (caller.role !== "dept_admin") return json({ error: "Only department admins can manage staff" }, 403);

      const { staff_id, is_active } = payload;
      if (!staff_id) return json({ error: "staff_id required" }, 400);

      // Verify staff belongs to same department
      const { data: target } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id, department_id, username, role")
        .eq("id", staff_id)
        .eq("role", "dept_staff")
        .single();
      if (!target || target.department_id !== caller.department_id) return json({ error: "Staff not found" }, 404);

      await supabaseAdmin.from("hierarchy_admins").update({ is_active }).eq("id", staff_id);

      // Update staff count
      if (!is_active) {
        const { data: tracker } = await supabaseAdmin
          .from("staff_count_tracker")
          .select("current_staff_count")
          .eq("department_id", caller.department_id)
          .single();
        if (tracker && tracker.current_staff_count > 0) {
          await supabaseAdmin.from("staff_count_tracker")
            .update({ current_staff_count: tracker.current_staff_count - 1 })
            .eq("department_id", caller.department_id);
        }
      } else {
        const { data: tracker } = await supabaseAdmin
          .from("staff_count_tracker")
          .select("current_staff_count")
          .eq("department_id", caller.department_id)
          .single();
        if (tracker) {
          await supabaseAdmin.from("staff_count_tracker")
            .update({ current_staff_count: tracker.current_staff_count + 1 })
            .eq("department_id", caller.department_id);
        }
      }

      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: caller.id,
        action: is_active ? "activate_staff" : "deactivate_staff",
        details: `Staff account ${is_active ? "activated" : "deactivated"}: ${target.username} by ${caller.full_name}`,
      });

      return json({ success: true });
    }

    // === RESET PASSWORD (for subordinates) ===
    if (action === "reset_password") {
      const { target_username, new_password } = payload;
      if (!target_username || !new_password) return json({ error: "Username and new_password required" }, 400);
      if (new_password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      // Find target
      const { data: target } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id, user_id, username, role, department_id, college_id, full_name")
        .eq("username", target_username)
        .single();
      if (!target) return json({ error: "Admin not found" }, 404);

      // Authorization check
      if (caller.role === "dept_admin") {
        // Can only reset dept_staff in same department
        if (target.role !== "dept_staff" || target.department_id !== caller.department_id) {
          return json({ error: "You can only reset passwords for staff in your department" }, 403);
        }
      } else if (caller.role === "college_super_admin") {
        // Can reset dept_admin and dept_staff in same college
        if (!["dept_admin", "dept_staff"].includes(target.role) || target.college_id !== caller.college_id) {
          return json({ error: "You can only reset passwords for admins in your college" }, 403);
        }
      } else if (caller.role === "master_admin") {
        // Can reset anyone
      } else {
        return json({ error: "You cannot reset passwords" }, 403);
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(target.user_id, { password: new_password });
      if (updateErr) return json({ error: updateErr.message }, 400);

      // Reset lockout
      await supabaseAdmin.from("hierarchy_admins")
        .update({ failed_login_attempts: 0, locked_until: null })
        .eq("id", target.id);

      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: caller.id,
        action: "reset_password",
        details: `Password changed for: ${target.username} by ${caller.full_name}`,
      });

      return json({ success: true, message: `Password reset for ${target.username}` });
    }

    // === CHANGE OWN PASSWORD ===
    if (action === "change_own_password") {
      const { current_password, new_password } = payload;
      if (!current_password || !new_password) return json({ error: "Current and new password required" }, 400);
      if (new_password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      // Verify current password by attempting sign in
      const email = user.email;
      const { error: signInErr } = await supabaseAdmin.auth.signInWithPassword({ email: email!, password: current_password });
      if (signInErr) return json({ error: "Current password is incorrect" }, 400);

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: new_password });
      if (updateErr) return json({ error: updateErr.message }, 400);

      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: caller.id,
        action: "change_own_password",
        details: `Password changed by: ${caller.full_name}`,
      });

      return json({ success: true });
    }

    // === LOG ACTIVITY (called from client when adding assignments) ===
    if (action === "log_activity") {
      const { log_action, details } = payload;
      if (!log_action || !details) return json({ error: "action and details required" }, 400);

      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: caller.id,
        action: log_action,
        details,
      });

      return json({ success: true });
    }

    // === GET MY ROLE INFO ===
    if (action === "get_role_info") {
      return json({
        role: caller.role,
        full_name: caller.full_name,
        username: caller.username,
        department_id: caller.department_id,
        college_id: caller.college_id,
        admin_id: caller.id,
      });
    }

    // === LIST ALL ADMINS UNDER COLLEGE (college_super_admin) ===
    if (action === "list_college_subordinates") {
      if (caller.role !== "college_super_admin") return json({ error: "Forbidden" }, 403);

      const { data, error } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id, username, full_name, role, is_active, department_id, last_login, created_at")
        .eq("college_id", caller.college_id)
        .in("role", ["dept_admin", "dept_staff"])
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);

      // Enrich with department names
      const deptIds = [...new Set((data || []).map(d => d.department_id).filter(Boolean))];
      let deptMap: Record<string, string> = {};
      if (deptIds.length > 0) {
        const { data: depts } = await supabaseAdmin.from("departments").select("id, department_name").in("id", deptIds);
        if (depts) deptMap = Object.fromEntries(depts.map(d => [d.id, d.department_name]));
      }

      const enriched = (data || []).map(d => ({
        ...d,
        department_name: d.department_id ? deptMap[d.department_id] || "Unknown" : "Unknown",
      }));

      return json({ data: enriched });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
