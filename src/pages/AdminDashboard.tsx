import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Calendar, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ exams: 0, students: 0 });

  useEffect(() => {
    const load = async () => {
      const [exams, students] = await Promise.all([
        supabase.from("exams").select("id", { count: "exact", head: true }),
        supabase.from("seating").select("id", { count: "exact", head: true }),
      ]);
      setStats({ exams: exams.count ?? 0, students: students.count ?? 0 });
    };
    load();
  }, []);

  const cards = [
    { icon: Calendar, label: "Total Exams", value: stats.exams, color: "text-primary" },
    { icon: Users, label: "Student Records", value: stats.students, color: "text-primary" },
    { icon: FileSpreadsheet, label: "Active System", value: "Online", color: "text-green-500" },
  ];

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground mb-8">Overview of your exam management system</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6"
            >
              <card.icon className={`w-8 h-8 ${card.color} mb-3`} />
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-3xl font-bold text-foreground mt-1">{card.value}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AdminLayout>
  );
};

export default AdminDashboard;
