-- Add camera_enabled column to student_exam_attempts table
ALTER TABLE public.student_exam_attempts 
ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT false;

SELECT 'Camera enabled column added successfully!' as status;