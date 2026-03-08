
-- Drop the overly permissive anonymous read policy
DROP POLICY IF EXISTS "public_read_students" ON public.hierarchy_students;

-- Drop the overly permissive authenticated read policy  
DROP POLICY IF EXISTS "auth_read_students" ON public.hierarchy_students;

-- Add scoped read for college admins
CREATE POLICY "college_read_students" ON public.hierarchy_students
  FOR SELECT TO authenticated
  USING (college_id = get_my_college_id(auth.uid()));

-- Add scoped read for dept admins (already covered by dept policies but explicit)
CREATE POLICY "dept_read_students" ON public.hierarchy_students
  FOR SELECT TO authenticated
  USING (department_id = get_my_department_id(auth.uid()));
