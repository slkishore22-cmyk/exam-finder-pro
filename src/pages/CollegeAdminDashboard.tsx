import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { LogOut, Building2, Users, Layers, Plus, Shield, ShieldOff, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

interface DeptAdmin {
  id: string;
  username: string;
  full_name: string;
  department_name: string;
  is_active: boolean;
  created_at: string;
  role: string;
}

const CollegeAdminDashboard = () => {
  const [collegeName, setCollegeName] = useState("");
  const [adminId, setAdminId] = useState("");
  const [deptAdmins, setDeptAdmins] = useState<DeptAdmin[]>([]);
  const [allSubordinates, setAllSubordinates] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  
  const [totalDepartments, setTotalDepartments] = useState(0);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const sessionData = sessionStorage.getItem("college_admin_session");
    if (!sessionData) {
      navigate("/college-admin");
      return;
    }
    const parsed = JSON.parse(sessionData);
    setCollegeName(parsed.college_name || "College");
    setAdminId(parsed.admin_id || "");
  }, [navigate]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.removeItem("college_admin_session");
        navigate("/college-admin");
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

  const fetchDeptAdmins = async () => {
    if (!adminId) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-college-admins", {
        body: { action: "list_dept_admins", admin_id: adminId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDeptAdmins(data?.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const fetchSubordinates = async () => {
    try {
      const res = await supabase.functions.invoke("manage-staff", {
        body: { action: "list_college_subordinates" },
      });
      if (!res.error && res.data?.data) setAllSubordinates(res.data.data);
    } catch { /* ignore - college admin may not have auth session */ }
  };

  const fetchStats = async () => {
    if (!adminId) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-college-admins", {
        body: { action: "college_stats", admin_id: adminId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTotalStudents(data.total_students || 0);
      setTotalDepartments(data.total_departments || 0);
    } catch (err: any) {
      console.error("Stats error:", err);
    }
  };


  useEffect(() => {
    if (adminId) {
      Promise.all([fetchDeptAdmins(), fetchStats(), fetchSubordinates()]).finally(() => setLoading(false));
    }
  }, [adminId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-college-admins", {
        body: {
          action: "create_dept_admin",
          admin_id: adminId,
          department_name: deptName,
          username,
          password,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Success", description: "Department admin created successfully" });
      setDeptName("");
      setUsername("");
      setPassword("");
      setDialogOpen(false);
      fetchDeptAdmins();
      fetchStats();
      fetchSubordinates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (deptAdminId: string, currentActive: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-college-admins", {
        body: {
          action: "toggle_dept_admin",
          admin_id: adminId,
          dept_admin_id: deptAdminId,
          is_active: !currentActive,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Success", description: `Admin ${currentActive ? "deactivated" : "activated"}` });
      fetchDeptAdmins();
      fetchSubordinates();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword.trim() || resetPassword !== resetConfirm) {
      toast({ title: "Passwords don't match or empty", variant: "destructive" }); return;
    }
    if (resetPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return;
    }
    setResetting(true);
    try {
      const res = await supabase.functions.invoke("manage-staff", {
        body: { action: "reset_password", target_username: resetTarget, new_password: resetPassword },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);
      toast({ title: "Password reset successfully" });
      setResetOpen(false); setResetPassword(""); setResetConfirm(""); setResetTarget("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setResetting(false); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("college_admin_session");
    navigate("/college-admin");
  };

  if (!collegeName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{collegeName} - Super Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setChangePasswordOpen(true)}>
              <KeyRound className="w-4 h-4 mr-1.5" /> Password
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1.5" /> Sign out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="liquid-glass p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Departments</p>
              <p className="text-2xl font-bold text-foreground">{totalDepartments}</p>
            </div>
          </div>
          <div className="liquid-glass p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Students</p>
              <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
            </div>
          </div>
        </div>

        {/* Department Admins Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Department Admins</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" /> Create Department Admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Department Admin</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 mt-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">Department Name</label>
                    <Input value={deptName} onChange={e => setDeptName(e.target.value)} placeholder="e.g. Computer Science" required className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Username</label>
                    <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. cs_admin" required autoComplete="off" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} autoComplete="off" className="mt-1" />
                  </div>
                  <Button type="submit" disabled={creating} className="w-full">
                    {creating ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Create"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="liquid-glass p-6 text-center">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : deptAdmins.length === 0 ? (
            <div className="liquid-glass p-8 text-center">
              <Layers className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No department admins created yet</p>
              <p className="text-xs text-muted-foreground">Click "Create Department Admin" to add departments and their admins.</p>
            </div>
          ) : (
            <div className="liquid-glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Department</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Username</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deptAdmins.map(admin => (
                    <tr key={admin.id} className="border-b border-border/30 last:border-0">
                      <td className="p-3 text-foreground">{admin.department_name}</td>
                      <td className="p-3 text-foreground">{admin.username}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          admin.is_active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        }`}>
                          {admin.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(admin.id, admin.is_active)} className="text-xs">
                          {admin.is_active ? <><ShieldOff className="w-3.5 h-3.5 mr-1" /> Deactivate</> : <><Shield className="w-3.5 h-3.5 mr-1" /> Activate</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* All Subordinates (dept admins + staff) */}
        {allSubordinates.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">All Admins & Staff</h2>
            <div className="liquid-glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Username</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Department</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allSubordinates.map(sub => (
                    <tr key={sub.id} className="border-b border-border/30 last:border-0">
                      <td className="p-3 text-foreground">{sub.full_name}</td>
                      <td className="p-3 text-foreground">{sub.username}</td>
                      <td className="p-3 text-muted-foreground">{sub.department_name}</td>
                      <td className="p-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sub.role === "dept_admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                          {sub.role === "dept_admin" ? "Dept Admin" : "Staff"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sub.is_active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                          {sub.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">All Admins & Staff</h2>
            <div className="liquid-glass p-8 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No admins or staff yet</p>
              <p className="text-xs text-muted-foreground">Department admins and their staff will appear here once created.</p>
            </div>
          </div>
        )}
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetTarget}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">New Password</label>
              <Input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" autoComplete="off" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Confirm Password</label>
              <Input type="password" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} placeholder="Re-enter password" className="mt-1" autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
};

export default CollegeAdminDashboard;
