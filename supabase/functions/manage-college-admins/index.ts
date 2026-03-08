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

      const { data: admin, error: findErr } = await supabaseAdmin
        .from("college_admins")
        .select("*")
        .eq("username", username)
        .single();

      if (findErr || !admin) return json({ error: "Invalid username or password" }, 401);
      if (!admin.is_active) return json({ error: "Account is deactivated. Contact master admin." }, 403);

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

    // === COLLEGE ADMIN ACTIONS (verified by admin_id from session) ===
    if (["create_dept_admin", "list_dept_admins", "toggle_dept_admin", "college_stats"].includes(action)) {
      const { admin_id } = payload;
      if (!admin_id) return json({ error: "Unauthorized" }, 401);

      // Verify college admin
      const { data: collegeAdmin, error: caErr } = await supabaseAdmin
        .from("college_admins")
        .select("*")
        .eq("id", admin_id)
        .eq("is_active", true)
        .single();

      if (caErr || !collegeAdmin) return json({ error: "Unauthorized" }, 401);

      // Ensure college exists in colleges table, get/create college_id
      let collegeId: string;
      const { data: existingCollege } = await supabaseAdmin
        .from("colleges")
        .select("id")
        .eq("college_name", collegeAdmin.college_name)
        .single();

      if (existingCollege) {
        collegeId = existingCollege.id;
      } else {
        const { data: newCollege, error: colErr } = await supabaseAdmin
          .from("colleges")
          .insert({ college_name: collegeAdmin.college_name, is_active: true })
          .select("id")
          .single();
        if (colErr || !newCollege) return json({ error: "Failed to create college record" }, 500);
        collegeId = newCollege.id;
      }

      // === COLLEGE STATS ===
      if (action === "college_stats") {
        const { data: depts } = await supabaseAdmin
          .from("departments")
          .select("id")
          .eq("college_id", collegeId)
          .eq("is_active", true);

        // Count students directly from hall_assignments filtered by college_id
        const { count: studentCount } = await supabaseAdmin
          .from("hall_assignments")
          .select("id", { count: "exact", head: true })
          .eq("college_id", collegeId);

        return json({ total_departments: (depts || []).length, total_students: studentCount || 0 });
      }

      // === CREATE DEPT ADMIN ===
      if (action === "create_dept_admin") {
        const { department_name, username, password } = payload;
        if (!department_name || !username || !password) return json({ error: "All fields required" }, 400);
        if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

        // Check username uniqueness in hierarchy_admins
        const { data: existingAdmin } = await supabaseAdmin
          .from("hierarchy_admins")
          .select("id")
          .eq("username", username)
          .single();
        if (existingAdmin) return json({ error: "Username already exists" }, 400);

        // Create department
        const { data: dept, error: deptErr } = await supabaseAdmin
          .from("departments")
          .insert({ department_name, college_id: collegeId, is_active: true })
          .select("id")
          .single();
        if (deptErr || !dept) return json({ error: "Failed to create department: " + (deptErr?.message || "") }, 500);

        // Create Supabase Auth user with synthetic email so they can login via /admin
        const syntheticEmail = `${username}@deptadmin.examhall.internal`;
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: syntheticEmail,
          password,
          email_confirm: true,
        });
        if (authErr || !authData.user) return json({ error: "Failed to create auth user: " + (authErr?.message || "") }, 500);

        // Insert into hierarchy_admins
        const { error: insertErr } = await supabaseAdmin.from("hierarchy_admins").insert({
          user_id: authData.user.id,
          username,
          full_name: department_name + " Admin",
          role: "dept_admin",
          college_id: collegeId,
          department_id: dept.id,
          is_active: true,
          created_by: null,
        });
        if (insertErr) return json({ error: "Failed to create admin record: " + insertErr.message }, 500);

        // Create user_roles entry
        await supabaseAdmin.from("user_roles").insert({
          user_id: authData.user.id,
          role: "admin",
        });

        // Create staff_count_tracker for the department
        await supabaseAdmin.from("staff_count_tracker").insert({
          department_id: dept.id,
          current_staff_count: 0,
          max_staff_count: 3,
        });

        return json({ success: true });
      }

      // === LIST DEPT ADMINS ===
      if (action === "list_dept_admins") {
        const { data, error } = await supabaseAdmin
          .from("hierarchy_admins")
          .select("id, username, full_name, is_active, created_at, department_id")
          .eq("role", "dept_admin")
          .eq("college_id", collegeId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);

        // Get department names
        const deptIds = (data || []).map(d => d.department_id).filter(Boolean);
        let deptMap: Record<string, string> = {};
        if (deptIds.length > 0) {
          const { data: depts } = await supabaseAdmin
            .from("departments")
            .select("id, department_name")
            .in("id", deptIds);
          if (depts) {
            deptMap = Object.fromEntries(depts.map(d => [d.id, d.department_name]));
          }
        }

        const enriched = (data || []).map(d => ({
          ...d,
          department_name: d.department_id ? deptMap[d.department_id] || "Unknown" : "Unknown",
        }));

        return json({ data: enriched });
      }

      // === TOGGLE DEPT ADMIN ===
      if (action === "toggle_dept_admin") {
        const { dept_admin_id, is_active } = payload;
        if (!dept_admin_id) return json({ error: "dept_admin_id required" }, 400);

        // Verify this admin belongs to the same college
        const { data: targetAdmin } = await supabaseAdmin
          .from("hierarchy_admins")
          .select("id, college_id")
          .eq("id", dept_admin_id)
          .eq("role", "dept_admin")
          .single();

        if (!targetAdmin || targetAdmin.college_id !== collegeId) {
          return json({ error: "Not found or access denied" }, 403);
        }

        const { error } = await supabaseAdmin
          .from("hierarchy_admins")
          .update({ is_active })
          .eq("id", dept_admin_id);
        if (error) return json({ error: error.message }, 400);

        return json({ success: true });
      }
    }

    // === MASTER STATS (no auth header needed for simplicity, but verified below) ===
    if (action === "master_stats") {
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

      const [collegesRes, collegeAdminsRes, deptAdminsRes, studentsRes] = await Promise.all([
        supabaseAdmin.from("colleges").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("college_admins").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("hierarchy_admins").select("id", { count: "exact", head: true }).eq("role", "dept_admin"),
        supabaseAdmin.from("hall_assignments").select("id", { count: "exact", head: true }),
      ]);

      // Build details: per-college breakdown
      const { data: allColleges } = await supabaseAdmin.from("colleges").select("id, college_name, is_active");
      const { data: allCollegeAdmins } = await supabaseAdmin.from("college_admins").select("id, college_name, username, is_active");
      const { data: allDeptAdmins } = await supabaseAdmin.from("hierarchy_admins").select("id, college_id").eq("role", "dept_admin");

      const details = await Promise.all((allColleges || []).map(async (college) => {
        const superAdmin = (allCollegeAdmins || []).find(ca => ca.college_name === college.college_name);
        const deptCount = (allDeptAdmins || []).filter(da => da.college_id === college.id).length;
        const { count: studentCount } = await supabaseAdmin
          .from("hall_assignments")
          .select("id", { count: "exact", head: true })
          .eq("college_id", college.id);
        return {
          college_name: college.college_name,
          super_admin_username: superAdmin?.username || "—",
          total_dept_admins: deptCount,
          total_students: studentCount || 0,
          is_active: college.is_active,
        };
      }));

      return json({
        total_colleges: collegesRes.count || 0,
        total_college_admins: collegeAdminsRes.count || 0,
        total_dept_admins: deptAdminsRes.count || 0,
        total_students: studentsRes.count || 0,
        details,
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

      const { data: existing } = await supabaseAdmin
        .from("college_admins")
        .select("id")
        .eq("username", username)
        .single();
      if (existing) return json({ error: "Username already exists" }, 400);

      const { error: insertErr } = await supabaseAdmin.from("college_admins").insert({
        college_name,
        username,
        password,
        is_active: true,
        created_by: callerAdmin.id,
        user_id: user.id,
      });
      if (insertErr) return json({ error: insertErr.message }, 400);

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
