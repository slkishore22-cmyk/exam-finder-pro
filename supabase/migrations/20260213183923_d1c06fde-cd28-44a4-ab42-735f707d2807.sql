
CREATE TABLE public.hall_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text NOT NULL,
  hall_number text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(roll_number)
);

ALTER TABLE public.hall_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert hall_assignments"
ON public.hall_assignments FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hall_assignments"
ON public.hall_assignments FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hall_assignments"
ON public.hall_assignments FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view hall_assignments"
ON public.hall_assignments FOR SELECT
USING (true);
