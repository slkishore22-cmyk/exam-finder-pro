
CREATE TABLE public.college_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  college_name text NOT NULL,
  username text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.hierarchy_admins(id),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.college_admins ENABLE ROW LEVEL SECURITY;

-- Master admin can do everything
CREATE POLICY "master_full_college_admins" ON public.college_admins
  FOR ALL TO authenticated
  USING (get_admin_role(auth.uid()) = 'master_admin')
  WITH CHECK (get_admin_role(auth.uid()) = 'master_admin');

-- College admin can view own record
CREATE POLICY "college_admin_view_self" ON public.college_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
