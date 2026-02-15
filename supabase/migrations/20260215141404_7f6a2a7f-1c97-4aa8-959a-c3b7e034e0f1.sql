
-- Create assignment_batches table
CREATE TABLE public.assignment_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  scheduled_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.assignment_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view batches" ON public.assignment_batches FOR SELECT USING (true);
CREATE POLICY "Admins can insert batches" ON public.assignment_batches FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update batches" ON public.assignment_batches FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete batches" ON public.assignment_batches FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add batch_id to hall_assignments
ALTER TABLE public.hall_assignments ADD COLUMN batch_id UUID REFERENCES public.assignment_batches(id) ON DELETE CASCADE;
