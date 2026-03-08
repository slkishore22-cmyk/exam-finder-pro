import { useState } from "react";
import { UserPlus, Shield, ShieldOff, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface StaffMember {
  id: string;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

interface StaffPanelProps {
  staff: StaffMember[];
  isDeptAdmin: boolean;
  onRefresh: () => void;
}

const StaffPanel = ({ staff, isDeptAdmin, onRefresh }: StaffPanelProps) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return;
    }
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("manage-staff", {
        body: { action: "create_staff", full_name: fullName.trim(), username: username.trim(), password },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);
      toast({ title: "Staff account created" });
      setCreateOpen(false);
      setFullName(""); setUsername(""); setPassword("");
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleToggle = async (staffId: string, currentActive: boolean) => {
    try {
      const res = await supabase.functions.invoke("manage-staff", {
        body: { action: "toggle_staff", staff_id: staffId, is_active: !currentActive },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);
      toast({ title: `Staff ${currentActive ? "deactivated" : "activated"}` });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReset = async () => {
    if (!newPassword.trim() || newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match or empty", variant: "destructive" }); return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return;
    }
    setResetting(true);
    try {
      const res = await supabase.functions.invoke("manage-staff", {
        body: { action: "reset_password", target_username: resetTarget, new_password: newPassword },
      });
      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);
      toast({ title: "Password reset successfully" });
      setResetOpen(false); setNewPassword(""); setConfirmPassword(""); setResetTarget("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setResetting(false); }
  };

  const staffOnly = staff.filter(s => s.role === "dept_staff");

  return (
    <div className="liquid-glass p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Department Team</h2>
        {isDeptAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <UserPlus className="w-4 h-4" /> Add Staff
          </Button>
        )}
      </div>

      {staff.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No team members yet.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Username</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Role</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Last Login</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
                {isDeptAdmin && <th className="text-right p-2 font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-b border-border/30 last:border-0">
                  <td className="p-2 text-foreground">{s.full_name}</td>
                  <td className="p-2 text-foreground">{s.username}</td>
                  <td className="p-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.role === "dept_admin" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {s.role === "dept_admin" ? "Admin" : "Staff"}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground text-xs">
                    {s.last_login ? new Date(s.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="p-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.is_active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {isDeptAdmin && (
                    <td className="p-2 text-right">
                      {s.role === "dept_staff" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setResetTarget(s.username); setResetOpen(true); }}>
                            <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleToggle(s.id, s.is_active)}>
                            {s.is_active ? <><ShieldOff className="w-3.5 h-3.5 mr-1" /> Deactivate</> : <><Shield className="w-3.5 h-3.5 mr-1" /> Activate</>}
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Staff Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Staff Account</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">Maximum 3 staff per department. Staff can add roll numbers and assign halls but cannot delete records or create accounts.</p>
            <div>
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. John Doe" className="mt-1" autoComplete="off" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Username</label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. john_staff" className="mt-1" autoComplete="off" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Create Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetTarget}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">New Password</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" autoComplete="off" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Confirm Password</label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="mt-1" autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={handleReset} disabled={resetting}>
              {resetting ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffPanel;
