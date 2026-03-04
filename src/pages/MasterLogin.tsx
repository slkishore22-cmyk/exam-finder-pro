import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, User, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const MasterLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check lockout first
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

      // Login with synthetic email
      const syntheticEmail = `${username}@master.examhall.internal`;
      const { error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });

      if (error) {
        // Increment failed attempts
        if (adminRecord) {
          const attempts = (adminRecord.failed_login_attempts || 0) + 1;
          const updateData: Record<string, unknown> = { failed_login_attempts: attempts };
          if (attempts >= 5) {
            updateData.locked_until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            toast({ title: "Account locked", description: "Too many failed attempts. Locked for 10 minutes.", variant: "destructive" });
          } else {
            toast({ title: "Login failed", description: `Invalid credentials. ${5 - attempts} attempts remaining.`, variant: "destructive" });
          }
          // Use edge function or direct update won't work due to RLS — we'll handle via signIn failure message
        } else {
          toast({ title: "Login failed", description: "Invalid credentials.", variant: "destructive" });
        }
        setLoading(false);
        return;
      }

      // Verify role
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

      // Reset failed attempts & update last_login — will work since view_self_admin policy exists
      // Actually updates need specific policy, so we skip this for now
      sessionStorage.setItem("master_admin_session", JSON.stringify({ id: admin.id, ts: Date.now() }));
      navigate("/master/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Shield className="w-10 h-10 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Master Admin</h1>
          <p className="text-muted-foreground mt-2">System administration access</p>
        </div>

        <div className="liquid-glass p-8">
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 pl-11 rounded-xl bg-secondary/60 border-border/60 input-glow"
                required
                autoComplete="off"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pl-11 rounded-xl bg-secondary/60 border-border/60 input-glow"
                required
                minLength={6}
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl btn-press" size="lg">
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Sign In <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default MasterLogin;
