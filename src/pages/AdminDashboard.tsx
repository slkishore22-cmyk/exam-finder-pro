import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LogOut, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [hallNumber, setHallNumber] = useState("");
  const [rowCount, setRowCount] = useState("");
  const [rollNumbers, setRollNumbers] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
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

  const handleConfirm = () => {
    const count = parseInt(rowCount);
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
    // Support pasting multiple lines from Excel
    const lines = value.split(/[\n\r\t]+/).map(s => s.trim()).filter(Boolean);
    if (lines.length > 1) {
      setRollNumbers(prev => {
        const next = [...prev];
        lines.forEach((line, i) => {
          if (index + i < next.length) next[index + i] = line.toUpperCase();
        });
        return next;
      });
      const focusIdx = Math.min(index + lines.length, rollNumbers.length - 1);
      setTimeout(() => inputRefs.current[focusIdx]?.focus(), 0);
    } else {
      setRollNumbers(prev => {
        const next = [...prev];
        next[index] = value.toUpperCase();
        return next;
      });
    }
  }, [rollNumbers.length]);

  const handleSave = async () => {
    const filled = rollNumbers.filter(r => r.trim());
    if (filled.length === 0) {
      toast({ title: "No roll numbers entered", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const rows = filled.map(roll => ({
      roll_number: roll.trim().toUpperCase(),
      hall_number: hallNumber.trim(),
      created_by: user?.id,
    }));

    const { error } = await supabase.from("hall_assignments").upsert(rows, { onConflict: "roll_number" });

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setSaved(true);
      toast({ title: `${filled.length} assignments saved` });
      setTimeout(() => {
        setOpen(false);
        resetModal();
      }, 1200);
    }
    setSaving(false);
  };

  const resetModal = () => {
    setHallNumber("");
    setRowCount("");
    setRollNumbers([]);
    setConfirmed(false);
    setSaved(false);
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Logout */}
      <div className="fixed top-6 right-6">
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
          <LogOut className="w-4 h-4 mr-1.5" />
          Sign out
        </Button>
      </div>

      {/* ADD Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Button
          onClick={() => { resetModal(); setOpen(true); }}
          className="h-14 px-10 rounded-2xl text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          ADD
        </Button>
      </motion.div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetModal(); setOpen(v); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Add Hall Assignment
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 pt-4 space-y-5">
            {/* Setup fields */}
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
                    Hall: <span className="font-medium text-foreground">{hallNumber}</span> · {rollNumbers.length} rows
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
    </div>
  );
};

export default AdminDashboard;
