import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, RefreshCw, Sun, Moon, Link2, Check, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import AddAssignmentDialog from "@/components/AddAssignmentDialog";
import BatchCard from "@/components/BatchCard";
import StaffPanel from "@/components/StaffPanel";
import ActivityLog from "@/components/ActivityLog";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

interface HallAssignment {
  id: string;
  roll_number: string;
  hall_number: string;
  batch_id: string | null;
}

interface Batch {
  id: string;
  name: string;
  scheduled_at: string | null;
  created_at: string;
}

interface GroupedBatch extends Batch {
  assignments: HallAssignment[];
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<GroupedBatch[]>([]);
  const [fetching, setFetching] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [copied, setCopied] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [adminRole, setAdminRole] = useState<string>("dept_admin");
  const [adminName, setAdminName] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const appLink = "https://seat-finder-plus.lovable.app";
  const navigate = useNavigate();
  const { toast } = useToast();

  const isDeptAdmin = adminRole === "dept_admin";
  const isStaff = adminRole === "dept_staff";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/admin");
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/admin");
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // 2-hour inactivity timeout
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/admin");
      }, 2 * 60 * 60 * 1000);
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [navigate]);

  // Fetch role info
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await supabase.functions.invoke("manage-staff", {
          body: { action: "get_role_info" },
        });
        if (!res.error && res.data) {
          setAdminRole(res.data.role || "dept_admin");
          setAdminName(res.data.full_name || "");
        }
      } catch { /* ignore */ }
    };
    if (!loading) fetchRole();
  }, [loading]);

  const fetchData = useCallback(async () => {
    setFetching(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let departmentId: string | null = null;
      if (user) {
        const { data: adminInfo, error: adminErr } = await supabase
          .from("hierarchy_admins")
          .select("department_id, role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        if (adminErr) throw adminErr;
        if (adminInfo?.department_id) {
          departmentId = adminInfo.department_id;
        }
      }

      let batchQuery = supabase.from("assignment_batches").select("id, name, scheduled_at, created_at").order("created_at", { ascending: false });
      let assignQuery = supabase.from("hall_assignments").select("id, roll_number, hall_number, batch_id").order("roll_number");

      if (departmentId) {
        batchQuery = batchQuery.eq("department_id", departmentId);
        assignQuery = assignQuery.eq("department_id", departmentId);
      }

      const [batchRes, assignRes] = await Promise.all([batchQuery, assignQuery]);

      if (batchRes.error || assignRes.error) {
        throw new Error(batchRes.error?.message || assignRes.error?.message || "Failed to load data");
      }

      const batchList = batchRes.data || [];
      const assignList = assignRes.data || [];
      const grouped: GroupedBatch[] = batchList.map(b => ({
        ...b,
        assignments: assignList.filter(a => a.batch_id === b.id),
      }));
      setBatches(grouped);
    } catch (err: any) {
      toast({ title: "Failed to load data", description: err?.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  }, [toast]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke("manage-staff", {
        body: { action: "list_staff" },
      });
      if (!res.error && res.data?.data) setStaff(res.data.data);
    } catch { /* ignore */ }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await supabase.functions.invoke("manage-staff", {
        body: { action: "list_activity" },
      });
      if (!res.error && res.data?.data) setActivityLogs(res.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchData();
      fetchStaff();
      fetchActivity();
    }
  }, [loading, fetchData, fetchStaff, fetchActivity]);

  const handleRefreshAll = async () => {
    await Promise.all([fetchData(), fetchStaff(), fetchActivity()]);
    toast({ title: "Refreshed" });
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (isStaff) {
      toast({ title: "Staff cannot delete batches", variant: "destructive" });
      return;
    }
    setDeletingBatch(batchId);
    const { error } = await supabase.from("assignment_batches").delete().eq("id", batchId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setBatches(prev => prev.filter(b => b.id !== batchId));
      toast({ title: "Batch deleted" });
    }
    setDeletingBatch(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Hall Assignments</h1>
            {adminName && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {adminName} · <span className="capitalize">{adminRole === "dept_admin" ? "Department Admin" : "Staff"}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                document.documentElement.classList.toggle("dark");
                setDark(d => !d);
              }}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={fetching}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setChangePasswordOpen(true)}>
              <KeyRound className="w-4 h-4 mr-1.5" />
              Password
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>

        {/* Share Link */}
        <div className="liquid-glass p-4 mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground shrink-0">Student App Link:</span>
            <span className="text-sm font-medium text-foreground truncate">{appLink}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(appLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Link2 className="w-4 h-4 mr-1.5" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const text = encodeURIComponent(`Find your exam hall here: ${appLink}`);
                window.open(`https://wa.me/?text=${text}`, "_blank");
              }}
            >
              <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </Button>
          </div>
        </div>

        {/* Staff Panel */}
        <StaffPanel staff={staff} isDeptAdmin={isDeptAdmin} onRefresh={() => { fetchStaff(); fetchActivity(); }} />

        {/* Activity Log */}
        <ActivityLog logs={activityLogs} />

        {/* Batch grid */}
        {batches.length === 0 && !fetching ? (
          <div className="py-16 text-center border border-border rounded-xl">
            <Plus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No students added yet</p>
            <p className="text-xs text-muted-foreground">Click "Add" to create a batch and assign hall numbers to students.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {batches.map(b => (
              <BatchCard
                key={b.id}
                batchId={b.id}
                name={b.name}
                scheduledAt={b.scheduled_at}
                assignments={b.assignments}
                onDeleteBatch={handleDeleteBatch}
                onRefresh={handleRefreshAll}
                deleting={deletingBatch === b.id}
                canDelete={isDeptAdmin}
              />
            ))}
          </div>
        )}

        {fetching && (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3 text-center">
          {batches.length} batch{batches.length !== 1 ? "es" : ""} · {batches.reduce((s, b) => s + b.assignments.length, 0)} total assignments
        </p>
      </div>

      <AddAssignmentDialog open={open} onOpenChange={setOpen} onSaved={handleRefreshAll} />
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
};

export default AdminDashboard;
