import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { LogOut, Plus, Upload, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminInfo } from "@/hooks/useAdminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props {
  admin: AdminInfo;
  onLogout: () => void;
}

const StaffStudentRow = ({ student, onUpdate }: { student: any; onUpdate: (id: string, hall: string, seat: string) => void }) => {
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
        <TableCell className="text-right">
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

const StaffDashboard = ({ admin, onLogout }: Props) => {
  const [department, setDepartment] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addForm, setAddForm] = useState({ roll_number: "", hall_number: "", seat_number: "" });
  const [fetching, setFetching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setFetching(true);
    const [deptRes, studRes] = await Promise.all([
      (supabase as any).from("departments").select("*").eq("id", admin.department_id).single(),
      (supabase as any).from("hierarchy_students").select("*").eq("department_id", admin.department_id).order("roll_number"),
    ]);
    setDepartment(deptRes.data);
    setStudents(studRes.data || []);
    setFetching(false);
  }, [admin.department_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.roll_number.trim()) return;
    const { error } = await (supabase as any).from("hierarchy_students").insert({
      college_id: admin.college_id,
      department_id: admin.department_id,
      roll_number: addForm.roll_number.trim().toUpperCase(),
      hall_number: addForm.hall_number || null,
      seat_number: addForm.seat_number || null,
      is_assigned: !!(addForm.hall_number && addForm.seat_number),
      created_by: admin.id,
    });
    if (error) toast({ title: error.message, variant: "destructive" });
    else {
      setAddForm({ roll_number: "", hall_number: "", seat_number: "" });
      fetchData();
      toast({ title: "Added" });
    }
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const ri = headers.indexOf("roll_number");
    const hi = headers.indexOf("hall_number");
    const si = headers.indexOf("seat_number");
    if (ri === -1) { toast({ title: "Missing roll_number column", variant: "destructive" }); return; }

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
    if (error) toast({ title: error.message, variant: "destructive" });
    else { toast({ title: `${rows.length} uploaded` }); fetchData(); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpdate = async (id: string, hall: string, seat: string) => {
    await (supabase as any).from("hierarchy_students").update({
      hall_number: hall || null,
      seat_number: seat || null,
      is_assigned: !!(hall && seat),
    }).eq("id", id);
    fetchData();
  };

  const filtered = students.filter(
    (s) => !searchQuery || s.roll_number.includes(searchQuery.toUpperCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b border-border"
        style={{ background: "linear-gradient(135deg, hsl(145 50% 25%), hsl(145 60% 38%))" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            {department?.department_name || "Department"} — Staff Panel
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/70">{admin.full_name}</span>
            <Badge variant="secondary">Staff</Badge>
            <Link to="/admin/profile">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">Profile</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-white/70 hover:text-white">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-4">
        {/* Add form */}
        <div className="liquid-glass p-4">
          <h3 className="text-sm font-semibold mb-3">Add Roll Number</h3>
          <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
            <Input placeholder="Roll Number" value={addForm.roll_number} onChange={(e) => setAddForm((f) => ({ ...f, roll_number: e.target.value }))} className="w-40" required />
            <Input placeholder="Hall" value={addForm.hall_number} onChange={(e) => setAddForm((f) => ({ ...f, hall_number: e.target.value }))} className="w-28" />
            <Input placeholder="Seat" value={addForm.seat_number} onChange={(e) => setAddForm((f) => ({ ...f, seat_number: e.target.value }))} className="w-28" />
            <Button type="submit" size="sm"><Plus className="w-4 h-4 mr-1" />Add</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          </form>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
          </Button>
          <span className="text-sm text-muted-foreground">{students.length} students</span>
        </div>

        {/* Table */}
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
                <StaffStudentRow key={s.id} student={s} onUpdate={handleUpdate} />
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No students</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default StaffDashboard;
