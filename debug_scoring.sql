-- Debug script to check scoring function
-- Replace the UUID with an actual attempt ID from your database

-- First, let's see what attempts exist
SELECT 
  sea.id as attempt_id,
  sea.status,
  sea.exam_id,
  e.title as exam_title,
  sea.student_id,
  s.student_id as student_code,
  sea.started_at,
  sea.completed_at
FROM student_exam_attempts sea
JOIN exams e ON e.id = sea.exam_id
LEFT JOIN students s ON s.id = sea.student_id
ORDER BY sea.started_at DESC
LIMIT 10;

-- Check student answers for the most recent attempt
SELECT 
  sa.attempt_id,
  sa.question_id,
  sa.answer,
  sa.is_correct,
  sa.points_earned,
  q.points as question_points,
  q.question_text
FROM student_answers sa
JOIN questions q ON q.id = sa.question_id
WHERE sa.attempt_id = (
  SELECT id FROM student_exam_attempts 
  ORDER BY started_at DESC 
  LIMIT 1
);

-- Test the scoring function with the most recent attempt
SELECT public.calculate_exam_score((
  SELECT id FROM student_exam_attempts 
  ORDER BY started_at DESC 
  LIMIT 1
)) as scoring_result;
