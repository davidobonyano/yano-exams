-- Simple fix to add camera_enabled column if it doesn't exist
-- Run this first before the full WebRTC setup

ALTER TABLE public.student_exam_attempts 
ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT false;

SELECT 'Camera enabled column added successfully!' as status;