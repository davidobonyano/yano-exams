CREATE OR REPLACE FUNCTION public.calculate_exam_score(p_attempt_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_attempt student_exam_attempts%ROWTYPE;
  v_exam exams%ROWTYPE;
  v_total_questions INTEGER;
  v_correct_answers INTEGER;
  v_total_points INTEGER;
  v_points_earned INTEGER;
  v_percentage_score DECIMAL(5,2);
  v_passed BOOLEAN;
  v_result_id UUID;
BEGIN
  -- Get attempt details
  SELECT sea.* INTO v_attempt
  FROM public.student_exam_attempts sea
  WHERE sea.id = p_attempt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;

  -- Get exam details
  SELECT e.* INTO v_exam
  FROM public.exams e
  WHERE e.id = v_attempt.exam_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found');
  END IF;

  -- Calculate scores
  -- Use exam's total_questions instead of counting student answers
  v_total_questions := v_exam.total_questions;
  
  -- Get total points from exam questions (not from student answers to handle empty submissions)
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM public.questions
  WHERE exam_id = v_exam.id;
  
  -- Get student performance from answers
  SELECT 
    COALESCE(COUNT(*) FILTER (WHERE sa.is_correct = true), 0) as correct_answers,
    COALESCE(SUM(CASE WHEN sa.is_correct = true THEN q.points ELSE 0 END), 0) as points_earned
  INTO v_correct_answers, v_points_earned
  FROM public.student_answers sa
  JOIN public.questions q ON q.id = sa.question_id
  WHERE sa.attempt_id = p_attempt_id;

  -- Calculate percentage
  v_percentage_score := CASE 
    WHEN v_total_points > 0 THEN (v_points_earned::DECIMAL / v_total_points::DECIMAL) * 100
    ELSE 0
  END;

  -- Determine if passed
  v_passed := v_percentage_score >= v_exam.passing_score;

  -- Insert or update result
  INSERT INTO public.exam_results (
    attempt_id,
    student_id,
    session_id,
    exam_id,
    total_questions,
    correct_answers,
    total_points,
    points_earned,
    percentage_score,
    passed
  ) VALUES (
    p_attempt_id,
    v_attempt.student_id,
    v_attempt.session_id,
    v_attempt.exam_id,
    v_total_questions,
    v_correct_answers,
    v_total_points,
    v_points_earned,
    v_percentage_score,
    v_passed
  ) ON CONFLICT (attempt_id) DO UPDATE SET
    total_questions = v_total_questions,
    correct_answers = v_correct_answers,
    total_points = v_total_points,
    points_earned = v_points_earned,
    percentage_score = v_percentage_score,
    passed = v_passed
  RETURNING id INTO v_result_id;

  -- Update attempt status
  UPDATE public.student_exam_attempts
  SET 
    status = 'completed',
    completed_at = NOW(),
    submitted_at = NOW()
  WHERE id = p_attempt_id;

  -- Update live stats if the table exists
  UPDATE public.session_live_stats
  SET 
    completed_participants = (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = v_attempt.session_id AND status IN ('completed', 'submitted')
    ),
    active_participants = (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = v_attempt.session_id AND status = 'in_progress'
    ),
    average_completion_time = (
      SELECT AVG(completed_at - started_at) 
      FROM public.student_exam_attempts 
      WHERE session_id = v_attempt.session_id AND completed_at IS NOT NULL
    ),
    last_updated = NOW()
  WHERE session_id = v_attempt.session_id;

  RETURN jsonb_build_object(
    'success', true,
    'result_id', v_result_id,
    'total_questions', v_total_questions,
    'correct_answers', v_correct_answers,
    'total_points', v_total_points,
    'points_earned', v_points_earned,
    'percentage_score', v_percentage_score,
    'passed', v_passed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.calculate_exam_score TO anon, authenticated;

SELECT 'Fixed calculate_exam_score to handle empty submissions!' as status;