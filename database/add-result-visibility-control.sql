-- Add result visibility control
-- This allows teachers to control when students can see their results

-- Add results_visible column to exam_results table
ALTER TABLE public.exam_results 
ADD COLUMN results_visible_to_student BOOLEAN DEFAULT FALSE,
ADD COLUMN teacher_can_email_results BOOLEAN DEFAULT TRUE,
ADD COLUMN results_released_at TIMESTAMP WITH TIME ZONE;

-- Add results_visible column to exam_sessions table  
ALTER TABLE public.exam_sessions
ADD COLUMN allow_student_results_view BOOLEAN DEFAULT FALSE;

-- Create a function for teachers to release results to students
CREATE OR REPLACE FUNCTION release_results_to_students(session_id_param UUID)
RETURNS VOID AS $$
BEGIN
  -- Update all exam results for this session to be visible to students
  UPDATE public.exam_results 
  SET 
    results_visible_to_student = TRUE,
    results_released_at = NOW()
  WHERE session_id = session_id_param;

  -- Update the session to allow student results viewing
  UPDATE public.exam_sessions
  SET allow_student_results_view = TRUE
  WHERE id = session_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create a function for teachers to hide results from students
CREATE OR REPLACE FUNCTION hide_results_from_students(session_id_param UUID)
RETURNS VOID AS $$
BEGIN
  -- Update all exam results for this session to be hidden from students
  UPDATE public.exam_results 
  SET 
    results_visible_to_student = FALSE,
    results_released_at = NULL
  WHERE session_id = session_id_param;

  -- Update the session to disallow student results viewing
  UPDATE public.exam_sessions
  SET allow_student_results_view = FALSE
  WHERE id = session_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create table for email logs
CREATE TABLE public.result_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id UUID REFERENCES public.exam_results(id) ON DELETE CASCADE NOT NULL,
  student_email TEXT NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  email_status TEXT DEFAULT 'pending', -- pending, sent, failed
  email_provider TEXT DEFAULT 'smtp', -- smtp, sendgrid, etc
  error_message TEXT
);

-- Update RLS policies for exam_results to restrict student access
DROP POLICY IF EXISTS "Students can view exam results" ON public.exam_results;
CREATE POLICY "Students can view released results only" ON public.exam_results
  FOR SELECT USING (
    results_visible_to_student = TRUE AND
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.student_id = exam_results.student_id 
      AND sp.session_id = exam_results.session_id
      AND sp.is_active = true
    )
  );

-- Teachers can always view and manage results
CREATE POLICY "Teachers can manage all exam results" ON public.exam_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      WHERE es.id = exam_results.session_id 
      AND es.teacher_id = auth.uid()
    )
  );

-- RLS for result_emails table
ALTER TABLE public.result_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage email logs" ON public.result_emails
  FOR ALL USING (auth.uid() = teacher_id);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION release_results_to_students TO authenticated;
GRANT EXECUTE ON FUNCTION hide_results_from_students TO authenticated;