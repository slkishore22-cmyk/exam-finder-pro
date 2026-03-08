import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CalendarClock, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Assignment {
  id: string;
  roll_number: string;
  hall_number: string;
}

interface EditBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  batchId: string;
  initialName: string;
  initialScheduledAt: string | null;
  initialAssignments: Assignment[];
}

const EditBatchDialog = ({
  open,
  onOpenChange,
  onSaved,
  batchId,
  initialName,
  initialScheduledAt,
  initialAssignments,
}: EditBatchDialogProps) => {
  const [batchName, setBatchName] = useState(initialName);
  const [enableSchedule, setEnableSchedule] = useState(!!initialScheduledAt);
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt || "");
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [newRoll, setNewRoll] = useState("");
  const [newHall, setNewHall] = useState(initialAssignments[0]?.hall_number || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setBatchName(initialName);
      setEnableSchedule(!!initialScheduledAt);
      setScheduledAt(initialScheduledAt || "");
      setAssignments(initialAssignments);
      setNewHall(initialAssignments[0]?.hall_number || "");
      setSaved(false);
    }
  }, [open, initialName, initialScheduledAt, initialAssignments]);

  const handleDeleteAssignment = async (assignmentId: string) => {
    setDeletingIds(prev => new Set(prev).add(assignmentId));
    const { error } = await supabase.from("hall_assignments").delete().eq("id", assignmentId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    }
    setDeletingIds(prev => {
      const next = new Set(prev);
      next.delete(assignmentId);
      return next;
    });
  };

  const handleAddRow = async () => {
    if (!newRoll.trim() || !newHall.trim()) {
      toast({ title: "Enter both roll number and hall", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();

    // Get admin's department_id and college_id
    let departmentId: string | null = null;
    let collegeId: string | null = null;
    if (user) {
      const { data: adminInfo } = await supabase
        .from("hierarchy_admins")
        .select("department_id, college_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();
      if (adminInfo) {
        departmentId = adminInfo.department_id;
        collegeId = adminInfo.college_id;
      }
    }

    const { data, error } = await supabase
      .from("hall_assignments")
      .insert({
        roll_number: newRoll.trim().toUpperCase(),
        hall_number: newHall.trim(),
        batch_id: batchId,
        created_by: user?.id,
        department_id: departmentId,
        college_id: collegeId,
      } as any)
      .select("id, roll_number, hall_number")
      .single();

    if (error) {
      toast({ title: "Add failed", description: error.message, variant: "destructive" });
    } else if (data) {
      setAssignments(prev => [...prev, data]);
      setNewRoll("");
      toast({ title: "Row added" });
    }
  };

  const handleSave = async () => {
    if (!batchName.trim()) {
      toast({ title: "Batch name is required", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { error } = await supabase
      .from("assignment_batches")
      .update({
        name: batchName.trim(),
        scheduled_at: enableSchedule ? scheduledAt || null : null,
      })
      .eq("id", batchId);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      setSaved(true);
      toast({ title: "Batch updated" });
      onSaved();
      setTimeout(() => {
        onOpenChange(false);
      }, 800);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl p-0 liquid-glass border-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Edit Batch
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-5">
          {/* Batch name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Batch Name</label>
            <Input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="h-12 rounded-xl bg-secondary/40 border-border/50 focus-visible:ring-primary/30"
            />
          </div>

          {/* Schedule toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="edit-schedule-toggle" className="text-sm font-medium cursor-pointer">Schedule upload</Label>
            </div>
            <Switch id="edit-schedule-toggle" checked={enableSchedule} onCheckedChange={setEnableSchedule} />
          </div>
          {enableSchedule && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Scheduled Date & Time</label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-12 rounded-xl bg-secondary/40 border-border/50 focus-visible:ring-primary/30"
              />
            </div>
          )}

          {/* Assignments table */}
          <div className="border border-border/50 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_1fr_2.5rem] text-xs font-medium text-muted-foreground bg-secondary/30 px-3 py-2">
              <span>#</span>
              <span>Roll Number</span>
              <span>Hall</span>
              <span></span>
            </div>
            <div className="max-h-[30vh] overflow-y-auto divide-y divide-border/30">
              {assignments.map((a, i) => (
                <div key={a.id} className="grid grid-cols-[3rem_1fr_1fr_2.5rem] items-center px-3 py-2">
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{a.roll_number}</span>
                  <span className="text-sm text-muted-foreground">{a.hall_number}</span>
                  <button
                    onClick={() => handleDeleteAssignment(a.id)}
                    disabled={deletingIds.has(a.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add new row */}
          <div className="flex items-center gap-2">
            <Input
              value={newRoll}
              onChange={(e) => setNewRoll(e.target.value.toUpperCase())}
              placeholder="Roll number"
              className="h-10 rounded-lg bg-secondary/40 border-border/50 text-sm"
            />
            <Input
              value={newHall}
              onChange={(e) => setNewHall(e.target.value)}
              placeholder="Hall"
              className="h-10 rounded-lg bg-secondary/40 border-border/50 text-sm w-28"
            />
            <Button size="sm" variant="outline" onClick={handleAddRow} className="h-10 px-3">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saving || saved}
            className="w-full h-12 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            <AnimatePresence mode="wait">
              {saved ? (
                <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Saved
                </motion.span>
              ) : saving ? (
                <motion.div key="spin" className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <motion.span key="save">Save Changes</motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditBatchDialog;
