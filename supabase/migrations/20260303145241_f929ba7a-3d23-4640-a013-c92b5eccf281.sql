
-- Colleges
CREATE TABLE public.colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

-- Hierarchy Admins
CREATE TABLE public.hierarchy_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id uuid REFERENCES public.colleges(id) ON DELETE CASCADE,
  department_id uuid,
  full_name text NOT NULL,
  username text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('master_admin', 'college_super_admin', 'dept_admin', 'dept_staff')),
  is_active boolean DEFAULT true,
  created_by uuid,
  last_login timestamptz,
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.hierarchy_admins ENABLE ROW LEVEL SECURITY;

-- Departments
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  department_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.hierarchy_admins(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Add FKs to hierarchy_admins
ALTER TABLE public.hierarchy_admins
  ADD CONSTRAINT hierarchy_admins_department_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.hierarchy_admins
  ADD CONSTRAINT hierarchy_admins_created_by_fk FOREIGN KEY (created_by) REFERENCES public.hierarchy_admins(id);

-- Hierarchy Students
CREATE TABLE public.hierarchy_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  roll_number text NOT NULL,
  hall_number text,
  seat_number text,
  is_assigned boolean DEFAULT false,
  created_by uuid REFERENCES public.hierarchy_admins(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.hierarchy_students ENABLE ROW LEVEL SECURITY;

-- Activity Logs
CREATE TABLE public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.hierarchy_admins(id) ON DELETE SET NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Staff Count Tracker
CREATE TABLE public.staff_count_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL UNIQUE REFERENCES public.departments(id) ON DELETE CASCADE,
  current_staff_count integer DEFAULT 0,
  max_staff_count integer DEFAULT 3
);
ALTER TABLE public.staff_count_tracker ENABLE ROW LEVEL SECURITY;

-- Security definer helper functions
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.hierarchy_admins WHERE user_id = _user_id AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_college_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT college_id FROM public.hierarchy_admins WHERE user_id = _user_id AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_department_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.hierarchy_admins WHERE user_id = _user_id AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.hierarchy_admins WHERE user_id = _user_id AND is_active = true LIMIT 1;
$$;

-- ===== RLS POLICIES =====

-- Colleges
CREATE POLICY "master_full_colleges" ON public.colleges FOR ALL TO authenticated
  USING (public.get_admin_role(auth.uid()) = 'master_admin')
  WITH CHECK (public.get_admin_role(auth.uid()) = 'master_admin');
CREATE POLICY "college_admin_view_own" ON public.colleges FOR SELECT TO authenticated
  USING (id = public.get_my_college_id(auth.uid()));

-- Hierarchy Admins
CREATE POLICY "view_self_admin" ON public.hierarchy_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "master_full_admins" ON public.hierarchy_admins FOR ALL TO authenticated
  USING (public.get_admin_role(auth.uid()) = 'master_admin')
  WITH CHECK (public.get_admin_role(auth.uid()) = 'master_admin');
CREATE POLICY "college_admin_view_subs" ON public.hierarchy_admins FOR SELECT TO authenticated
  USING (college_id = public.get_my_college_id(auth.uid()) AND public.get_admin_role(auth.uid()) = 'college_super_admin');
CREATE POLICY "dept_admin_view_staff" ON public.hierarchy_admins FOR SELECT TO authenticated
  USING (department_id = public.get_my_department_id(auth.uid()) AND public.get_admin_role(auth.uid()) = 'dept_admin');

-- Departments
CREATE POLICY "master_full_depts" ON public.departments FOR ALL TO authenticated
  USING (public.get_admin_role(auth.uid()) = 'master_admin')
  WITH CHECK (public.get_admin_role(auth.uid()) = 'master_admin');
CREATE POLICY "college_admin_manage_depts" ON public.departments FOR ALL TO authenticated
  USING (college_id = public.get_my_college_id(auth.uid()) AND public.get_admin_role(auth.uid()) = 'college_super_admin')
  WITH CHECK (college_id = public.get_my_college_id(auth.uid()) AND public.get_admin_role(auth.uid()) = 'college_super_admin');
CREATE POLICY "dept_view_own" ON public.departments FOR SELECT TO authenticated
  USING (id = public.get_my_department_id(auth.uid()));

-- Hierarchy Students
CREATE POLICY "public_read_students" ON public.hierarchy_students FOR SELECT TO anon USING (true);
CREATE POLICY "auth_read_students" ON public.hierarchy_students FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept_insert_students" ON public.hierarchy_students FOR INSERT TO authenticated
  WITH CHECK (department_id = public.get_my_department_id(auth.uid()));
CREATE POLICY "dept_update_students" ON public.hierarchy_students FOR UPDATE TO authenticated
  USING (department_id = public.get_my_department_id(auth.uid()));
CREATE POLICY "master_full_students" ON public.hierarchy_students FOR ALL TO authenticated
  USING (public.get_admin_role(auth.uid()) = 'master_admin')
  WITH CHECK (public.get_admin_role(auth.uid()) = 'master_admin');

-- Activity Logs
CREATE POLICY "insert_logs" ON public.admin_activity_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "master_view_logs" ON public.admin_activity_logs FOR SELECT TO authenticated
  USING (public.get_admin_role(auth.uid()) = 'master_admin');
CREATE POLICY "own_view_logs" ON public.admin_activity_logs FOR SELECT TO authenticated
  USING (admin_id = public.get_my_admin_id(auth.uid()));

-- Staff Count Tracker
CREATE POLICY "dept_manage_tracker" ON public.staff_count_tracker FOR ALL TO authenticated
  USING (department_id = public.get_my_department_id(auth.uid()))
  WITH CHECK (department_id = public.get_my_department_id(auth.uid()));
CREATE POLICY "master_full_tracker" ON public.staff_count_tracker FOR ALL TO authenticated
  USING (public.get_admin_role(auth.uid()) = 'master_admin')
  WITH CHECK (public.get_admin_role(auth.uid()) = 'master_admin');
CREATE POLICY "college_view_tracker" ON public.staff_count_tracker FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.college_id = public.get_my_college_id(auth.uid())));
