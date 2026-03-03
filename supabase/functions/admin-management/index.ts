import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const getRequester = async () => {
      const auth = req.headers.get("Authorization");
      if (!auth) return null;
      const { data: { user } } = await db.auth.getUser(auth.replace("Bearer ", ""));
      if (!user) return null;
      const { data } = await db.from("hierarchy_admins").select("*").eq("user_id", user.id).eq("is_active", true).single();
      return data;
    };

    switch (action) {
      case "check-master-exists": {
        const { data } = await db.from("hierarchy_admins").select("id").eq("role", "master_admin").limit(1);
        return json({ exists: !!(data && data.length > 0) });
      }

      case "seed-master": {
        const { username, password, full_name } = body;
        const { data: existing } = await db.from("hierarchy_admins").select("id").eq("role", "master_admin").limit(1);
        if (existing && existing.length > 0) return json({ error: "Master admin already exists" }, 400);

        const email = `${username}@admin.examhall.local`;
        const { data: authUser, error: createErr } = await db.auth.admin.createUser({ email, password, email_confirm: true });
        if (createErr) return json({ error: createErr.message }, 400);

        const { error: insertErr } = await db.from("hierarchy_admins").insert({
          user_id: authUser.user.id,
          full_name: full_name || "Master Admin",
          username,
          role: "master_admin",
        });
        if (insertErr) {
          await db.auth.admin.deleteUser(authUser.user.id);
          return json({ error: insertErr.message }, 400);
        }
        return json({ success: true });
      }

      case "login": {
        const { username, password, login_type } = body;
        const { data: adm, error: lookupErr } = await db
          .from("hierarchy_admins").select("*").eq("username", username).single();

        if (lookupErr || !adm) return json({ error: "Invalid credentials" }, 401);
        if (!adm.is_active) return json({ error: "Account is deactivated" }, 403);

        if (login_type === "master" && adm.role !== "master_admin")
          return json({ error: "Invalid credentials" }, 401);
        if (login_type === "admin" && adm.role === "master_admin")
          return json({ error: "Please use the master login page" }, 401);

        // Check lock
        if (adm.locked_until && new Date(adm.locked_until) > new Date()) {
          const mins = Math.ceil((new Date(adm.locked_until).getTime() - Date.now()) / 60000);
          return json({ error: `Account locked. Try again in ${mins} minutes.` }, 403);
        }

        // Sign in
        const email = `${username}@admin.examhall.local`;
        const userClient = createClient(supabaseUrl, anonKey);
        const { data: authData, error: authErr } = await userClient.auth.signInWithPassword({ email, password });

        if (authErr) {
          const attempts = (adm.failed_login_attempts || 0) + 1;
          const updates: Record<string, unknown> = { failed_login_attempts: attempts };
          if (attempts >= 5) {
            updates.locked_until = new Date(Date.now() + 600000).toISOString();
            updates.failed_login_attempts = 0;
          }
          await db.from("hierarchy_admins").update(updates).eq("id", adm.id);
          if (attempts >= 5) return json({ error: "Account locked for 10 minutes due to too many failed attempts." }, 403);
          return json({ error: "Invalid credentials" }, 401);
        }

        await db.from("hierarchy_admins").update({
          failed_login_attempts: 0, locked_until: null, last_login: new Date().toISOString(),
        }).eq("id", adm.id);

        return json({
          session: authData.session,
          admin: {
            id: adm.id, username: adm.username, full_name: adm.full_name,
            role: adm.role, college_id: adm.college_id, department_id: adm.department_id,
          },
        });
      }

      case "create-admin": {
        const requester = await getRequester();
        if (!requester) return json({ error: "Unauthorized" }, 401);

        const { username, password, full_name, role, college_name, department_name } = body;

        // Permission checks
        const allowed: Record<string, string[]> = {
          master_admin: ["college_super_admin"],
          college_super_admin: ["dept_admin"],
          dept_admin: ["dept_staff"],
        };
        if (!allowed[requester.role]?.includes(role))
          return json({ error: "Insufficient permissions" }, 403);

        // Staff count check
        if (role === "dept_staff") {
          const { data: tracker } = await db.from("staff_count_tracker")
            .select("*").eq("department_id", requester.department_id).single();
          if (tracker && tracker.current_staff_count >= tracker.max_staff_count)
            return json({ error: "Maximum 3 staff accounts allowed per department" }, 400);
        }

        // Username uniqueness
        const { data: existing } = await db.from("hierarchy_admins").select("id").eq("username", username).maybeSingle();
        if (existing) return json({ error: "Username already taken" }, 400);

        // Create auth user
        const email = `${username}@admin.examhall.local`;
        const { data: authUser, error: createErr } = await db.auth.admin.createUser({
          email, password, email_confirm: true,
        });
        if (createErr) return json({ error: createErr.message }, 400);

        let collegeId = requester.college_id;
        let departmentId = requester.department_id;

        // Create college for college_super_admin
        if (role === "college_super_admin" && college_name) {
          const { data: col, error: colErr } = await db.from("colleges").insert({ college_name }).select().single();
          if (colErr) {
            await db.auth.admin.deleteUser(authUser.user.id);
            return json({ error: colErr.message }, 400);
          }
          collegeId = col.id;
          departmentId = null;
        }

        // Create department for dept_admin
        if (role === "dept_admin" && department_name) {
          const { data: dept, error: deptErr } = await db.from("departments").insert({
            college_id: requester.college_id, department_name, created_by: requester.id,
          }).select().single();
          if (deptErr) {
            await db.auth.admin.deleteUser(authUser.user.id);
            return json({ error: deptErr.message }, 400);
          }
          departmentId = dept.id;
          // Init staff tracker
          await db.from("staff_count_tracker").insert({
            department_id: dept.id, current_staff_count: 0, max_staff_count: 3,
          });
        }

        // For staff, use dept admin's department
        if (role === "dept_staff") {
          departmentId = requester.department_id;
          collegeId = requester.college_id;
        }

        // Create admin record
        const { data: newAdmin, error: adminErr } = await db.from("hierarchy_admins").insert({
          user_id: authUser.user.id, college_id: collegeId, department_id: departmentId,
          full_name, username, role, created_by: requester.id,
        }).select().single();

        if (adminErr) {
          await db.auth.admin.deleteUser(authUser.user.id);
          return json({ error: adminErr.message }, 400);
        }

        // Increment staff counter
        if (role === "dept_staff" && requester.department_id) {
          const { data: t } = await db.from("staff_count_tracker")
            .select("current_staff_count").eq("department_id", requester.department_id).single();
          await db.from("staff_count_tracker")
            .update({ current_staff_count: (t?.current_staff_count || 0) + 1 })
            .eq("department_id", requester.department_id);
        }

        // Log
        await db.from("admin_activity_logs").insert({
          admin_id: requester.id, action: `Created ${role}`, details: `${full_name} (${username})`,
        });

        return json({ success: true, admin: newAdmin });
      }

      case "reset-password": {
        const requester = await getRequester();
        if (!requester) return json({ error: "Unauthorized" }, 401);

        const { target_admin_id, new_password } = body;
        const { data: target } = await db.from("hierarchy_admins").select("*").eq("id", target_admin_id).single();
        if (!target) return json({ error: "Admin not found" }, 404);

        const canReset =
          requester.role === "master_admin" ||
          (requester.role === "college_super_admin" && ["dept_admin", "dept_staff"].includes(target.role) && target.college_id === requester.college_id) ||
          (requester.role === "dept_admin" && target.role === "dept_staff" && target.department_id === requester.department_id);

        if (!canReset) return json({ error: "Insufficient permissions" }, 403);

        const { error } = await db.auth.admin.updateUserById(target.user_id, { password: new_password });
        if (error) return json({ error: error.message }, 400);

        await db.from("admin_activity_logs").insert({
          admin_id: requester.id, action: "Password reset", details: `Reset for ${target.full_name}`,
        });
        return json({ success: true });
      }

      case "change-password": {
        const auth = req.headers.get("Authorization");
        if (!auth) return json({ error: "Unauthorized" }, 401);
        const { data: { user } } = await db.auth.getUser(auth.replace("Bearer ", ""));
        if (!user) return json({ error: "Unauthorized" }, 401);

        const { current_password, new_password } = body;

        // Verify current password
        const verifyClient = createClient(supabaseUrl, anonKey);
        const { error: vErr } = await verifyClient.auth.signInWithPassword({
          email: user.email!, password: current_password,
        });
        if (vErr) return json({ error: "Current password is incorrect" }, 401);

        if (current_password === new_password)
          return json({ error: "New password must be different from current" }, 400);

        const { error } = await db.auth.admin.updateUserById(user.id, { password: new_password });
        if (error) return json({ error: error.message }, 400);

        const { data: adm } = await db.from("hierarchy_admins").select("id").eq("user_id", user.id).single();
        if (adm) {
          await db.from("admin_activity_logs").insert({
            admin_id: adm.id, action: "Password changed", details: "Changed own password",
          });
        }
        return json({ success: true });
      }

      case "toggle-active": {
        const requester = await getRequester();
        if (!requester) return json({ error: "Unauthorized" }, 401);

        const { target_id, is_active, target_type } = body;

        if (target_type === "college") {
          if (requester.role !== "master_admin") return json({ error: "Forbidden" }, 403);
          await db.from("colleges").update({ is_active }).eq("id", target_id);
        } else {
          const { data: target } = await db.from("hierarchy_admins").select("*").eq("id", target_id).single();
          if (!target) return json({ error: "Not found" }, 404);
          const canToggle =
            requester.role === "master_admin" ||
            (requester.role === "college_super_admin" && target.college_id === requester.college_id) ||
            (requester.role === "dept_admin" && target.department_id === requester.department_id && target.role === "dept_staff");
          if (!canToggle) return json({ error: "Forbidden" }, 403);
          await db.from("hierarchy_admins").update({ is_active }).eq("id", target_id);
        }

        await db.from("admin_activity_logs").insert({
          admin_id: requester.id, action: is_active ? "Activated" : "Deactivated",
          details: `${target_type} ${target_id}`,
        });
        return json({ success: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
