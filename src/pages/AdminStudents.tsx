import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AdminLayout from "@/components/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SeatingRow {
  id: string;
  roll_number: string;
  room: string;
  block: string;
  floor: string;
  exam_id: string;
  exams: { name: string } | { name: string }[] | null;
}

interface Exam {
  id: string;
  name: string;
}

const AdminStudents = () => {
  const [rows, setRows] = useState<SeatingRow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ roll_number: "", room: "", block: "", floor: "", exam_id: "" });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("seating").select("*, exams(name)").order("created_at", { ascending: false }).limit(200);
    if (data) setRows(data as SeatingRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from("exams").select("id, name").then(({ data }) => { if (data) setExams(data); });
  }, []);

  const handleAdd = async () => {
    if (!form.roll_number || !form.room || !form.exam_id) return;
    const { error } = await supabase.from("seating").insert({ ...form, roll_number: form.roll_number.toUpperCase() });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Added" });
      setDialogOpen(false);
      setForm({ roll_number: "", room: "", block: "", floor: "", exam_id: "" });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("seating").delete().eq("id", id);
    setRows((r) => r.filter((row) => row.id !== id));
  };

  const getExamName = (row: SeatingRow) => {
    if (!row.exams) return "";
    if (Array.isArray(row.exams)) return row.exams[0]?.name ?? "";
    return row.exams.name;
  };

  const filtered = rows.filter((r) =>
    r.roll_number.toLowerCase().includes(search.toLowerCase()) ||
    r.room.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Student Records</h1>
            <p className="text-muted-foreground">{rows.length} total records</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-press rounded-xl">
                <Plus className="w-4 h-4 mr-1.5" /> Add Record
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Student Record</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-4">
                <Input placeholder="Roll Number" value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} className="rounded-xl" />
                <Input placeholder="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="rounded-xl" />
                <Input placeholder="Block" value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} className="rounded-xl" />
                <Input placeholder="Floor" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="rounded-xl" />
                <select
                  value={form.exam_id}
                  onChange={(e) => setForm({ ...form, exam_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-secondary/60 border border-border/60 text-sm"
                >
                  <option value="">Select exam...</option>
                  {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <Button onClick={handleAdd} className="w-full rounded-xl btn-press">Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">Roll Number</th>
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">Room</th>
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">Block</th>
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">Floor</th>
                  <th className="text-left px-6 py-4 font-medium text-muted-foreground">Exam</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-4"><div className="shimmer h-4 w-20 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No records found</td></tr>
                ) : (
                  filtered.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-border/30 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-foreground">{row.roll_number}</td>
                      <td className="px-6 py-4 text-foreground">{row.room}</td>
                      <td className="px-6 py-4 text-foreground">{row.block}</td>
                      <td className="px-6 py-4 text-foreground">{row.floor}</td>
                      <td className="px-6 py-4 text-muted-foreground">{getExamName(row)}</td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </AdminLayout>
  );
};

export default AdminStudents;
