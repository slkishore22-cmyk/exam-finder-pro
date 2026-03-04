import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MasterLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: adminRecord } = await supabase
        .from("hierarchy_admins")
        .select("id, locked_until, failed_login_attempts")
        .eq("username", username)
        .eq("role", "master_admin")
        .single();

      if (adminRecord?.locked_until) {
        const lockEnd = new Date(adminRecord.locked_until);
        if (lockEnd > new Date()) {
          const mins = Math.ceil((lockEnd.getTime() - Date.now()) / 60000);
          toast({ title: "Account locked", description: `Try again in ${mins} minute(s).`, variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      const syntheticEmail = `${username}@master.examhall.internal`;
      const { error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });

      if (error) {
        if (adminRecord) {
          const attempts = (adminRecord.failed_login_attempts || 0) + 1;
          if (attempts >= 5) {
            toast({ title: "Account locked", description: "Too many failed attempts. Locked for 10 minutes.", variant: "destructive" });
          } else {
            toast({ title: "Login failed", description: `Invalid credentials. ${5 - attempts} attempts remaining.`, variant: "destructive" });
          }
        } else {
          toast({ title: "Login failed", description: "Invalid credentials.", variant: "destructive" });
        }
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Auth failed");

      const { data: admin } = await supabase
        .from("hierarchy_admins")
        .select("id, role")
        .eq("user_id", user.id)
        .eq("role", "master_admin")
        .eq("is_active", true)
        .single();

      if (!admin) {
        await supabase.auth.signOut();
        toast({ title: "Access denied", description: "Not a master admin.", variant: "destructive" });
        setLoading(false);
        return;
      }

      sessionStorage.setItem("master_admin_session", JSON.stringify({ id: admin.id, ts: Date.now() }));
      navigate("/master/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 overflow-hidden relative">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/8 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo / Icon */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/25">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Master Admin</h1>
          <p className="text-sm text-white/40 mt-1">System administration portal</p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          onSubmit={handleSubmit}
          className="space-y-4"
          autoComplete="off"
        >
          <div>
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.08] transition-all duration-200 text-sm"
              placeholder="Enter username"
              required
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.08] transition-all duration-200 text-sm"
                placeholder="Enter password"
                required
                minLength={6}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.form>

        <p className="text-center text-white/20 text-xs mt-8">
          Protected system access only
        </p>
      </motion.div>
    </div>
  );
};

export default MasterLogin;
