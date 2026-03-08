
ALTER TABLE public.hall_assignments 
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id),
ADD COLUMN IF NOT EXISTS college_id uuid REFERENCES public.colleges(id);

ALTER TABLE public.assignment_batches 
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id),
ADD COLUMN IF NOT EXISTS college_id uuid REFERENCES public.colleges(id);
