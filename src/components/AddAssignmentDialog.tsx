import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, CheckCircle2, CalendarClock } from "lucide-react";
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

interface AddAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const AddAssignmentDialog = ({ open, onOpenChange, onSaved }: AddAssignmentDialogProps) => {
  const [batchName, setBatchName] = useState("");
  const [hallNumber, setHallNumber] = useState("");
  const [rowCount, setRowCount] = useState("");
  const [rollNumbers, setRollNumbers] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  const resetModal = () => {
    setBatchName("");
    setHallNumber("");
    setRowCount("");
    setRollNumbers([]);
    setConfirmed(false);
    setSaved(false);
    setEnableSchedule(false);
    setScheduledAt("");
  };

  const handleConfirm = () => {
    const count = parseInt(rowCount);
    if (!batchName.trim()) {
      toast({ title: "Enter a name for this batch", variant: "destructive" });
      return;
    }
    if (!hallNumber.trim()) {
      toast({ title: "Missing hall number", variant: "destructive" });
      return;
    }
    if (isNaN(count) || count < 1 || count > 500) {
      toast({ title: "Enter a valid row count (1–500)", variant: "destructive" });
      return;
    }
    setRollNumbers(new Array(count).fill(""));
    setConfirmed(true);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const handleRollChange = useCallback((index: number, value: string) => {
    const lines = value.split(/[\n\r\t]+/).map(s => s.trim()).filter(Boolean);
    if (lines.length > 1) {
      setRollNumbers(prev => {
        const next = [...prev];
        lines.forEach((line, i) => {
          if (index + i < next.length) next[index + i] = line.toUpperCase();
        });
        return next;
      });
      setRollNumbers(prev => {
        const focusIdx = Math.min(index + lines.length, prev.length - 1);
        setTimeout(() => inputRefs.current[focusIdx]?.focus(), 0);
        return prev;
      });
    } else {
      setRollNumbers(prev => {
        const next = [...prev];
        next[index] = value.toUpperCase();
        return next;
      });
    }
  }, []);

  const handleSave = async () => {
    const filled = rollNumbers.filter(r => r.trim());
    if (filled.length === 0) {
      toast({ title: "No roll numbers entered", variant: "destructive" });
      return;
    }
    if (enableSchedule && !scheduledAt) {
      toast({ title: "Select a scheduled date/time", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    // Create the batch first
    const { data: batch, error: batchError } = await supabase
      .from("assignment_batches")
      .insert({
        name: batchName.trim(),
        created_by: user?.id,
        scheduled_at: enableSchedule ? scheduledAt : null,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      toast({ title: "Failed to create batch", description: batchError?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const rows = filled.map(roll => ({
      roll_number: roll.trim().toUpperCase(),
      hall_number: hallNumber.trim(),
      created_by: user?.id,
      batch_id: batch.id,
    }));

    const { error } = await supabase.from("hall_assignments").upsert(rows, { onConflict: "roll_number" });

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setSaved(true);
      toast({ title: `${filled.length} assignments saved` });
      onSaved();
      setTimeout(() => {
        onOpenChange(false);
        resetModal();
      }, 1200);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetModal(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Add Hall Assignment
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-5">
          <AnimatePresence mode="wait">
            {!confirmed ? (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Batch Name</label>
                  <Input
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="e.g. Semester 6 - Maths"
                    className="h-12 rounded-xl bg-secondary/40 border-border/50 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Exam Hall Number</label>
                  <Input
                    value={hallNumber}
                    onChange={(e) => setHallNumber(e.target.value)}
                    placeholder="e.g. Hall A-201"
                    className="h-12 rounded-xl bg-secondary/40 border-border/50 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">How many rows do you want?</label>
                  <Input
                    type="number"
                    value={rowCount}
                    onChange={(e) => setRowCount(e.target.value)}
                    placeholder="e.g. 10"
                    min={1}
                    max={500}
                    className="h-12 rounded-xl bg-secondary/40 border-border/50 focus-visible:ring-primary/30"
                  />
                </div>

                {/* Schedule toggle */}
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="schedule-toggle" className="text-sm font-medium cursor-pointer">Schedule upload</Label>
                  </div>
                  <Switch id="schedule-toggle" checked={enableSchedule} onCheckedChange={setEnableSchedule} />
                </div>
                {enableSchedule && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Scheduled Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="h-12 rounded-xl bg-secondary/40 border-border/50 focus-visible:ring-primary/30"
                    />
                  </motion.div>
                )}

                <Button onClick={handleConfirm} className="w-full h-12 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform">
                  Confirm
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{batchName}</span> · Hall: <span className="font-medium text-foreground">{hallNumber}</span> · {rollNumbers.length} rows
                </p>

                <div className="border border-border/50 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[3rem_1fr] text-xs font-medium text-muted-foreground bg-secondary/30 px-3 py-2">
                    <span>#</span>
                    <span>Roll Number</span>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto divide-y divide-border/30">
                    {rollNumbers.map((val, i) => (
                      <div key={i} className="grid grid-cols-[3rem_1fr] items-center px-3 py-1">
                        <span className="text-xs text-muted-foreground">{i + 1}</span>
                        <input
                          ref={(el) => { inputRefs.current[i] = el; }}
                          value={val}
                          onChange={(e) => handleRollChange(i, e.target.value)}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            const lines = text.split(/[\n\r\t]+/).map(s => s.trim()).filter(Boolean);
                            if (lines.length > 1) {
                              e.preventDefault();
                              handleRollChange(i, text);
                            }
                          }}
                          placeholder="Paste or type roll number"
                          className="w-full h-9 px-2 text-sm bg-transparent border-0 outline-none focus:ring-1 focus:ring-primary/30 rounded transition-all placeholder:text-muted-foreground/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>

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
                      <motion.span key="save">Save All</motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddAssignmentDialog;
