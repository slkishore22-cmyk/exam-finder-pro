import { useAdminSession } from "@/hooks/useAdminSession";
import CollegeAdminDashboard from "@/components/admin/CollegeAdminDashboard";
import DeptAdminDashboard from "@/components/admin/DeptAdminDashboard";
import StaffDashboard from "@/components/admin/StaffDashboard";

const AdminDashboard = () => {
  const { admin, loading, logout } = useAdminSession([
    "college_super_admin",
    "dept_admin",
    "dept_staff",
  ]);

  if (loading || !admin)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );

  switch (admin.role) {
    case "college_super_admin":
      return <CollegeAdminDashboard admin={admin} onLogout={logout} />;
    case "dept_admin":
      return <DeptAdminDashboard admin={admin} onLogout={logout} />;
    case "dept_staff":
      return <StaffDashboard admin={admin} onLogout={logout} />;
    default:
      return null;
  }
};

export default AdminDashboard;
