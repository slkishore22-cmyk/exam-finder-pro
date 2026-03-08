import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated master_admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerAdmin } = await supabaseAdmin
      .from("hierarchy_admins")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!callerAdmin || callerAdmin.role !== "master_admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, ...payload } = await req.json();

    if (action === "create_college_admin") {
      const { college_name, username, password } = payload;
      if (!college_name || !username || !password) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create college
      const { data: college, error: collegeErr } = await supabaseAdmin
        .from("colleges")
        .insert({ college_name })
        .select()
        .single();
      if (collegeErr) {
        return new Response(JSON.stringify({ error: collegeErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create auth user with synthetic email
      const syntheticEmail = `${username}@college.examhall.internal`;
      const { data: authData, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
      });
      if (authCreateErr) {
        // Rollback college
        await supabaseAdmin.from("colleges").delete().eq("id", college.id);
        return new Response(JSON.stringify({ error: authCreateErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create hierarchy_admins record
      const { error: adminErr } = await supabaseAdmin.from("hierarchy_admins").insert({
        user_id: authData.user.id,
        username,
        full_name: `${college_name} Admin`,
        role: "college_super_admin",
        college_id: college.id,
        created_by: callerAdmin.id,
      });
      if (adminErr) {
        return new Response(JSON.stringify({ error: adminErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Hash password before storing in college_admins
      const hashedPassword = await bcrypt.hash(password);

      // Also insert into college_admins table for college admin login
      const { error: caErr } = await supabaseAdmin.from("college_admins").insert({
        college_name,
        username,
        password: hashedPassword,
        is_active: true,
        created_by: callerAdmin.id,
        user_id: authData.user.id,
      });
      if (caErr) {
        return new Response(JSON.stringify({ error: "College created but admin record failed: " + caErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Log activity
      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: callerAdmin.id,
        action: "create_college_admin",
        details: `Created college "${college_name}" with admin "${username}"`,
      });

      return new Response(JSON.stringify({ success: true, college_id: college.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle_college") {
      const { college_id, is_active } = payload;
      const { error } = await supabaseAdmin
        .from("colleges")
        .update({ is_active })
        .eq("id", college_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: callerAdmin.id,
        action: is_active ? "activate_college" : "deactivate_college",
        details: `College ${college_id} set to ${is_active ? "active" : "inactive"}`,
      });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
