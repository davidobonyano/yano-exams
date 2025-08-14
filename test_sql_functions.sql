-- Test if our SQL functions exist and work
-- Run this in Supabase SQL Editor to verify

-- 0. First check what columns exist in students table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'students' AND table_schema = 'public';

-- 1. Check if functions exist
SELECT 
  routine_name, 
  routine_type, 
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_detailed_student_results', 'get_session_detailed_results', 'calculate_exam_score');

-- 2. Check if we have any student attempts to test with
SELECT 
  sea.id as attempt_id,
  s.full_name as student_name,
  e.title as exam_title,
  sea.status
FROM student_exam_attempts sea
JOIN students s ON s.id = sea.student_id
JOIN exams e ON e.id = sea.exam_id
LIMIT 5;

-- 3. Test the function with a real attempt ID (replace with actual ID from above)
-- SELECT public.get_detailed_student_results('your-actual-attempt-id-here');
