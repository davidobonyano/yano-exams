-- Simple Admin Fix - Just the essentials for creating exams and managing questions
-- This script adds basic admin permissions without complex table structures

-- 1. Create teachers table if it doesn't exist (minimal version)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teachers') THEN
        CREATE TABLE public.teachers (
            id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            school_name TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );
        
        RAISE NOTICE 'Created teachers table';
    END IF;
END $$;

-- 2. Enable RLS on teachers table
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- 3. Add basic RLS policies for teachers
DROP POLICY IF EXISTS "Teachers can manage own profile" ON public.teachers;
CREATE POLICY "Teachers can manage own profile" ON public.teachers
    FOR ALL USING (auth.uid() = id);

-- 4. Add admin policies for exams table (the main issue)
-- Allow teachers to create, view, update, and delete exams
DROP POLICY IF EXISTS "Allow teachers to manage exams" ON public.exams;
CREATE POLICY "Allow teachers to manage exams" ON public.exams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 5. Add admin policies for questions table (the main issue)
-- Allow teachers to create, view, update, and delete questions
DROP POLICY IF EXISTS "Allow teachers to manage questions" ON public.questions;
CREATE POLICY "Allow teachers to manage questions" ON public.questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.teachers 
            WHERE teachers.id = auth.uid()
        )
    );

-- 6. Grant basic permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.exams TO authenticated;
GRANT ALL ON public.questions TO authenticated;
GRANT ALL ON public.teachers TO authenticated;

-- 7. Create basic index for performance
CREATE INDEX IF NOT EXISTS idx_teachers_id ON public.teachers(id);

-- Status message
SELECT 'Simple admin fix completed! Teachers can now create exams and manage questions.' as status;
