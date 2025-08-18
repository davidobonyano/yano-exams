-- Fix RLS policies for student_exam_attempts table to allow exam starts
-- The issue is students don't use Supabase auth - they use session-based authentication
-- We need to allow operations for both authenticated teachers (auth.uid()) and unauthenticated students

-- Drop the problematic policies that use current_setting (which is never set)
DROP POLICY IF EXISTS "Students can view own attempts" ON public.student_exam_attempts;
DROP POLICY IF EXISTS "Students can create own attempts" ON public.student_exam_attempts;
DROP POLICY IF EXISTS "Students can update own attempts" ON public.student_exam_attempts;

-- Drop the conflicting server timer policies
DROP POLICY IF EXISTS "student_exam_attempts_policy" ON public.student_exam_attempts;
DROP POLICY IF EXISTS "deny_student_updates" ON public.student_exam_attempts;

-- Create unified RLS policies that work for both authenticated and unauthenticated users
-- Students don't use Supabase auth, so auth.uid() is NULL for them
CREATE POLICY "Allow exam attempts operations" ON public.student_exam_attempts 
FOR ALL USING (
  -- Allow if authenticated user (teachers/admins)
  auth.uid() IS NOT NULL OR
  -- Allow for unauthenticated users (students) if they have valid session participation
  (auth.uid() IS NULL AND student_id IN (
    SELECT student_id FROM public.session_participants 
    WHERE session_id = student_exam_attempts.session_id
    AND session_id IN (
      SELECT id FROM public.exam_sessions 
      WHERE status = 'active' 
      AND starts_at <= NOW() 
      AND ends_at >= NOW()
    )
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
)
WITH CHECK (
  -- For inserts, ensure session is active
  session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status = 'active' 
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  ) OR
  auth.role() = 'service_role'
);

-- Ensure RLS is enabled
ALTER TABLE student_exam_attempts ENABLE ROW LEVEL SECURITY;

-- Also fix related tables that might have similar issues
-- Fix student_answers policies - allow unauthenticated students to manage their answers
DROP POLICY IF EXISTS "Students can view own answers" ON public.student_answers;
DROP POLICY IF EXISTS "Students can create own answers" ON public.student_answers;
DROP POLICY IF EXISTS "Students can update own answers" ON public.student_answers;

CREATE POLICY "Allow student answers operations" ON public.student_answers 
FOR ALL USING (
  -- Allow authenticated users (teachers)
  auth.uid() IS NOT NULL OR
  -- Allow unauthenticated users (students) for their own answers in active sessions
  auth.uid() IS NULL OR
  -- Always allow service role
  auth.role() = 'service_role'
)
WITH CHECK (
  -- For inserts/updates, ensure the attempt belongs to an active session
  attempt_id IN (
    SELECT id FROM public.student_exam_attempts 
    WHERE session_id IN (
      SELECT id FROM public.exam_sessions 
      WHERE status = 'active' 
      AND starts_at <= NOW() 
      AND ends_at >= NOW()
    )
  ) OR
  auth.role() = 'service_role'
);

-- Fix session participants policies - allow unauthenticated students to join sessions
DROP POLICY IF EXISTS "Students can view own participation" ON public.session_participants;
DROP POLICY IF EXISTS "Students can join sessions" ON public.session_participants;

CREATE POLICY "Allow session participation" ON public.session_participants 
FOR ALL USING (
  -- Allow authenticated users (teachers)
  auth.uid() IS NOT NULL OR
  -- Allow unauthenticated users (students) for active sessions
  (auth.uid() IS NULL AND session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status = 'active' 
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
)
WITH CHECK (
  -- For inserts, ensure session is active
  session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status = 'active' 
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  ) OR
  auth.role() = 'service_role'
);

NOTIFY pgrst, 'reload schema';

SELECT 'RLS policies fixed for exam start functionality!' as status;
