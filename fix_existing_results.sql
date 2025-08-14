-- Fix existing exam results that have incorrect total_questions values
-- Update them to use the exam's actual total_questions

UPDATE public.exam_results 
SET total_questions = exams.total_questions
FROM public.exams
WHERE exam_results.exam_id = exams.id 
  AND exam_results.total_questions != exams.total_questions;

-- Show the results of the update
SELECT 
  er.id,
  er.session_id,
  er.total_questions as result_total_questions,
  e.total_questions as exam_total_questions,
  er.correct_answers,
  er.percentage_score
FROM public.exam_results er
JOIN public.exams e ON e.id = er.exam_id
ORDER BY er.created_at DESC
LIMIT 10;