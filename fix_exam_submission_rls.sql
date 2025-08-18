-- Fix RLS policies for exam submission functionality
-- The submission process involves multiple tables and operations that need to work for unauthenticated students

-- 1. Fix questions table access - students need to read questions during answer validation
DROP POLICY IF EXISTS "View questions during active sessions" ON public.questions;
DROP POLICY IF EXISTS "Allow questions access during exams" ON public.questions;

CREATE POLICY "Allow questions access during exams" ON public.questions 
FOR SELECT USING (
  -- Allow authenticated users (teachers)
  auth.uid() IS NOT NULL OR
  -- Allow unauthenticated users (students) to read questions for their active exam attempts
  (auth.uid() IS NULL AND exam_id IN (
    SELECT exam_id FROM public.student_exam_attempts 
    WHERE session_id IN (
      SELECT id FROM public.exam_sessions 
      WHERE status = 'active' 
      AND starts_at <= NOW() 
      AND ends_at >= NOW()
    )
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
);

-- 2. Fix exam_results table access - needed for score calculation and results display
-- IMPORTANT: Respect teacher's show_results_after_submit setting for student visibility
DROP POLICY IF EXISTS "Students can view own results" ON public.exam_results;
DROP POLICY IF EXISTS "Allow exam results operations with visibility control" ON public.exam_results;

CREATE POLICY "Allow exam results operations with visibility control" ON public.exam_results 
FOR SELECT USING (
  -- Always allow authenticated users (teachers/admins) to view all results
  auth.uid() IS NOT NULL OR
  -- For unauthenticated users (students), only allow if show_results_after_submit is enabled
  (auth.uid() IS NULL AND attempt_id IN (
    SELECT sea.id FROM public.student_exam_attempts sea
    JOIN public.exam_sessions es ON sea.session_id = es.id
    WHERE es.show_results_after_submit = true
    AND es.status IN ('active', 'ended')
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
);

-- Allow inserts/updates for score calculation (doesn't affect student visibility)
DROP POLICY IF EXISTS "Allow exam results inserts for scoring" ON public.exam_results;

CREATE POLICY "Allow exam results inserts for scoring" ON public.exam_results 
FOR INSERT WITH CHECK (
  -- Allow system to insert results during score calculation
  student_id IN (
    SELECT student_id FROM public.student_exam_attempts 
    WHERE session_id IN (
      SELECT id FROM public.exam_sessions 
      WHERE status IN ('active', 'ended')
    )
  ) OR
  auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Allow exam results updates" ON public.exam_results;

CREATE POLICY "Allow exam results updates" ON public.exam_results 
FOR UPDATE USING (
  -- Allow authenticated users and service role to update
  auth.uid() IS NOT NULL OR 
  auth.role() = 'service_role'
);

-- 3. Fix exams table access - students need to read exam details during submission
DROP POLICY IF EXISTS "View exams through valid sessions" ON public.exams;
DROP POLICY IF EXISTS "Allow exam access during sessions" ON public.exams;

CREATE POLICY "Allow exam access during sessions" ON public.exams 
FOR SELECT USING (
  -- Allow authenticated users (teachers)
  auth.uid() IS NOT NULL OR
  -- Allow unauthenticated users (students) to read exams for active or recently ended sessions
  (auth.uid() IS NULL AND id IN (
    SELECT exam_id FROM public.exam_sessions 
    WHERE status IN ('active', 'ended')
    AND starts_at <= NOW() 
    AND ends_at >= (NOW() - INTERVAL '1 hour')  -- Allow 1 hour grace period after session ends
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
);

-- 4. Update existing student_exam_attempts policy to allow more operations
-- The current policy might be too restrictive for submission operations
DROP POLICY IF EXISTS "Allow exam attempts operations" ON public.student_exam_attempts;
DROP POLICY IF EXISTS "Allow comprehensive exam attempts operations" ON public.student_exam_attempts;

CREATE POLICY "Allow comprehensive exam attempts operations" ON public.student_exam_attempts 
FOR ALL USING (
  -- Allow authenticated users (teachers)
  auth.uid() IS NOT NULL OR
  -- Allow unauthenticated users (students) for their attempts in active/recently ended sessions
  (auth.uid() IS NULL AND session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status IN ('active', 'ended')
    AND starts_at <= NOW() 
    AND ends_at >= (NOW() - INTERVAL '1 hour')  -- Grace period for submission
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
)
WITH CHECK (
  -- For inserts/updates, ensure session is valid
  session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status IN ('active', 'ended')
    AND starts_at <= NOW() 
    AND ends_at >= (NOW() - INTERVAL '1 hour')
  ) OR
  auth.role() = 'service_role'
);

-- 5. Update student_answers policy to be more permissive during submission
DROP POLICY IF EXISTS "Allow student answers operations" ON public.student_answers;
DROP POLICY IF EXISTS "Allow comprehensive student answers operations" ON public.student_answers;

CREATE POLICY "Allow comprehensive student answers operations" ON public.student_answers 
FOR ALL USING (
  -- Allow authenticated users (teachers)
  auth.uid() IS NOT NULL OR
  -- Allow unauthenticated users (students) for answers in active/recently ended sessions
  (auth.uid() IS NULL AND attempt_id IN (
    SELECT id FROM public.student_exam_attempts 
    WHERE session_id IN (
      SELECT id FROM public.exam_sessions 
      WHERE status IN ('active', 'ended')
      AND starts_at <= NOW() 
      AND ends_at >= (NOW() - INTERVAL '1 hour')
    )
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
)
WITH CHECK (
  -- For inserts/updates, ensure it's for a valid attempt in an active/ended session
  attempt_id IN (
    SELECT id FROM public.student_exam_attempts 
    WHERE session_id IN (
      SELECT id FROM public.exam_sessions 
      WHERE status IN ('active', 'ended')
      AND starts_at <= NOW() 
      AND ends_at >= (NOW() - INTERVAL '1 hour')
    )
  ) OR
  auth.role() = 'service_role'
);

-- 6. Fix session participants policy for submission period
DROP POLICY IF EXISTS "Allow session participation" ON public.session_participants;
DROP POLICY IF EXISTS "Allow comprehensive session participation" ON public.session_participants;

CREATE POLICY "Allow comprehensive session participation" ON public.session_participants 
FOR ALL USING (
  -- Allow authenticated users (teachers)
  auth.uid() IS NOT NULL OR
  -- Allow unauthenticated users (students) for active/recently ended sessions
  (auth.uid() IS NULL AND session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status IN ('active', 'ended')
    AND starts_at <= NOW() 
    AND ends_at >= (NOW() - INTERVAL '1 hour')
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
)
WITH CHECK (
  -- For inserts, ensure session is valid
  session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status IN ('active', 'ended')
    AND starts_at <= NOW() 
    AND ends_at >= (NOW() - INTERVAL '1 hour')
  ) OR
  auth.role() = 'service_role'
);

-- 7. Ensure all RLS is properly enabled on affected tables
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- 8. Grant necessary permissions for stored procedures and functions
-- This ensures calculate_exam_score and other functions work properly
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Special policy for email system to access exam results
DROP POLICY IF EXISTS "Allow email system access to results" ON public.exam_results;

CREATE POLICY "Allow email system access to results" ON public.exam_results 
FOR ALL USING (
  -- Always allow service role (for email system)
  auth.role() = 'service_role' OR
  -- Allow authenticated users (teachers/admins)
  auth.uid() IS NOT NULL
);

-- Ensure the email system can access student data
DROP POLICY IF EXISTS "Allow email system access to students" ON public.students;

CREATE POLICY "Allow email system access to students" ON public.students 
FOR SELECT USING (
  -- Always allow service role (for email system)
  auth.role() = 'service_role' OR
  -- Allow authenticated users
  auth.uid() IS NOT NULL
);

-- 8. Ensure exam_sessions table allows reading show_results_after_submit setting
-- Students need to read this field to know if they should see results
DROP POLICY IF EXISTS "View active exam sessions" ON public.exam_sessions;
DROP POLICY IF EXISTS "Allow exam sessions access for students" ON public.exam_sessions;

CREATE POLICY "Allow exam sessions access for students" ON public.exam_sessions 
FOR SELECT USING (
  -- Allow authenticated users (teachers) to see all sessions
  auth.uid() IS NOT NULL OR
  -- Allow unauthenticated users (students) to read sessions they're participating in
  (auth.uid() IS NULL AND (
    status IN ('active', 'ended') AND 
    starts_at <= NOW() AND 
    ends_at >= (NOW() - INTERVAL '1 hour')  -- Grace period for post-submission
  )) OR
  -- Always allow service role
  auth.role() = 'service_role'
);

-- Allow teachers to create and update sessions (for the show_results toggle)
DROP POLICY IF EXISTS "Allow teachers to manage sessions" ON public.exam_sessions;

CREATE POLICY "Allow teachers to manage sessions" ON public.exam_sessions 
FOR ALL TO authenticated 
USING (
  auth.uid() IS NOT NULL AND 
  (teacher_id = auth.uid() OR teacher_id IS NULL)
)
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Allow service role full access to sessions
DROP POLICY IF EXISTS "Service role sessions access" ON public.exam_sessions;

CREATE POLICY "Service role sessions access" ON public.exam_sessions 
FOR ALL TO service_role 
USING (true)
WITH CHECK (true);

-- 9. Ensure exam_sessions RLS is enabled
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

SELECT 'RLS policies fixed for complete exam submission functionality while preserving show/hide results controls!' as status;
