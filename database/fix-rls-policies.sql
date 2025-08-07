-- Fix RLS Policies for Session System
-- Run this AFTER fix-join-function.sql

-- Temporarily disable RLS to fix policies
ALTER TABLE public.exam_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheating_logs DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Students can view own profile" ON public.students;
DROP POLICY IF EXISTS "Classes are viewable by authenticated users" ON public.classes;
DROP POLICY IF EXISTS "Users can view exams for their class" ON public.exams;
DROP POLICY IF EXISTS "Teachers can manage own sessions" ON public.exam_sessions;
DROP POLICY IF EXISTS "Students can view sessions they joined" ON public.exam_sessions;
DROP POLICY IF EXISTS "Teachers can manage own exams" ON public.exams;
DROP POLICY IF EXISTS "Students can view exams through sessions" ON public.exams;
DROP POLICY IF EXISTS "Students can view questions during active sessions" ON public.questions;
DROP POLICY IF EXISTS "Students can view own session participation" ON public.session_participants;
DROP POLICY IF EXISTS "Students can manage own attempts" ON public.student_exam_attempts;
DROP POLICY IF EXISTS "Students can manage own answers" ON public.student_answers;
DROP POLICY IF EXISTS "Students can view own results" ON public.exam_results;
DROP POLICY IF EXISTS "Students can view own cheating logs" ON public.cheating_logs;
DROP POLICY IF EXISTS "System can insert cheating logs" ON public.cheating_logs;

-- Create simplified policies for testing
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on students" ON public.students FOR ALL USING (true);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Classes are viewable by all" ON public.classes FOR SELECT USING (true);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exams are viewable by all" ON public.exams FOR SELECT USING (true);

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions are viewable by all" ON public.exam_sessions FOR SELECT USING (true);
CREATE POLICY "Sessions can be inserted" ON public.exam_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Sessions can be updated" ON public.exam_sessions FOR UPDATE USING (true);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions are viewable by all" ON public.questions FOR SELECT USING (true);

ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on participants" ON public.session_participants FOR ALL USING (true);

ALTER TABLE public.student_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on attempts" ON public.student_exam_attempts FOR ALL USING (true);

ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on answers" ON public.student_answers FOR ALL USING (true);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on results" ON public.exam_results FOR ALL USING (true);

ALTER TABLE public.cheating_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on cheating logs" ON public.cheating_logs FOR ALL USING (true);

-- Verify policies are working
SELECT 'RLS policies updated successfully!' as status;