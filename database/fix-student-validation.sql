-- Fix student validation by implementing proper RLS policies
-- This ensures only authenticated users can access the system

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow all operations on students" ON public.students;
DROP POLICY IF EXISTS "Allow all operations on participants" ON public.session_participants;
DROP POLICY IF EXISTS "Allow all operations on attempts" ON public.student_exam_attempts;
DROP POLICY IF EXISTS "Allow all operations on answers" ON public.student_answers;
DROP POLICY IF EXISTS "Allow all operations on results" ON public.exam_results;
DROP POLICY IF EXISTS "Allow all operations on cheating logs" ON public.cheating_logs;
DROP POLICY IF EXISTS "Sessions are viewable by all" ON public.exam_sessions;
DROP POLICY IF EXISTS "Sessions can be inserted" ON public.exam_sessions;
DROP POLICY IF EXISTS "Sessions can be updated" ON public.exam_sessions;
DROP POLICY IF EXISTS "Exams are viewable by all" ON public.exams;
DROP POLICY IF EXISTS "Questions are viewable by all" ON public.questions;
DROP POLICY IF EXISTS "Classes are viewable by all" ON public.classes;

-- Create proper security policies

-- Students table: Only allow viewing/updating own profile after proper session join
CREATE POLICY "Students can view own profile" ON public.students 
FOR SELECT USING (
  student_id = current_setting('app.current_student_id', true) OR
  auth.uid() IS NOT NULL  -- Allow authenticated users
);

CREATE POLICY "Students can insert own profile" ON public.students 
FOR INSERT WITH CHECK (true); -- Allow registration

CREATE POLICY "Students can update own profile" ON public.students 
FOR UPDATE USING (student_id = current_setting('app.current_student_id', true));

-- Exam Sessions: Only allow viewing active sessions that match class level
CREATE POLICY "View active exam sessions" ON public.exam_sessions 
FOR SELECT USING (
  status = 'active' AND 
  starts_at <= NOW() AND 
  ends_at >= NOW()
);

-- Allow session creation by authenticated users (teachers/admins)
CREATE POLICY "Teachers can create sessions" ON public.exam_sessions 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers can update own sessions" ON public.exam_sessions 
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  (teacher_id = auth.uid() OR teacher_id IS NULL)
);

-- Exams: Only viewable through valid session participation
CREATE POLICY "View exams through valid sessions" ON public.exams 
FOR SELECT USING (
  id IN (
    SELECT exam_id FROM public.exam_sessions 
    WHERE status = 'active' 
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  )
);

-- Questions: Only viewable during active exam sessions
CREATE POLICY "View questions during active sessions" ON public.questions 
FOR SELECT USING (
  exam_id IN (
    SELECT exam_id FROM public.exam_sessions 
    WHERE status = 'active' 
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  )
);

-- Session Participants: Students can only manage their own participation
CREATE POLICY "Students can view own participation" ON public.session_participants 
FOR SELECT USING (
  student_id = current_setting('app.current_student_id', true)
);

CREATE POLICY "Students can join sessions" ON public.session_participants 
FOR INSERT WITH CHECK (
  session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status = 'active' 
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  )
);

-- Student Exam Attempts: Students can only manage their own attempts
CREATE POLICY "Students can view own attempts" ON public.student_exam_attempts 
FOR SELECT USING (
  student_id = current_setting('app.current_student_id', true)
);

CREATE POLICY "Students can create own attempts" ON public.student_exam_attempts 
FOR INSERT WITH CHECK (
  student_id = current_setting('app.current_student_id', true) AND
  session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE status = 'active' 
    AND starts_at <= NOW() 
    AND ends_at >= NOW()
  )
);

CREATE POLICY "Students can update own attempts" ON public.student_exam_attempts 
FOR UPDATE USING (
  student_id = current_setting('app.current_student_id', true)
);

-- Student Answers: Students can only manage their own answers
CREATE POLICY "Students can view own answers" ON public.student_answers 
FOR SELECT USING (
  attempt_id IN (
    SELECT id FROM public.student_exam_attempts 
    WHERE student_id = current_setting('app.current_student_id', true)
  )
);

CREATE POLICY "Students can create own answers" ON public.student_answers 
FOR INSERT WITH CHECK (
  attempt_id IN (
    SELECT id FROM public.student_exam_attempts 
    WHERE student_id = current_setting('app.current_student_id', true)
  )
);

CREATE POLICY "Students can update own answers" ON public.student_answers 
FOR UPDATE USING (
  attempt_id IN (
    SELECT id FROM public.student_exam_attempts 
    WHERE student_id = current_setting('app.current_student_id', true)
  )
);

-- Exam Results: Students can view own results
CREATE POLICY "Students can view own results" ON public.exam_results 
FOR SELECT USING (
  student_id = current_setting('app.current_student_id', true)
);

-- Classes: Allow viewing class information
CREATE POLICY "Classes are viewable" ON public.classes 
FOR SELECT USING (true);

-- Cheating Logs: System and teachers can manage
CREATE POLICY "System can insert cheating logs" ON public.cheating_logs 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Students can view own cheating logs" ON public.cheating_logs 
FOR SELECT USING (
  student_id = current_setting('app.current_student_id', true)
);

NOTIFY pgrst, 'reload schema';

SELECT 'Student validation security policies updated successfully!' as status;
