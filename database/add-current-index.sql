-- Add current_index to student_exam_attempts to support per-student resume of question index
ALTER TABLE public.student_exam_attempts
ADD COLUMN IF NOT EXISTS current_index INTEGER DEFAULT 0; 