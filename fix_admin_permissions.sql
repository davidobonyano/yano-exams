-- Fix Admin Permissions for Creating Exams and Managing Questions
-- This script adds the necessary RLS policies for teachers/admins to manage exams and questions

-- 1. First, let's check what tables exist and create missing ones
DO $$ 
BEGIN
    -- Check if teachers table exists and create it if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teachers') THEN
        CREATE TABLE public.teachers (
            id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            school_name TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
        
        RAISE NOTICE 'Created teachers table';
    END IF;

    -- Check if user_exam_attempts table exists, if not create it
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_exam_attempts') THEN
        CREATE TABLE public.user_exam_attempts (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
            exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
            status TEXT DEFAULT 'not_started',
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            submitted_at TIMESTAMP WITH TIME ZONE,
            time_remaining INTEGER,
            is_paused BOOLEAN DEFAULT false,
            pause_reason TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            UNIQUE(user_id, exam_id)
        );
        
        RAISE NOTICE 'Created user_exam_attempts table';
    END IF;

    -- Check if user_answers table exists, if not create it
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_answers') THEN
        CREATE TABLE public.user_answers (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            attempt_id UUID REFERENCES public.user_exam_attempts(id) ON DELETE CASCADE NOT NULL,
            question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
            answer TEXT NOT NULL,
            is_correct BOOLEAN,
            points_earned INTEGER DEFAULT 0,
            answered_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            UNIQUE(attempt_id, question_id)
        );
        
        RAISE NOTICE 'Created user_answers table';
    END IF;

    -- Check if exam_results table exists, if not create it
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'exam_results') THEN
        CREATE TABLE public.exam_results (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            attempt_id UUID REFERENCES public.user_exam_attempts(id) ON DELETE CASCADE NOT NULL UNIQUE,
            user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
            exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
            total_questions INTEGER NOT NULL,
            correct_answers INTEGER NOT NULL DEFAULT 0,
            total_points INTEGER NOT NULL DEFAULT 0,
            points_earned INTEGER NOT NULL DEFAULT 0,
            percentage_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            passed BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
        
        RAISE NOTICE 'Created exam_results table';
    END IF;

    -- Check if cheating_logs table exists, if not create it
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cheating_logs') THEN
        CREATE TABLE public.cheating_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            attempt_id UUID REFERENCES public.user_exam_attempts(id) ON DELETE CASCADE NOT NULL,
            user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
            violation_type TEXT NOT NULL,
            violation_details JSONB,
            detected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
        
        RAISE NOTICE 'Created cheating_logs table';
    END IF;
END $$;

-- 2. Enable RLS on all tables
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheating_logs ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for teachers table
DROP POLICY IF EXISTS "Teachers can view own profile" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update own profile" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can insert own profile" ON public.teachers;

CREATE POLICY "Teachers can view own profile" ON public.teachers
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Teachers can update own profile" ON public.teachers
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Teachers can insert own profile" ON public.teachers
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Add admin policies for exams table
-- Allow teachers to create, view, update, and delete exams
DROP POLICY IF EXISTS "Allow teachers to manage exams" ON public.exams;
CREATE POLICY "Allow teachers to manage exams" ON public.exams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 4. Add admin policies for questions table
-- Allow teachers to create, view, update, and delete questions
DROP POLICY IF EXISTS "Allow teachers to manage questions" ON public.questions;
CREATE POLICY "Allow teachers to manage questions" ON public.questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 5. Add admin policies for classes table
-- Allow teachers to view and manage classes
DROP POLICY IF EXISTS "Allow teachers to manage classes" ON public.classes;
CREATE POLICY "Allow teachers to manage classes" ON public.classes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 6. Add admin policies for user_exam_attempts table
-- Allow teachers to view all attempts for monitoring
DROP POLICY IF EXISTS "Allow teachers to view all attempts" ON public.user_exam_attempts;
CREATE POLICY "Allow teachers to view all attempts" ON public.user_exam_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 7. Add admin policies for user_answers table
-- Allow teachers to view all answers for grading
DROP POLICY IF EXISTS "Allow teachers to view all answers" ON public.user_answers;
CREATE POLICY "Allow teachers to view all answers" ON public.user_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 8. Add admin policies for exam_results table
-- Allow teachers to view all results
DROP POLICY IF EXISTS "Allow teachers to view all results" ON public.exam_results;
CREATE POLICY "Allow teachers to view all results" ON public.exam_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 9. Add admin policies for cheating_logs table
-- Allow teachers to view all cheating logs
DROP POLICY IF EXISTS "Allow teachers to view all cheating logs" ON public.cheating_logs;
CREATE POLICY "Allow teachers to view all cheating logs" ON public.cheating_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 10. Create a function to check if user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.teachers 
        WHERE teachers.id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.exams TO authenticated;
GRANT ALL ON public.questions TO authenticated;
GRANT ALL ON public.classes TO authenticated;
GRANT ALL ON public.user_exam_attempts TO authenticated;
GRANT ALL ON public.user_answers TO authenticated;
GRANT ALL ON public.exam_results TO authenticated;
GRANT ALL ON public.cheating_logs TO authenticated;
GRANT ALL ON public.teachers TO authenticated;

-- 12. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teachers_id ON public.teachers(id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_user_exam_attempts_user_id ON public.user_exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_exam_attempts_exam_id ON public.user_exam_attempts(exam_id);

-- 13. Add trigger for updated_at on teachers table
CREATE OR REPLACE FUNCTION public.handle_teachers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_teachers_updated_at ON public.teachers;
CREATE TRIGGER handle_teachers_updated_at
    BEFORE UPDATE ON public.teachers
    FOR EACH ROW EXECUTE FUNCTION public.handle_teachers_updated_at();

-- Status message
SELECT 'Admin permissions fixed successfully! Teachers can now create exams and manage questions.' as status; 