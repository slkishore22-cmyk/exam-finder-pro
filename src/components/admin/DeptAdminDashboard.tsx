import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Plus, LogOut, Users, CheckCircle, Clock, Upload, UserPlus, RefreshCw, Power, KeyRound, Search,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  admin: AdminInfo;
  onLogout: () => void;
}

const StudentRow = ({ student, onUpdate }: { student: any; onUpdate: (id: string, hall: string, seat: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [hall, setHall] = useState(student.hall_number || "");
  const [seat, setSeat] = useState(student.seat_number || "");

  if (editing) {
    return (
      <TableRow>
        <TableCell>{student.roll_number}</TableCell>
        <TableCell><Input value={hall} onChange={(e) => setHall(e.target.value)} className="h-8 w-24" /></TableCell>
        <TableCell><Input value={seat} onChange={(e) => setSeat(e.target.value)} className="h-8 w-24" /></TableCell>
        <TableCell>—</TableCell>
        <TableCell className="text-right space-x-1">
          <Button size="sm" variant="ghost" onClick={() => { onUpdate(student.id, hall, seat); setEditing(false); }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{student.roll_number}</TableCell>
      <TableCell>{student.hall_number || "—"}</TableCell>
      <TableCell>{student.seat_number || "—"}</TableCell>
      <TableCell>
        <Badge variant={student.is_assigned ? "default" : "secondary"}>
          {student.is_assigned ? "Assigned" : "Pending"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
      </TableCell>
    </TableRow>
  );
};

const DeptAdminDashboard = ({ admin, onLogout }: Props) => {
  const [department, setDepartment] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, assigned: 0, pending: 0, staffUsed: 0 });
  const [createStaffOpen, setCreateStaffOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [staffForm, setStaffForm] = useState({ full_name: "", username: "", password: "", confirm: "" });
  const [addForm, setAddForm] = useState({ roll_number: "", hall_number: "", seat_number: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setFetching(true);
    const [deptRes, studRes, staffRes] = await Promise.all([
      (supabase as any).from("departments").select("*").eq("id", admin.department_id).single(),
      (supabase as any).from("hierarchy_students").select("*").eq("department_id", admin.department_id).order("roll_number"),
      (supabase as any).from("hierarchy_admins").select("*").eq("department_id", admin.department_id).eq("role", "dept_staff"),
    ]);
    setDepartment(deptRes.data);
    const studs = studRes.data || [];
    setStudents(studs);
    setStaff(staffRes.data || []);
    setStats({
      total: studs.length,
      assigned: studs.filter((s: any) => s.is_assigned).length,
      pending: studs.filter((s: any) => !s.is_assigned).length,
      staffUsed: (staffRes.data || []).length,
    });
    setFetching(false);
  }, [admin.department_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.roll_number.trim()) return;
    try {
      const { error } = await (supabase as any).from("hierarchy_students").insert({
        college_id: admin.college_id,
        department_id: admin.department_id,
        roll_number: addForm.roll_number.trim().toUpperCase(),
        hall_number: addForm.hall_number || null,
        seat_number: addForm.seat_number || null,
        is_assigned: !!(addForm.hall_number && addForm.seat_number),
        created_by: admin.id,
      });
      if (error) throw error;
      setAddForm({ roll_number: "", hall_number: "", seat_number: "" });
      fetchData();
      toast({ title: "Student added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) { toast({ title: "CSV must have headers and data", variant: "destructive" }); return; }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const ri = headers.indexOf("roll_number");
    const hi = headers.indexOf("hall_number");
    const si = headers.indexOf("seat_number");
    if (ri === -1) { toast({ title: "CSV must have roll_number column", variant: "destructive" }); return; }

    const rows = lines.slice(1).map((line) => {
      const c = line.split(",").map((x) => x.trim());
      return {
        college_id: admin.college_id,
        department_id: admin.department_id,
        roll_number: c[ri]?.toUpperCase() || "",
        hall_number: hi >= 0 ? c[hi] || null : null,
        seat_number: si >= 0 ? c[si] || null : null,
        is_assigned: hi >= 0 && si >= 0 && !!c[hi] && !!c[si],
        created_by: admin.id,
      };
    }).filter((r) => r.roll_number);

    const { error } = await (supabase as any).from("hierarchy_students").insert(rows);
    if (error) toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    else { toast({ title: `${rows.length} students uploaded` }); fetchData(); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpdateStudent = async (id: string, hall: string, seat: string) => {
    const { error } = await (supabase as any).from("hierarchy_students").update({
      hall_number: hall || null,
      seat_number: seat || null,
      is_assigned: !!(hall && seat),
    }).eq("id", id);
    if (error) toast({ title: error.message, variant: "destructive" });
    else fetchData();
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (staffForm.password !== staffForm.confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createAdmin({
        username: staffForm.username,
        password: staffForm.password,
        full_name: staffForm.full_name,
        role: "dept_staff",
      });
      toast({ title: "Staff account created" });
      setStaffForm({ full_name: "", username: "", password: "", confirm: "" });
      setCreateStaffOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
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

  const filtered = students.filter(
    (s) => !searchQuery || s.roll_number.includes(searchQuery.toUpperCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b border-border"
        style={{ background: "linear-gradient(135deg, hsl(175 50% 25%), hsl(175 60% 38%))" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            {department?.department_name || "Department"} — Department Admin
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70">{admin.full_name}</span>
            <Badge variant="secondary">Dept Admin</Badge>
            <Link to="/admin/profile">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">Profile</Button>
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
            { label: "Total Students", value: stats.total, icon: <Users className="w-5 h-5 text-primary" /> },
            { label: "Assigned", value: stats.assigned, icon: <CheckCircle className="w-5 h-5 text-primary" /> },
            { label: "Pending", value: stats.pending, icon: <Clock className="w-5 h-5 text-primary" /> },
            { label: "Staff Used", value: `${stats.staffUsed}/3`, icon: <UserPlus className="w-5 h-5 text-primary" /> },
          ].map((s) => (
            <div key={s.label} className="liquid-glass p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="students" className="space-y-4">
          <TabsList>
            <TabsTrigger value="students">Roll Numbers</TabsTrigger>
            <TabsTrigger value="staff">Staff Accounts</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-4">
            {/* Add student form */}
            <div className="liquid-glass p-4">
              <h3 className="text-sm font-semibold mb-3">Add Student</h3>
              <form onSubmit={handleAddStudent} className="flex gap-2 flex-wrap">
                <Input placeholder="Roll Number" value={addForm.roll_number} onChange={(e) => setAddForm((f) => ({ ...f, roll_number: e.target.value }))} className="w-40" required />
                <Input placeholder="Hall Number" value={addForm.hall_number} onChange={(e) => setAddForm((f) => ({ ...f, hall_number: e.target.value }))} className="w-32" />
                <Input placeholder="Seat Number" value={addForm.seat_number} onChange={(e) => setAddForm((f) => ({ ...f, seat_number: e.target.value }))} className="w-32" />
                <Button type="submit" size="sm"><Plus className="w-4 h-4 mr-1" />Add</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" />CSV Upload
                </Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
              </form>
            </div>

            {/* Search and list */}
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search roll number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="liquid-glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Hall</TableHead>
                    <TableHead>Seat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s: any) => (
                    <StudentRow key={s.id} student={s} onUpdate={handleUpdateStudent} />
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No students</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="staff" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{stats.staffUsed}/3 Staff Created</h3>
              {stats.staffUsed < 3 && (
                <Dialog open={createStaffOpen} onOpenChange={setCreateStaffOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="w-4 h-4 mr-1" />Create Staff</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Staff Account</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateStaff} className="space-y-3">
                      <Input placeholder="Staff Full Name" value={staffForm.full_name} onChange={(e) => setStaffForm((f) => ({ ...f, full_name: e.target.value }))} required />
                      <Input placeholder="Username" value={staffForm.username} onChange={(e) => setStaffForm((f) => ({ ...f, username: e.target.value }))} required />
                      <Input type="password" placeholder="Password (min 8)" value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
                      <Input type="password" placeholder="Confirm Password" value={staffForm.confirm} onChange={(e) => setStaffForm((f) => ({ ...f, confirm: e.target.value }))} required />
                      <Button type="submit" disabled={submitting} className="w-full">{submitting ? "Creating..." : "Create"}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="liquid-glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.username}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? "default" : "secondary"}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await adminApi.toggleActive(s.id, !s.is_active, "admin");
                                fetchData();
                              } catch {}
                            }}
                          >
                            <Power className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setResetTarget(s); setResetOpen(true); }}>
                            <KeyRound className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {staff.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No staff accounts</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password for {resetTarget?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="password" placeholder="New Password (min 8)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Button onClick={handleResetPassword} className="w-full">Reset Password</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeptAdminDashboard;
