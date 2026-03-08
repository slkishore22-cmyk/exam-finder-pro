import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: callerAdmin } = await supabaseAdmin
      .from("hierarchy_admins")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!callerAdmin || callerAdmin.role !== "master_admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { action, ...payload } = body;

    if (action === "summary") {
      const [collegesRes, countsRes] = await Promise.all([
        supabaseAdmin.from("colleges").select("id, college_name").order("college_name", { ascending: true }),
        supabaseAdmin.from("permanent_counts").select("college_id, total_students"),
      ]);

      if (collegesRes.error) return json({ error: collegesRes.error.message }, 400);
      if (countsRes.error) return json({ error: countsRes.error.message }, 400);

      const countMap: Record<string, number> = {};
      let total = 0;

      for (const row of countsRes.data || []) {
        const rowTotal = row.total_students || 0;
        countMap[row.college_id] = rowTotal;
        total += rowTotal;
      }

      const colleges = (collegesRes.data || []).map((college) => ({
        id: college.id,
        college_name: college.college_name,
        total_students: countMap[college.id] || 0,
      }));

      return json({ success: true, total_students: total, colleges });
    }

    if (action === "reset") {
      const mode = payload?.mode;
      const nowIso = new Date().toISOString();

      if (mode === "all") {
        const { error } = await supabaseAdmin
          .from("permanent_counts")
          .update({ total_students: 0, last_reset_at: nowIso, last_reset_by: callerAdmin.id } as never)
          .neq("id", "00000000-0000-0000-0000-000000000000");

        if (error) return json({ error: error.message }, 400);

        await supabaseAdmin.from("admin_activity_logs").insert({
          admin_id: callerAdmin.id,
          action: "reset_permanent_count",
          details: "Reset permanent student count for all colleges",
        });

        return json({ success: true });
      }

      if (mode === "specific") {
        const collegeId = payload?.college_id;
        if (!collegeId) return json({ error: "college_id is required" }, 400);

        const { error: upsertError } = await supabaseAdmin
          .from("permanent_counts")
          .upsert(
            {
              college_id: collegeId,
              total_students: 0,
              last_reset_at: nowIso,
              last_reset_by: callerAdmin.id,
            },
            { onConflict: "college_id" },
          );

        if (upsertError) return json({ error: upsertError.message }, 400);

        await supabaseAdmin.from("admin_activity_logs").insert({
          admin_id: callerAdmin.id,
          action: "reset_permanent_count",
          details: `Reset permanent student count for college ${collegeId}`,
        });

        return json({ success: true });
      }

      return json({ error: "Invalid reset mode" }, 400);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message || "Unexpected error" }, 500);
  }
});
