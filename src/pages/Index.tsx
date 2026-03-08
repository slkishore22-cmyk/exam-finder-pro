import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, BookOpen, Hash, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useHallCache, type SearchSource } from "@/hooks/useHallCache";

interface HallResult {
  roll_number: string;
  hall_number: string;
}

type PageState = "idle" | "loading" | "found" | "not_found" | "rate_limited" | "error";

const DEBOUNCE_MS = 300;

const Index = () => {
  const [rollNumber, setRollNumber] = useState("");
  const [result, setResult] = useState<HallResult | null>(null);
  const [pageState, setPageState] = useState<PageState>("idle");
  const [source, setSource] = useState<SearchSource>(null);
  const [offline, setOffline] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { search, cacheReady, cacheProgress } = useHallCache();

  // Clean up debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleSearch = useCallback(async () => {
    const roll = rollNumber.trim().toUpperCase();
    if (!roll) return;

    setPageState("loading");
    setResult(null);
    setOffline(false);

    try {
      const res = await search(roll);

      if (res.rateLimited) {
        setPageState("rate_limited");
        return;
      }

      if (res.offline && !res.result) {
        setPageState("error");
        setOffline(true);
        return;
      }

      if (res.result) {
        setResult(res.result);
        setSource(res.source);
        setOffline(!!res.offline);
        setPageState("found");
      } else {
        setPageState("not_found");
      }
    } catch {
      setPageState("error");
    }
  }, [rollNumber, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      handleSearch();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setRollNumber(val);

    // Reset state when cleared
    if (!val.trim()) {
      setPageState("idle");
      setResult(null);
      return;
    }

    // Debounced auto-search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.trim().length >= 3) handleSearch();
    }, DEBOUNCE_MS);
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

          {/* Cache preload progress */}
          {!cacheReady && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <p className="text-xs text-muted-foreground mb-2">Preparing for fast search…</p>
              <Progress value={cacheProgress} className="h-1.5 max-w-xs mx-auto" />
            </motion.div>
          )}

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
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  className="h-14 pl-12 pr-4 text-lg rounded-xl bg-secondary/60 border-border/60 input-glow placeholder:text-muted-foreground/60"
                />
              </div>

              <Button
                onClick={handleSearch}
                disabled={!rollNumber.trim() || pageState === "loading"}
                className="w-full h-14 text-base font-medium rounded-xl btn-press"
                size="lg"
              >
                {pageState === "loading" ? (
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
            {pageState === "loading" && (
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

            {pageState === "found" && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8"
              >
                <div className="liquid-glass p-8">
                  {/* Offline badge */}
                  {offline && (
                    <div className="flex justify-center mb-4">
                      <Badge variant="secondary" className="gap-1.5 text-xs">
                        <WifiOff className="w-3 h-3" /> Showing saved result
                      </Badge>
                    </div>
                  )}

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
                  <p className="text-xl font-semibold text-foreground mb-4">{result.roll_number}</p>

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
                    <p className="text-3xl font-bold text-foreground">{result.hall_number}</p>
                  </motion.div>

                  {source && !offline && (
                    <p className="text-[10px] text-muted-foreground/50 mt-4">
                      {source === "local" ? "⚡ Instant (cached)" : source === "memory" ? "⚡ Instant" : "✓ Live"}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {pageState === "not_found" && (
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
                  <p className="text-lg font-medium text-foreground mb-1">Roll number not found</p>
                  <p className="text-sm text-muted-foreground">Please contact your department.</p>
                </div>
              </motion.div>
            )}

            {pageState === "rate_limited" && (
              <motion.div
                key="ratelimit"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-8"
              >
                <div className="liquid-glass p-8 text-center">
                  <p className="text-lg font-medium text-foreground mb-1">Too many searches</p>
                  <p className="text-sm text-muted-foreground">Please wait a moment and try again.</p>
                </div>
              </motion.div>
            )}

            {pageState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-8"
              >
                <div className="liquid-glass p-8 text-center">
                  <p className="text-lg font-medium text-foreground mb-2">Something went wrong</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {offline
                      ? "Service temporarily unavailable. Please try again in a moment."
                      : "Please try again."}
                  </p>
                  <Button variant="outline" onClick={handleSearch} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Retry
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Index;
