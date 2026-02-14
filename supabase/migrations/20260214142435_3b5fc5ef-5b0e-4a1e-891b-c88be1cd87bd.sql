
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can insert hall_assignments" ON public.hall_assignments;
DROP POLICY IF EXISTS "Admins can update hall_assignments" ON public.hall_assignments;
DROP POLICY IF EXISTS "Admins can delete hall_assignments" ON public.hall_assignments;
DROP POLICY IF EXISTS "Anyone can view hall_assignments" ON public.hall_assignments;

CREATE POLICY "Admins can insert hall_assignments"
ON public.hall_assignments FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hall_assignments"
ON public.hall_assignments FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hall_assignments"
ON public.hall_assignments FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view hall_assignments"
ON public.hall_assignments FOR SELECT
USING (true);
