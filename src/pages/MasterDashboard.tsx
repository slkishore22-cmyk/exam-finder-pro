import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Sun, Moon, Plus, RefreshCw, ToggleLeft, ToggleRight, Building2, Users, Shield, KeyRound, GraduationCap, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface College {
  id: string;
  college_name: string;
  is_active: boolean | null;
  created_at: string | null;
}

const MasterDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [colleges, setColleges] = useState<College[]>([]);
  const [totalCollegeAdmins, setTotalCollegeAdmins] = useState(0);
  const [totalDeptAdmins, setTotalDeptAdmins] = useState(0);
  const [details, setDetails] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collegeName, setCollegeName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [permanentTotal, setPermanentTotal] = useState(0);
  const [resetCountOpen, setResetCountOpen] = useState(false);
  const [resetMode, setResetMode] = useState<"all" | "specific">("all");
  const [resetCountTarget, setResetCountTarget] = useState<string>("");
  const [resettingCount, setResettingCount] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const session = sessionStorage.getItem("master_admin_session");
    if (!session) { navigate("/master"); return; }
    const checkAuth = async () => {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { sessionStorage.removeItem("master_admin_session"); navigate("/master"); return; }
      const { data: admin } = await supabase
        .from("hierarchy_admins")
        .select("id, role")
        .eq("user_id", authSession.user.id)
        .eq("role", "master_admin")
        .eq("is_active", true)
        .single();
      if (!admin) { await supabase.auth.signOut(); sessionStorage.removeItem("master_admin_session"); navigate("/master"); return; }
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        sessionStorage.removeItem("master_admin_session");
        navigate("/master");
      }, 2 * 60 * 60 * 1000);
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, resetTimer)); };
  }, [navigate]);

  const hasFetchedOnce = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setFetching(true);
    try {
      const [collegeRes, statsRes, countRes] = await Promise.all([
        supabase.from("colleges").select("*").order("created_at", { ascending: false }),
        supabase.functions.invoke("manage-college-admins", { body: { action: "master_stats" } }),
        supabase.functions.invoke("master-student-count", { body: { action: "summary" } }),
      ]);

      // Only update state if data arrived successfully — never clear existing data
      if (!collegeRes.error && collegeRes.data) setColleges(collegeRes.data);

      if (!statsRes.error && statsRes.data && !statsRes.data.error) {
        setTotalCollegeAdmins(statsRes.data.total_college_admins || 0);
        setTotalDeptAdmins(statsRes.data.total_dept_admins || 0);
        setDetails(statsRes.data.details || []);
      }

      if (!countRes.error && countRes.data && !countRes.data.error) {
        setPermanentTotal(countRes.data.total_students || 0);
      }

      hasFetchedOnce.current = true;

      // If ALL calls failed, show error but keep old data
      const allFailed = !!collegeRes.error && (!!statsRes.error || statsRes.data?.error) && (!!countRes.error || countRes.data?.error);
      if (allFailed && hasFetchedOnce.current) {
        toast({ title: "Refresh failed. Showing last data.", variant: "destructive" });
      }
    } catch {
      if (hasFetchedOnce.current) {
        toast({ title: "Refresh failed. Showing last data.", variant: "destructive" });
      }
    } finally {
      if (!silent) setFetching(false);
    }
  }, [toast]);

  // Initial fetch
  useEffect(() => { if (!loading) fetchData(); }, [loading, fetchData]);

  // Auto-refresh every 5 minutes (silent)
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loading, fetchData]);

  // Realtime subscription for permanent_counts changes
  useEffect(() => {
    if (loading) return;
    const channel = supabase
      .channel("master-student-count-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "permanent_counts" }, () => fetchData(true))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loading, fetchData]);

  const handleResetCount = async () => {
    if (resetMode === "specific" && !resetCountTarget) {
      toast({ title: "Select a college", variant: "destructive" });
      return;
    }
    setResettingCount(true);
    try {
      const res = await supabase.functions.invoke("master-student-count", {
        body:
          resetMode === "all"
            ? { action: "reset", mode: "all" }
            : { action: "reset", mode: "specific", college_id: resetCountTarget },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message || "Reset failed");
      toast({ title: "Count reset successfully" });
      setResetCountOpen(false);
      setResetMode("all");
      setResetCountTarget("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setResettingCount(false);
    }
  };

  const handleCreateCollegeAdmin = async () => {
    if (!collegeName.trim() || !adminUsername.trim() || !adminPassword.trim()) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    if (adminPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return;
    }
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("manage-hierarchy", {
        body: { action: "create_college_admin", college_name: collegeName.trim(), username: adminUsername.trim(), password: adminPassword },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message || "Failed");
      toast({ title: "College admin created successfully" });
      setDialogOpen(false); setCollegeName(""); setAdminUsername(""); setAdminPassword("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleToggleCollege = async (collegeId: string, currentActive: boolean | null) => {
    setTogglingId(collegeId);
    try {
      const res = await supabase.functions.invoke("manage-hierarchy", {
        body: { action: "toggle_college", college_id: collegeId, is_active: !currentActive },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);
      setColleges(prev => prev.map(c => c.id === collegeId ? { ...c, is_active: !currentActive } : c));
      toast({ title: `College ${!currentActive ? "activated" : "deactivated"}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setTogglingId(null); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("master_admin_session");
    navigate("/master");
  };

  const handleResetPassword = async () => {
    if (!resetUsername.trim() || !resetPassword.trim()) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    if (resetPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return;
    }
    setResetting(true);
    try {
      const res = await supabase.functions.invoke("reset-admin-password", {
        body: { username: resetUsername.trim(), new_password: resetPassword },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message || "Failed");
      toast({ title: "Password reset successfully", description: res.data?.message });
      setResetDialogOpen(false); setResetUsername(""); setResetPassword("");
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally { setResetting(false); }
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Master Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { document.documentElement.classList.toggle("dark"); setDark(d => !d); }}>
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={fetching}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => setResetDialogOpen(true)}>
              <KeyRound className="w-4 h-4 mr-1.5" /> Reset Password
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create College Admin
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="liquid-glass p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Colleges</p>
              <p className="text-3xl font-bold text-foreground">{colleges.length}</p>
            </div>
          </div>
          <div className="liquid-glass p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">College Super Admins</p>
              <p className="text-3xl font-bold text-foreground">{totalCollegeAdmins}</p>
            </div>
          </div>
          <div className="liquid-glass p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Department Admins</p>
              <p className="text-3xl font-bold text-foreground">{totalDeptAdmins}</p>
            </div>
          </div>
          <div className="liquid-glass p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Students</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <p className="text-3xl font-bold text-foreground">{permanentTotal}</p>
                  <Button size="sm" variant="outline" onClick={() => setResetCountOpen(true)}>
                    Reset Count
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Colleges list */}
        <div className="liquid-glass p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Colleges</h2>
          {colleges.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No colleges added yet</p>
              <p className="text-xs text-muted-foreground">Click "Create College Admin" to add your first college and its super admin.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {colleges.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50">
                  <div>
                    <p className="font-medium text-foreground">{c.college_name}</p>
                    <p className="text-xs text-muted-foreground">Created {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                    <Button variant="outline" size="sm" disabled={togglingId === c.id} onClick={() => handleToggleCollege(c.id, c.is_active)}>
                      {c.is_active ? <ToggleRight className="w-4 h-4 mr-1.5" /> : <ToggleLeft className="w-4 h-4 mr-1.5" />}
                      {c.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create College Admin Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create College Admin</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">College Name</label>
              <Input value={collegeName} onChange={e => setCollegeName(e.target.value)} placeholder="e.g. ABC Engineering College" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Admin Username</label>
              <Input value={adminUsername} onChange={e => setAdminUsername(e.target.value)} placeholder="e.g. abc_admin" className="mt-1" autoComplete="off" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Admin Password</label>
              <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCollegeAdmin} disabled={creating}>
              {creating ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Admin Password</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Admin Username</label>
              <Input value={resetUsername} onChange={e => setResetUsername(e.target.value)} placeholder="Enter the admin's username" className="mt-1" autoComplete="off" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">New Password</label>
              <Input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" autoComplete="off" />
            </div>
            <p className="text-xs text-muted-foreground">This will reset the password for any admin (college, department, or staff) and unlock their account if locked.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Count Dialog */}
      <AlertDialog
        open={resetCountOpen}
        onOpenChange={(open) => {
          setResetCountOpen(open);
          if (!open) {
            setResetMode("all");
            setResetCountTarget("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Student Count</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset the student count? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-3">
            <Button
              type="button"
              variant={resetMode === "all" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => {
                setResetMode("all");
                setResetCountTarget("");
              }}
            >
              Reset All Colleges
            </Button>

            <Button
              type="button"
              variant={resetMode === "specific" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => setResetMode("specific")}
            >
              Reset Specific College
            </Button>

            {resetMode === "specific" && (
              <div>
                <label className="text-sm font-medium text-foreground">Select college</label>
                <Select value={resetCountTarget} onValueChange={setResetCountTarget}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a college" />
                  </SelectTrigger>
                  <SelectContent>
                    {colleges.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.college_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetCount} disabled={resettingCount || (resetMode === "specific" && !resetCountTarget)}>
              {resettingCount ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Confirm Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MasterDashboard;