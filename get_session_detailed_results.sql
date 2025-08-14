-- Function to get detailed results for all students in a session
CREATE OR REPLACE FUNCTION public.get_session_detailed_results(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_session_info JSONB;
  v_students_results JSONB;
BEGIN
  -- Get session information
  SELECT jsonb_build_object(
    'session_id', es.id,
    'session_name', es.session_name,
    'exam_id', es.exam_id,
    'exam_title', e.title,
    'exam_description', e.description,
    'total_questions', e.total_questions,
    'passing_score', e.passing_score,
    'duration_minutes', e.duration_minutes,
    'created_at', es.created_at,
    'status', es.status,
    'total_participants', (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = es.id
    ),
    'completed_participants', (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = es.id AND status IN ('completed', 'submitted')
    )
  ) INTO v_session_info
  FROM public.exam_sessions es
  JOIN public.exams e ON e.id = es.exam_id
  WHERE es.id = p_session_id;

  IF v_session_info IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  -- Get summary results for all students in this session
  SELECT jsonb_agg(
    jsonb_build_object(
      'attempt_id', sea.id,
      'student_id', sea.student_id,
      'student_name', s.full_name,
      'student_email', s.email,
      'status', sea.status,
      'started_at', sea.started_at,
      'completed_at', sea.completed_at,
      'submitted_at', sea.submitted_at,
      'total_questions', COALESCE(er.total_questions, 0),
      'correct_answers', COALESCE(er.correct_answers, 0),
      'total_points', COALESCE(er.total_points, 0),
      'points_earned', COALESCE(er.points_earned, 0),
      'percentage_score', COALESCE(er.percentage_score, 0),
      'passed', COALESCE(er.passed, false),
      'completion_time_minutes', CASE 
        WHEN sea.completed_at IS NOT NULL AND sea.started_at IS NOT NULL THEN
          EXTRACT(EPOCH FROM (sea.completed_at - sea.started_at)) / 60
        ELSE NULL
      END
    ) ORDER BY s.full_name
  ) INTO v_students_results
  FROM public.student_exam_attempts sea
  JOIN public.students s ON s.id = sea.student_id
  LEFT JOIN public.exam_results er ON er.attempt_id = sea.id
  WHERE sea.session_id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_info', v_session_info,
    'students_results', COALESCE(v_students_results, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT public.get_session_detailed_results('your-session-id-here');
