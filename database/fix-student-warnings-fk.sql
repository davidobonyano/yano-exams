-- Fix student_warnings table to reference the correct students table
-- The table was incorrectly referencing teacher_students instead of students

-- Drop the existing foreign key constraint
ALTER TABLE public.student_warnings 
DROP CONSTRAINT IF EXISTS student_warnings_student_id_fkey;

-- Update the student_id column to reference the correct students table
ALTER TABLE public.student_warnings 
ADD CONSTRAINT student_warnings_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- Add comment for clarity
COMMENT ON COLUMN public.student_warnings.student_id IS 'References students.id (not teacher_students.id)';