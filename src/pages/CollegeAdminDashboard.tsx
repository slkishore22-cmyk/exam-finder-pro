import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Building2, Users, Layers } from "lucide-react";

const CollegeAdminDashboard = () => {
  const [collegeName, setCollegeName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const sessionData = sessionStorage.getItem("college_admin_session");
    if (!sessionData) {
      navigate("/college-admin");
      return;
    }
    const parsed = JSON.parse(sessionData);
    setCollegeName(parsed.college_name || "College");
  }, [navigate]);

  // Inactivity timeout (2 hours)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.removeItem("college_admin_session");
        navigate("/college-admin");
      }, 2 * 60 * 60 * 1000);
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem("college_admin_session");
    navigate("/college-admin");
  };

  if (!collegeName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{collegeName} - Super Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-1.5" /> Sign out
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="liquid-glass p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Departments</p>
              <p className="text-3xl font-bold text-foreground">0</p>
            </div>
          </div>
          <div className="liquid-glass p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-3xl font-bold text-foreground">0</p>
            </div>
          </div>
        </div>

        <div className="liquid-glass p-6 mt-8 text-center">
          <p className="text-muted-foreground text-sm">More features will be added here soon.</p>
        </div>
      </div>
    </div>
  );
};

export default CollegeAdminDashboard;
