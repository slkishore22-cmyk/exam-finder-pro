import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Plus, LogOut, Building, Users, CheckCircle, Clock, RefreshCw, Power, KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "@/lib/adminApi";
import { AdminInfo } from "@/hooks/useAdminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props {
  admin: AdminInfo;
  onLogout: () => void;
}

const CollegeAdminDashboard = ({ admin, onLogout }: Props) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [college, setCollege] = useState<any>(null);
  const [stats, setStats] = useState({ depts: 0, students: 0, assigned: 0, pending: 0 });
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({
    department_name: "", full_name: "", username: "", password: "", confirm: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setFetching(true);
    const [colRes, deptRes, studRes, adminsRes] = await Promise.all([
      (supabase as any).from("colleges").select("*").eq("id", admin.college_id).single(),
      (supabase as any).from("departments").select("*").eq("college_id", admin.college_id).order("created_at", { ascending: false }),
      (supabase as any).from("hierarchy_students").select("id, is_assigned").eq("college_id", admin.college_id),
      (supabase as any).from("hierarchy_admins").select("*").eq("college_id", admin.college_id).neq("role", "college_super_admin").order("created_at"),
    ]);
    setCollege(colRes.data);
    const depts = deptRes.data || [];
    const students = studRes.data || [];
    const admins = adminsRes.data || [];
    setDepartments(
      depts.map((d: any) => ({
        ...d,
        admin: admins.find((a: any) => a.department_id === d.id && a.role === "dept_admin"),
        staffCount: admins.filter((a: any) => a.department_id === d.id && a.role === "dept_staff").length,
        studentCount: students.filter((s: any) => s.department_id === d.id).length,
      }))
    );
    setStats({
      depts: depts.length,
      students: students.length,
      assigned: students.filter((s: any) => s.is_assigned).length,
      pending: students.filter((s: any) => !s.is_assigned).length,
    });
    setFetching(false);
  }, [admin.college_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (form.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createAdmin({
        username: form.username, password: form.password,
        full_name: form.full_name, role: "dept_admin",
        department_name: form.department_name,
      });
      toast({ title: "Department admin created" });
      setForm({ department_name: "", full_name: "", username: "", password: "", confirm: "" });
      setCreateOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await adminApi.toggleActive(id, !current, "admin");
      fetchData();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 8) return;
    try {
      await adminApi.resetPassword(resetTarget.id, newPassword);
      toast({ title: "Password reset" });
      setResetOpen(false);
      setNewPassword("");
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b border-border"
        style={{ background: "linear-gradient(135deg, hsl(210 60% 30%), hsl(210 70% 45%))" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            {college?.college_name || "College"} — Super Admin
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70">{admin.full_name}</span>
            <Badge variant="secondary">College Admin</Badge>
            <Link to="/admin/profile">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                Profile
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-white/70 hover:text-white">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Departments", value: stats.depts, icon: <Building className="w-5 h-5 text-primary" /> },
            { label: "Total Students", value: stats.students, icon: <Users className="w-5 h-5 text-primary" /> },
            { label: "Assigned", value: stats.assigned, icon: <CheckCircle className="w-5 h-5 text-primary" /> },
            { label: "Pending", value: stats.pending, icon: <Clock className="w-5 h-5 text-primary" /> },
          ].map((s) => (
            <div key={s.label} className="liquid-glass p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Departments</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${fetching ? "animate-spin" : ""}`} />
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Create Department Admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Department Admin</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-3">
                  <Input placeholder="Department Name" value={form.department_name} onChange={(e) => setForm((f) => ({ ...f, department_name: e.target.value }))} required />
                  <Input placeholder="Admin Full Name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
                  <Input placeholder="Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required />
                  <Input type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
                  <Input type="password" placeholder="Confirm Password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} required />
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Creating..." : "Create"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Table */}
        <div className="liquid-glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.department_name}</TableCell>
                  <TableCell>{d.admin?.full_name || "—"}</TableCell>
                  <TableCell>{d.staffCount}/3</TableCell>
                  <TableCell>{d.studentCount}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? "default" : "secondary"}>
                      {d.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {d.admin && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(d.admin.id, d.admin.is_active)}>
                          <Power className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setResetTarget(d.admin); setResetOpen(true); }}>
                          <KeyRound className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {departments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No departments yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {resetTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="password" placeholder="New Password (min 8)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Button onClick={handleResetPassword} className="w-full">Reset Password</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollegeAdminDashboard;
