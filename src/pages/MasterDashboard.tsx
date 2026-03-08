import { useEffect, useState, useCallback } from "react";
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
} from "@/components/ui/dialog";

interface College {
  id: string;
  college_name: string;
  is_active: boolean | null;
  created_at: string | null;
}

const MasterDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [colleges, setColleges] = useState<College[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
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

  const fetchData = useCallback(async () => {
    setFetching(true);
    const [collegeRes, statsRes] = await Promise.all([
      supabase.from("colleges").select("*").order("created_at", { ascending: false }),
      supabase.functions.invoke("manage-college-admins", { body: { action: "master_stats" } }),
    ]);
    if (!collegeRes.error) setColleges(collegeRes.data || []);
    if (!statsRes.error && statsRes.data) {
      setTotalStudents(statsRes.data.total_students || 0);
      setTotalCollegeAdmins(statsRes.data.total_college_admins || 0);
      setTotalDeptAdmins(statsRes.data.total_dept_admins || 0);
      setDetails(statsRes.data.details || []);
    }
    setFetching(false);
  }, []);

  useEffect(() => { if (!loading) fetchData(); }, [loading, fetchData]);

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
            <Button variant="outline" size="sm" onClick={fetchData} disabled={fetching}>
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
              <p className="text-sm text-muted-foreground">Total College Super Admins</p>
              <p className="text-3xl font-bold text-foreground">{totalCollegeAdmins}</p>
            </div>
          </div>
          <div className="liquid-glass p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Department Admins</p>
              <p className="text-3xl font-bold text-foreground">{totalDeptAdmins}</p>
            </div>
          </div>
          <div className="liquid-glass p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-3xl font-bold text-foreground">{totalStudents}</p>
            </div>
          </div>
        </div>

        {/* Details Table */}
        <div className="liquid-glass p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">College Details</h2>
          {details.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No colleges yet. Click "Create College Admin" to add one.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>College Name</TableHead>
                    <TableHead>Super Admin Username</TableHead>
                    <TableHead>Total Dept Admins</TableHead>
                    <TableHead>Total Students</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{d.college_name}</TableCell>
                      <TableCell>{d.super_admin_username}</TableCell>
                      <TableCell>{d.total_dept_admins}</TableCell>
                      <TableCell>{d.total_students}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${d.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Colleges list */}
        <div className="liquid-glass p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Colleges</h2>
          {colleges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No colleges yet.</p>
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
    </div>
  );
};

export default MasterDashboard;