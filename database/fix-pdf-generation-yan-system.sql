-- Fix PDF generation for YAN system
-- Update get_detailed_student_results function to work with new school_students table

DROP FUNCTION IF EXISTS public.get_detailed_student_results CASCADE;

CREATE OR REPLACE FUNCTION public.get_detailed_student_results(p_attempt_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_attempt_info JSONB;
  v_detailed_answers JSONB;
BEGIN
  -- Get basic attempt and result information with student class and session code
  -- Updated to work with both old and new student systems
  SELECT jsonb_build_object(
    'attempt_id', sea.id,
    'student_id', sea.student_id,
    'student_name', COALESCE(s.full_name, ss.full_name),
    'student_email', COALESCE(s.email, ss.email),
    'student_class', COALESCE(s.class_level, ss.class_level),
    'student_school_id', COALESCE(s.student_id, ss.student_id),
    'exam_id', sea.exam_id,
    'exam_title', e.title,
    'session_id', sea.session_id,
    'session_name', es.session_name,
    'session_code', es.session_code,
    'status', sea.status,
    'started_at', sea.started_at,
    'completed_at', sea.completed_at,
    'submitted_at', sea.submitted_at,
    'total_questions', er.total_questions,
    'correct_answers', er.correct_answers,
    'total_points', er.total_points,
    'points_earned', er.points_earned,
    'percentage_score', er.percentage_score,
    'passed', er.passed,
    'passing_score', e.passing_score
  ) INTO v_attempt_info
  FROM public.student_exam_attempts sea
  LEFT JOIN public.students s ON s.id = sea.student_id
  LEFT JOIN public.school_students ss ON ss.student_id = s.student_id
  JOIN public.exams e ON e.id = sea.exam_id
  JOIN public.exam_sessions es ON es.id = sea.session_id
  LEFT JOIN public.exam_results er ON er.attempt_id = sea.id
  WHERE sea.id = p_attempt_id;

  IF v_attempt_info IS NULL THEN
    -- Try alternative approach - look directly in school_students
    SELECT jsonb_build_object(
      'attempt_id', sea.id,
      'student_id', sea.student_id,
      'student_name', ss.full_name,
      'student_email', ss.email,
      'student_class', ss.class_level,
      'student_school_id', ss.student_id,
      'exam_id', sea.exam_id,
      'exam_title', e.title,
      'session_id', sea.session_id,
      'session_name', es.session_name,
      'session_code', es.session_code,
      'status', sea.status,
      'started_at', sea.started_at,
      'completed_at', sea.completed_at,
      'submitted_at', sea.submitted_at,
      'total_questions', er.total_questions,
      'correct_answers', er.correct_answers,
      'total_points', er.total_points,
      'points_earned', er.points_earned,
      'percentage_score', er.percentage_score,
      'passed', er.passed,
      'passing_score', e.passing_score
    ) INTO v_attempt_info
    FROM public.student_exam_attempts sea
    JOIN public.school_students ss ON ss.student_id = (
      SELECT student_id FROM public.students WHERE id = sea.student_id
    )
    JOIN public.exams e ON e.id = sea.exam_id
    JOIN public.exam_sessions es ON es.id = sea.session_id
    LEFT JOIN public.exam_results er ON er.attempt_id = sea.id
    WHERE sea.id = p_attempt_id;
  END IF;

  IF v_attempt_info IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;

  -- Get detailed answers with full question and answer text
  WITH numbered_questions AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY q.created_at) as question_number,
      q.id,
      q.question_text,
      q.question_type,
      q.points,
      q.options,
      q.correct_answer,
      q.explanation,
      sa.answer,
      sa.is_correct,
      sa.points_earned,
      sa.answered_at
    FROM public.questions q
    LEFT JOIN public.student_answers sa ON sa.question_id = q.id AND sa.attempt_id = p_attempt_id
    WHERE q.exam_id = (SELECT exam_id FROM public.student_exam_attempts WHERE id = p_attempt_id)
    ORDER BY q.created_at
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'question_number', nq.question_number,
      'question_id', nq.id,
      'question_text', nq.question_text,
      'question_type', nq.question_type,
      'question_points', nq.points,
      'options', nq.options,
      'correct_answer_key', nq.correct_answer,
      'correct_answer_text', CASE 
        WHEN nq.question_type = 'multiple_choice' AND nq.options IS NOT NULL THEN 
          (nq.options->nq.correct_answer)::text
        WHEN nq.question_type = 'true_false' THEN 
          CASE nq.correct_answer WHEN 'true' THEN 'True' WHEN 'false' THEN 'False' ELSE nq.correct_answer END
        ELSE nq.correct_answer  -- For short_answer and other types
      END,
      'student_answer_key', COALESCE(nq.answer, 'Not Answered'),
      'student_answer_text', CASE 
        WHEN nq.answer IS NULL THEN 'Not Answered'
        WHEN nq.question_type = 'multiple_choice' AND nq.options IS NOT NULL THEN 
          COALESCE((nq.options->nq.answer)::text, nq.answer)
        WHEN nq.question_type = 'true_false' THEN 
          CASE nq.answer WHEN 'true' THEN 'True' WHEN 'false' THEN 'False' ELSE nq.answer END
        ELSE nq.answer  -- For short_answer and other types, show raw text
      END,
      'is_correct', COALESCE(nq.is_correct, false),
      'points_earned', COALESCE(nq.points_earned, 0),
      'answered_at', nq.answered_at,
      'explanation', nq.explanation
    ) ORDER BY nq.question_number
  ) INTO v_detailed_answers
  FROM numbered_questions nq;

  -- Combine all information
  v_result := jsonb_build_object(
    'success', true,
    'attempt_info', v_attempt_info,
    'detailed_answers', COALESCE(v_detailed_answers, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_detailed_student_results TO anon, authenticated;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_id ON public.student_exam_attempts(id);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON public.students(student_id);
CREATE INDEX IF NOT EXISTS idx_school_students_student_id ON public.school_students(student_id);

SELECT 'Fixed PDF generation function for YAN system!' as status;
SELECT 'Changes:' as change;
SELECT '- Updated to work with both old and new student systems' as change;
SELECT '- Added fallback lookup in school_students table' as change;
SELECT '- Improved error handling and performance' as change;
SELECT '- Added indexes for better query performance' as change;
