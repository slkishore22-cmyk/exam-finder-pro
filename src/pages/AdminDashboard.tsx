import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, LogOut, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AddAssignmentDialog from "@/components/AddAssignmentDialog";

interface HallAssignment {
  id: string;
  roll_number: string;
  hall_number: string;
  created_at: string;
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [assignments, setAssignments] = useState<HallAssignment[]>([]);
  const [fetching, setFetching] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/admin/login");
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/admin/login");
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchAssignments = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("hall_assignments")
      .select("id, roll_number, hall_number, created_at")
      .order("hall_number")
      .order("roll_number");
    if (error) {
      toast({ title: "Failed to load assignments", variant: "destructive" });
    } else {
      setAssignments(data || []);
    }
    setFetching(false);
  }, [toast]);

  useEffect(() => {
    if (!loading) fetchAssignments();
  }, [loading, fetchAssignments]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from("hall_assignments").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setAssignments(prev => prev.filter(a => a.id !== id));
      toast({ title: "Assignment deleted" });
    }
    setDeleting(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
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
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Hall Assignments</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAssignments} disabled={fetching}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="border border-border rounded-xl overflow-hidden"
        >
          {assignments.length === 0 && !fetching ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No assignments yet. Click <span className="font-medium text-foreground">Add</span> to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Hall Number</TableHead>
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a, i) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium">{a.roll_number}</TableCell>
                    <TableCell>{a.hall_number}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(a.id)}
                        disabled={deleting === a.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {fetching && (
            <div className="py-8 flex justify-center">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </motion.div>

        <p className="text-xs text-muted-foreground mt-3 text-center">
          {assignments.length} total assignment{assignments.length !== 1 ? "s" : ""}
        </p>
      </div>

      <AddAssignmentDialog open={open} onOpenChange={setOpen} onSaved={fetchAssignments} />
    </div>
  );
};

export default AdminDashboard;
