
-- Enable RLS
ALTER TABLE public.permanent_counts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "master_full_permanent_counts" ON public.permanent_counts
  FOR ALL TO authenticated
  USING (get_admin_role(auth.uid()) = 'master_admin')
  WITH CHECK (get_admin_role(auth.uid()) = 'master_admin');

CREATE POLICY "college_view_permanent_counts" ON public.permanent_counts
  FOR SELECT TO authenticated
  USING (college_id = get_my_college_id(auth.uid()));

CREATE POLICY "anon_read_permanent_counts" ON public.permanent_counts
  FOR SELECT TO anon
  USING (true);

-- Add unique constraint on college_id if not exists
ALTER TABLE public.permanent_counts ADD CONSTRAINT permanent_counts_college_id_key UNIQUE (college_id);

-- Trigger function
CREATE OR REPLACE FUNCTION public.increment_permanent_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.permanent_counts (college_id, total_students)
  VALUES (NEW.college_id, 1)
  ON CONFLICT (college_id)
  DO UPDATE SET total_students = permanent_counts.total_students + 1;
  RETURN NEW;
END;
$$;

-- Trigger on hall_assignments insert
CREATE TRIGGER on_hall_assignment_insert
  AFTER INSERT ON public.hall_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_permanent_count();

-- Seed from existing data
INSERT INTO public.permanent_counts (college_id, total_students)
SELECT college_id, COUNT(*)::integer
FROM public.hall_assignments
WHERE college_id IS NOT NULL
GROUP BY college_id
ON CONFLICT (college_id) DO UPDATE SET total_students = EXCLUDED.total_students;
