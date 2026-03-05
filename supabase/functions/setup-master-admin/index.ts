import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, username, password } = await req.json();

    // Action: check if any master admin exists
    if (action === "check") {
      const { count } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id", { count: "exact", head: true })
        .eq("role", "master_admin");

      return new Response(
        JSON.stringify({ exists: (count || 0) > 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: create the first master admin
    if (action === "create") {
      if (!username || !password) {
        return new Response(
          JSON.stringify({ error: "Username and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify no master admin exists yet
      const { count } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id", { count: "exact", head: true })
        .eq("role", "master_admin");

      if ((count || 0) > 0) {
        return new Response(
          JSON.stringify({ error: "A master admin already exists. Setup is locked." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const syntheticEmail = `${username.trim().toLowerCase()}@master.examhall.internal`;

      // Create auth user
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
      });

      if (authErr) {
        return new Response(
          JSON.stringify({ error: authErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create hierarchy_admins record
      const { error: insertErr } = await supabaseAdmin
        .from("hierarchy_admins")
        .insert({
          user_id: authUser.user.id,
          username: username.trim().toLowerCase(),
          role: "master_admin",
          full_name: "Master Admin",
          is_active: true,
        });

      if (insertErr) {
        // Rollback: delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log activity
      const { data: newAdmin } = await supabaseAdmin
        .from("hierarchy_admins")
        .select("id")
        .eq("user_id", authUser.user.id)
        .single();

      if (newAdmin) {
        await supabaseAdmin.from("admin_activity_logs").insert({
          admin_id: newAdmin.id,
          action: "master_admin_setup",
          details: "Initial master admin account created via setup wizard",
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Master admin created successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
