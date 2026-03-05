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
      return new Response(JSON.stringify({ error: "Forbidden: Only master admins can reset passwords" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { username, new_password } = await req.json();

    if (!username || !new_password) {
      return new Response(JSON.stringify({ error: "Username and new_password are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find the target admin by username
    const { data: targetAdmin, error: findErr } = await supabaseAdmin
      .from("hierarchy_admins")
      .select("id, user_id, username, role, full_name")
      .eq("username", username)
      .single();

    if (findErr || !targetAdmin) {
      return new Response(JSON.stringify({ error: "Admin with that username not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update the auth user's password
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetAdmin.user_id, {
      password: new_password,
    });

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reset lockout fields
    await supabaseAdmin
      .from("hierarchy_admins")
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq("id", targetAdmin.id);

    // Log activity
    await supabaseAdmin.from("admin_activity_logs").insert({
      admin_id: callerAdmin.id,
      action: "reset_admin_password",
      details: `Reset password for "${targetAdmin.username}" (${targetAdmin.role})`,
    });

    return new Response(JSON.stringify({ success: true, message: `Password reset for ${targetAdmin.username}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
