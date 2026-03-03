import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Plus, LogOut, Building2, Users, BarChart3, Power, KeyRound, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "@/lib/adminApi";
import { useAdminSession } from "@/hooks/useAdminSession";
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

const MasterDashboard = () => {
  const { admin, loading, logout } = useAdminSession(["master_admin"]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalColleges: 0, activeColleges: 0, totalStudents: 0 });
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({
    college_name: "", full_name: "", username: "", password: "", confirm: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setFetching(true);
    const [colRes, studRes, adminsRes] = await Promise.all([
      (supabase as any).from("colleges").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("hierarchy_students").select("id", { count: "exact", head: true }),
      (supabase as any)
        .from("hierarchy_admins")
        .select("id, college_id, full_name, username, role, is_active, created_at")
        .neq("role", "master_admin")
        .order("created_at", { ascending: false }),
    ]);
    const cols = colRes.data || [];
    setColleges(
      cols.map((c: any) => ({
        ...c,
        admins: (adminsRes.data || []).filter((a: any) => a.college_id === c.id),
      }))
    );
    setStats({
      totalColleges: cols.length,
      activeColleges: cols.filter((c: any) => c.is_active).length,
      totalStudents: studRes.count || 0,
    });
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!loading && admin) fetchData();
  }, [loading, admin, fetchData]);

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
        full_name: form.full_name, role: "college_super_admin",
        college_name: form.college_name,
      });
      toast({
        title: "College admin created",
        description: `${form.full_name} (${form.username})`,
      });
      setForm({ college_name: "", full_name: "", username: "", password: "", confirm: "" });
      setCreateOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, current: boolean, type: string) => {
    try {
      await adminApi.toggleActive(id, !current, type);
      fetchData();
      toast({ title: current ? "Deactivated" : "Activated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    try {
      await adminApi.resetPassword(resetTarget.id, newPassword);
      toast({ title: "Password reset successfully" });
      setResetOpen(false);
      setNewPassword("");
      setResetTarget(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="border-b border-border"
        style={{ background: "linear-gradient(135deg, hsl(220 50% 20%), hsl(220 60% 30%))" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Master Admin Panel</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70">
              Logged in as:{" "}
              <span className="font-medium text-white">{admin?.full_name}</span>
            </span>
            <Badge variant="secondary" className="text-xs">
              Master Admin
            </Badge>
            <Link to="/admin/profile">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                Profile
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-white/70 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Colleges", value: stats.totalColleges, icon: <Building2 className="w-5 h-5 text-primary" /> },
            { label: "Active Colleges", value: stats.activeColleges, icon: <BarChart3 className="w-5 h-5 text-primary" /> },
            { label: "Total Students", value: stats.totalStudents, icon: <Users className="w-5 h-5 text-primary" /> },
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
          <h2 className="text-lg font-semibold text-foreground">Colleges</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={fetching}>
              <RefreshCw className={`w-4 h-4 mr-1 ${fetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Create College Admin
                </Button>
              </DialogTrigger>
              <DialogContent className="liquid-glass">
                <DialogHeader>
                  <DialogTitle>Create College Super Admin</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-3">
                  <Input
                    placeholder="College Name"
                    value={form.college_name}
                    onChange={(e) => setForm((f) => ({ ...f, college_name: e.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Admin Full Name"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Username"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password (min 8 chars)"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    minLength={8}
                  />
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    value={form.confirm}
                    onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                    required
                  />
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? "Creating..." : "Create"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* College Table */}
        <div className="liquid-glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>College Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Super Admin</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colleges.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.college_name}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.admins
                      ?.filter((a: any) => a.role === "college_super_admin")
                      .map((a: any) => a.full_name)
                      .join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(c.id, c.is_active, "college")}
                      >
                        <Power className="w-4 h-4 mr-1" />
                        {c.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      {c.admins
                        ?.filter((a: any) => a.role === "college_super_admin")
                        .map((a: any) => (
                          <Button
                            key={a.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setResetTarget(a);
                              setResetOpen(true);
                            }}
                          >
                            <KeyRound className="w-4 h-4 mr-1" />
                            Reset PW
                          </Button>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {colleges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No colleges yet. Create one to get started.
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
            <Input
              type="password"
              placeholder="New Password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
            <Button onClick={handleResetPassword} className="w-full">
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterDashboard;
