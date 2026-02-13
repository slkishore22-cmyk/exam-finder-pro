import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/AdminLayout";
import { useToast } from "@/hooks/use-toast";

interface Exam {
  id: string;
  name: string;
  date: string;
}

const AdminUpload = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("exams").select("id, name, date").order("date", { ascending: false }).then(({ data }) => {
      if (data) setExams(data);
    });
  }, []);

  const handleUpload = async () => {
    if (!file || !selectedExam) return;
    setUploading(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const header = lines[0].toLowerCase();

      if (!header.includes("roll") || !header.includes("room")) {
        toast({ title: "Invalid CSV", description: "CSV must have columns: roll, room, block, floor", variant: "destructive" });
        setUploading(false);
        return;
      }

      const records = lines.slice(1).map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        return { roll_number: parts[0].toUpperCase(), room: parts[1], block: parts[2], floor: parts[3], exam_id: selectedExam };
      }).filter((r) => r.roll_number && r.room);

      const { data, error } = await supabase.from("seating").upsert(records, { onConflict: "roll_number,exam_id" }).select();

      if (error) throw error;
      setResult({ success: data?.length ?? 0, skipped: records.length - (data?.length ?? 0) });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground mb-2">Upload CSV</h1>
        <p className="text-muted-foreground mb-8">Upload seating data from a CSV file</p>

        <div className="glass-card p-8 max-w-xl">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Select Exam</label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-secondary/60 border border-border/60 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">Choose exam...</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} — {new Date(exam.date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">CSV File</label>
              <div
                className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-foreground">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select CSV file</p>
                    <p className="text-xs text-muted-foreground mt-1">Format: roll, room, block, floor</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || !selectedExam || uploading}
              className="w-full h-12 rounded-xl btn-press"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                "Upload & Process"
              )}
            </Button>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary success-check" />
                  <span className="font-medium text-foreground">{result.success} records uploaded successfully</span>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{result.skipped} duplicates skipped</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AdminLayout>
  );
};

export default AdminUpload;
