import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const AdminDashboard = () => {
  const [rollNumber, setRollNumber] = useState("");
  const [hallNumber, setHallNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const handleSave = async () => {
    if (!rollNumber.trim() || !hallNumber.trim()) {
      toast({ title: "Missing fields", description: "Please fill in both fields.", variant: "destructive" });
      return;
    }

    setSaving(true);
    setSaved(false);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("hall_assignments").upsert(
      { roll_number: rollNumber.trim().toUpperCase(), hall_number: hallNumber.trim(), created_by: user?.id },
      { onConflict: "roll_number" }
    );

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setSaved(true);
      setTimeout(() => {
        setRollNumber("");
        setHallNumber("");
        setSaved(false);
      }, 1500);
    }
    setSaving(false);
  };

  const handleClear = () => {
    setRollNumber("");
    setHallNumber("");
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logout */}
      <div className="fixed top-6 right-6">
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground btn-press">
          <LogOut className="w-4 h-4 mr-1.5" />
          Sign out
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Assign exam hall to student</p>
        </div>

        <div className="glass-card p-8 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Roll Number</label>
            <Input
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. 21CS101"
              className="h-12 rounded-xl bg-secondary/40 border-border/50 focus-visible:ring-primary/30 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Exam Hall Number</label>
            <Input
              value={hallNumber}
              onChange={(e) => setHallNumber(e.target.value)}
              placeholder="e.g. Hall A-201"
              className="h-12 rounded-xl bg-secondary/40 border-border/50 focus-visible:ring-primary/30 transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || saved}
              className="flex-1 h-12 rounded-xl btn-press text-sm font-medium"
            >
              <AnimatePresence mode="wait">
                {saved ? (
                  <motion.span
                    key="done"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </motion.span>
                ) : saving ? (
                  <motion.div
                    key="spin"
                    className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"
                  />
                ) : (
                  <motion.span key="save">Save</motion.span>
                )}
              </AnimatePresence>
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              className="h-12 rounded-xl px-6 btn-press text-sm"
            >
              Clear
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
