import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LogOut, Building2, Users, Layers, Plus, Shield, ShieldOff, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DeptAdmin {
  id: string;
  username: string;
  full_name: string;
  department_name: string;
  is_active: boolean;
  created_at: string;
}

interface DeptBreakdown {
  department_name: string;
  total: number;
  assigned: number;
  pending: number;
}

const CollegeAdminDashboard = () => {
  const [collegeName, setCollegeName] = useState("");
  const [adminId, setAdminId] = useState("");
  const [deptAdmins, setDeptAdmins] = useState<DeptAdmin[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalAssigned, setTotalAssigned] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [totalDepartments, setTotalDepartments] = useState(0);
  const [deptBreakdown, setDeptBreakdown] = useState<DeptBreakdown[]>([]);
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

  // Inactivity timeout (2 hours)
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

  const fetchStats = async () => {
    if (!adminId) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-college-admins", {
        body: { action: "college_stats", admin_id: adminId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTotalStudents(data.total_students || 0);
      setTotalAssigned(data.total_assigned || 0);
      setTotalPending(data.total_pending || 0);
      setTotalDepartments(data.total_departments || 0);
      setDeptBreakdown(data.departments || []);
    } catch (err: any) {
      console.error("Stats error:", err);
    }
  };

  useEffect(() => {
    if (adminId) {
      Promise.all([fetchDeptAdmins(), fetchStats()]).finally(() => setLoading(false));
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
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{collegeName} - Super Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-1.5" /> Sign out
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="liquid-glass p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Departments</p>
              <p className="text-2xl font-bold text-foreground">{totalDepartments}</p>
            </div>
          </div>
          <div className="liquid-glass p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
            </div>
          </div>
          <div className="liquid-glass p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assigned</p>
              <p className="text-2xl font-bold text-foreground">{totalAssigned}</p>
            </div>
          </div>
          <div className="liquid-glass p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-foreground">{totalPending}</p>
            </div>
          </div>
        </div>

        {/* Department-wise breakdown */}
        {deptBreakdown.length > 0 && (
          <div className="liquid-glass overflow-hidden mb-8">
            <div className="p-4 border-b border-border/50">
              <h2 className="text-sm font-semibold text-foreground">Department-wise Students</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Department</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Assigned</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Pending</th>
                </tr>
              </thead>
              <tbody>
                {deptBreakdown.map((dept, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="p-3 text-foreground">{dept.department_name}</td>
                    <td className="p-3 text-center text-foreground">{dept.total}</td>
                    <td className="p-3 text-center text-green-500">{dept.assigned}</td>
                    <td className="p-3 text-center text-amber-500">{dept.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
            <div className="liquid-glass p-6 text-center">
              <p className="text-muted-foreground text-sm">No department admins created yet.</p>
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
      </div>
    </div>
  );
};

export default CollegeAdminDashboard;
