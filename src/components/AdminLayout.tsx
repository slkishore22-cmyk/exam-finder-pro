import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, LayoutDashboard, Upload, Users, Calendar, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/upload", icon: Upload, label: "Upload CSV" },
  { to: "/admin/students", icon: Users, label: "Students" },
  { to: "/admin/exams", icon: Calendar, label: "Exams" },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/admin/login");
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/admin/login");
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <BookOpen className="w-5 h-5 text-primary" />
            Exam Room Finder
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to}>
                <Button
                  variant={location.pathname === item.to ? "secondary" : "ghost"}
                  size="sm"
                  className="btn-press hidden sm:flex items-center gap-1.5"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
                <Button
                  variant={location.pathname === item.to ? "secondary" : "ghost"}
                  size="icon"
                  className="btn-press sm:hidden"
                >
                  <item.icon className="w-4 h-4" />
                </Button>
              </Link>
            ))}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground btn-press ml-2">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
