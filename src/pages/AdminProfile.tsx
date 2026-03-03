import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useAdminSession } from "@/hooks/useAdminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const AdminProfile = () => {
  const { admin, loading } = useAdminSession();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPw.length < 8) {
      toast({ title: "Minimum 8 characters required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.changePassword(currentPw, newPw);
      toast({ title: "Password changed successfully" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const backPath =
    admin?.role === "master_admin" ? "/master/dashboard" : "/admin/dashboard";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Button variant="ghost" className="mb-4" onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>

        <div className="liquid-glass p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Change Password</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {admin?.full_name} ({admin?.username})
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              placeholder="Current Password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="New Password (min 8 characters)"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
            />
            <Input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Saving..." : "Save New Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
