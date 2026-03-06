import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Building2, LogIn } from "lucide-react";

const CollegeAdminLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-college-admins", {
        body: { action: "login", username: username.trim(), password },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "Login failed");
      }

      // Set session from edge function response
      if (res.data.session) {
        await supabase.auth.setSession({
          access_token: res.data.session.access_token,
          refresh_token: res.data.session.refresh_token,
        });
      }

      sessionStorage.setItem("college_admin_session", JSON.stringify({
        admin_id: res.data.admin_id,
        college_name: res.data.college_name,
      }));

      navigate("/college-admin/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="liquid-glass p-8 rounded-2xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Building2 className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">College Admin Login</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Username</label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1"
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" /> Login
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CollegeAdminLogin;
