import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Building2, Layers, Calendar, ArrowRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

interface SeatingResult {
  roll_number: string;
  room: string;
  block: string;
  floor: string;
  exam: { name: string; date: string };
}

interface Exam {
  id: string;
  name: string;
  date: string;
}

const Index = () => {
  const [rollNumber, setRollNumber] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [result, setResult] = useState<SeatingResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [examsLoaded, setExamsLoaded] = useState(false);

  const loadExams = async () => {
    if (examsLoaded) return;
    const { data } = await supabase.from("exams").select("id, name, date").order("date", { ascending: false });
    if (data) setExams(data);
    setExamsLoaded(true);
  };

  const handleSearch = async () => {
    if (!rollNumber.trim() || !selectedExam) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);

    const { data } = await supabase
      .from("seating")
      .select("roll_number, room, block, floor, exam_id, exams(name, date)")
      .eq("roll_number", rollNumber.trim().toUpperCase())
      .eq("exam_id", selectedExam)
      .single();

    setTimeout(() => {
      if (data && data.exams) {
        const examData = Array.isArray(data.exams) ? data.exams[0] : data.exams;
        setResult({
          roll_number: data.roll_number,
          room: data.room,
          block: data.block,
          floor: data.floor,
          exam: { name: examData.name, date: examData.date },
        });
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg text-foreground">
            <BookOpen className="w-5 h-5 text-primary" />
            Exam Room Finder
          </Link>
          <Link to="/admin/login">
            <Button variant="ghost" size="sm" className="text-muted-foreground btn-press">
              Admin
            </Button>
          </Link>
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
              <span className="text-primary"> Exam Room</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-12 max-w-md mx-auto">
              Enter your roll number to instantly locate your exam seat. No more searching notice boards.
            </p>
          </motion.div>

          {/* Search Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card-elevated p-8 sm:p-10"
          >
            <div className="space-y-4">
              <div className="relative">
                <select
                  value={selectedExam}
                  onFocus={loadExams}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-secondary/60 border border-border/60 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select an exam...</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} — {new Date(exam.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

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
                disabled={!rollNumber.trim() || !selectedExam || loading}
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
                <div className="glass-card p-8 space-y-4">
                  <div className="shimmer h-6 w-1/3 mx-auto rounded-lg" />
                  <div className="shimmer h-4 w-2/3 mx-auto rounded-lg" />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="shimmer h-16 rounded-xl" />
                    <div className="shimmer h-16 rounded-xl" />
                    <div className="shimmer h-16 rounded-xl" />
                    <div className="shimmer h-16 rounded-xl" />
                  </div>
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
                <div className="glass-card-elevated p-8">
                  <div className="flex items-center justify-center mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                      className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
                    >
                      <svg className="w-6 h-6 text-primary success-check" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Roll Number</p>
                  <p className="text-xl font-semibold text-foreground mb-6">{result.roll_number}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <ResultItem icon={<MapPin className="w-4 h-4" />} label="Room" value={result.room} delay={0.1} />
                    <ResultItem icon={<Building2 className="w-4 h-4" />} label="Block" value={result.block} delay={0.2} />
                    <ResultItem icon={<Layers className="w-4 h-4" />} label="Floor" value={result.floor} delay={0.3} />
                    <ResultItem icon={<Calendar className="w-4 h-4" />} label="Date" value={new Date(result.exam.date).toLocaleDateString()} delay={0.4} />
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">{result.exam.name}</p>
                  </div>
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
                <div className="glass-card p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <Search className="w-7 h-7 text-destructive" />
                  </motion.div>
                  <p className="text-lg font-medium text-foreground mb-1">No record found</p>
                  <p className="text-sm text-muted-foreground">Please check your roll number and selected exam</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const ResultItem = ({ icon, label, value, delay }: { icon: React.ReactNode; label: string; value: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="bg-secondary/50 rounded-xl p-4 text-left"
  >
    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </motion.div>
);

export default Index;
