import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, BookOpen, Hash, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HallResult {
  roll_number: string;
  hall_number: string;
  seat_number: string | null;
}

const Index = () => {
  const [rollNumber, setRollNumber] = useState("");
  const [result, setResult] = useState<HallResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notAssigned, setNotAssigned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!rollNumber.trim()) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);
    setNotAssigned(false);

    const rn = rollNumber.trim().toUpperCase();

    // Search new hierarchy_students table
    const { data } = await (supabase as any)
      .from("hierarchy_students")
      .select("roll_number, hall_number, seat_number, is_assigned")
      .eq("roll_number", rn)
      .maybeSingle();

    if (data) {
      if (data.is_assigned) {
        setResult({
          roll_number: data.roll_number,
          hall_number: data.hall_number,
          seat_number: data.seat_number,
        });
      } else {
        setNotAssigned(true);
      }
    } else {
      // Fallback to legacy hall_assignments table
      const { data: oldData } = await supabase
        .from("hall_assignments")
        .select("roll_number, hall_number")
        .eq("roll_number", rn)
        .maybeSingle();

      if (oldData) {
        setResult({
          roll_number: oldData.roll_number,
          hall_number: oldData.hall_number,
          seat_number: null,
        });
      } else {
        setNotFound(true);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 liquid-glass rounded-none border-0 border-b border-border/20">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-center">
          <div className="flex items-center gap-2 font-semibold text-lg text-foreground">
            <BookOpen className="w-5 h-5 text-primary" />
            Exam Room Finder
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground mb-4">
              Find Your
              <span className="text-primary"> Exam Hall</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-12 max-w-md mx-auto">
              Enter your roll number to instantly find your assigned exam hall.
            </p>
          </motion.div>

          {/* Search Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="liquid-glass p-8 sm:p-10"
          >
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter your roll number"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="h-14 pl-12 pr-4 text-lg rounded-xl bg-secondary/60 border-border/60 input-glow placeholder:text-muted-foreground/60"
                />
              </div>

              <Button
                onClick={handleSearch}
                disabled={!rollNumber.trim() || loading}
                className="w-full h-14 text-base font-medium rounded-xl btn-press"
                size="lg"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Searching...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Search <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Results */}
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-8"
              >
                <div className="liquid-glass p-8 space-y-4">
                  <div className="shimmer h-6 w-1/3 mx-auto rounded-lg" />
                  <div className="shimmer h-4 w-2/3 mx-auto rounded-lg" />
                </div>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8"
              >
                <div className="liquid-glass p-8">
                  <div className="flex items-center justify-center mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                      className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
                    >
                      <svg
                        className="w-6 h-6 text-primary success-check"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Roll Number</p>
                  <p className="text-xl font-semibold text-foreground mb-4">
                    {result.roll_number}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="bg-secondary/50 rounded-xl p-6 text-center"
                    >
                      <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-2">
                        <Hash className="w-4 h-4" />
                        <span className="text-xs font-medium">Exam Hall</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {result.hall_number}
                      </p>
                    </motion.div>

                    {result.seat_number && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.4 }}
                        className="bg-secondary/50 rounded-xl p-6 text-center"
                      >
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-2">
                          <MapPin className="w-4 h-4" />
                          <span className="text-xs font-medium">Seat Number</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                          {result.seat_number}
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {notAssigned && !loading && (
              <motion.div
                key="notassigned"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-8"
              >
                <div className="liquid-glass p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <Clock className="w-7 h-7 text-yellow-600" />
                  </motion.div>
                  <p className="text-lg font-medium text-foreground mb-1">
                    Hall not yet assigned
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please check back later.
                  </p>
                </div>
              </motion.div>
            )}

            {notFound && !loading && (
              <motion.div
                key="notfound"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-8"
              >
                <div className="liquid-glass p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <Search className="w-7 h-7 text-destructive" />
                  </motion.div>
                  <p className="text-lg font-medium text-foreground mb-1">
                    Roll number not found
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please contact your department.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

// Need Clock import for the not-assigned state
import { Clock } from "lucide-react";

export default Index;
