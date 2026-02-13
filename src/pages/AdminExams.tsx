import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Calendar } from "lucide-react";
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

interface Exam {
  id: string;
  name: string;
  date: string;
  created_at: string;
}

const AdminExams = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("exams").select("*").order("date", { ascending: false });
    if (data) setExams(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!name || !date) return;
    const { error } = await supabase.from("exams").insert({ name, date });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Exam created" });
      setDialogOpen(false);
      setName("");
      setDate("");
      load();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setExams((e) => e.filter((ex) => ex.id !== id));
    }
  };

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Exam Manager</h1>
            <p className="text-muted-foreground">Create and manage exams</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-press rounded-xl">
                <Plus className="w-4 h-4 mr-1.5" /> Create Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Exam</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-4">
                <Input placeholder="Exam name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" />
                <Button onClick={handleAdd} className="w-full rounded-xl btn-press">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card p-6 space-y-3">
                <div className="shimmer h-5 w-2/3 rounded" />
                <div className="shimmer h-4 w-1/3 rounded" />
              </div>
            ))
          ) : exams.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No exams yet. Create one to get started.
            </div>
          ) : (
            exams.map((exam, i) => (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-6 group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{exam.name}</h3>
                    <div className="flex items-center gap-1.5 mt-2 text-muted-foreground text-sm">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(exam.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(exam.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </AdminLayout>
  );
};

export default AdminExams;
