import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import AddAssignmentDialog from "@/components/AddAssignmentDialog";
import BatchCard from "@/components/BatchCard";

interface HallAssignment {
  id: string;
  roll_number: string;
  hall_number: string;
  batch_id: string | null;
}

interface Batch {
  id: string;
  name: string;
  scheduled_at: string | null;
  created_at: string;
}

interface GroupedBatch extends Batch {
  assignments: HallAssignment[];
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<GroupedBatch[]>([]);
  const [fetching, setFetching] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
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

  const fetchData = useCallback(async () => {
    setFetching(true);
    const [batchRes, assignRes] = await Promise.all([
      supabase.from("assignment_batches").select("id, name, scheduled_at, created_at").order("created_at", { ascending: false }),
      supabase.from("hall_assignments").select("id, roll_number, hall_number, batch_id").order("roll_number"),
    ]);

    if (batchRes.error || assignRes.error) {
      toast({ title: "Failed to load data", variant: "destructive" });
    } else {
      const batchList = batchRes.data || [];
      const assignList = assignRes.data || [];
      const grouped: GroupedBatch[] = batchList.map(b => ({
        ...b,
        assignments: assignList.filter(a => a.batch_id === b.id),
      }));
      setBatches(grouped);
    }
    setFetching(false);
  }, [toast]);

  useEffect(() => {
    if (!loading) fetchData();
  }, [loading, fetchData]);

  const handleDeleteBatch = async (batchId: string) => {
    setDeletingBatch(batchId);
    // Deleting batch cascades to assignments
    const { error } = await supabase.from("assignment_batches").delete().eq("id", batchId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setBatches(prev => prev.filter(b => b.id !== batchId));
      toast({ title: "Batch deleted" });
    }
    setDeletingBatch(null);
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Hall Assignments</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={fetching}>
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

        {/* Batch grid */}
        {batches.length === 0 && !fetching ? (
          <div className="py-16 text-center text-muted-foreground text-sm border border-border rounded-xl">
            No batches yet. Click <span className="font-medium text-foreground">Add</span> to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {batches.map(b => (
              <BatchCard
                key={b.id}
                batchId={b.id}
                name={b.name}
                scheduledAt={b.scheduled_at}
                assignments={b.assignments}
                onDeleteBatch={handleDeleteBatch}
                deleting={deletingBatch === b.id}
              />
            ))}
          </div>
        )}

        {fetching && (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3 text-center">
          {batches.length} batch{batches.length !== 1 ? "es" : ""} · {batches.reduce((s, b) => s + b.assignments.length, 0)} total assignments
        </p>
      </div>

      <AddAssignmentDialog open={open} onOpenChange={setOpen} onSaved={fetchData} />
    </div>
  );
};

export default AdminDashboard;
