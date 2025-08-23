-- Update student login function to work with new YAN student IDs
-- This replaces the old teacher_students table with the new school_students table

DROP FUNCTION IF EXISTS public.join_session_by_student_id CASCADE;

CREATE OR REPLACE FUNCTION public.join_session_by_student_id(
  p_session_code TEXT,
  p_student_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_session exam_sessions%ROWTYPE;
  v_student school_students%ROWTYPE;
  v_exam exams%ROWTYPE;
  v_existing_participant UUID;
  v_participant_id UUID;
  v_main_student_id UUID;
BEGIN
  -- Find the active session
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE session_code = p_session_code
  AND status = 'active'
  AND NOW() BETWEEN starts_at AND ends_at;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session code');
  END IF;

  -- Find the student by student_id in school_students table (new YAN system)
  SELECT * INTO v_student
  FROM public.school_students
  WHERE student_id = p_student_id
  AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student ID not found or not active');
  END IF;

  -- Check class level match
  IF v_student.class_level != v_session.class_level THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student class level does not match session');
  END IF;

  -- Get exam details
  SELECT * INTO v_exam
  FROM public.exams
  WHERE id = v_session.exam_id;

  -- Create or get student record in main students table
  INSERT INTO public.students (student_id, full_name, class_level, school_name)
  VALUES (v_student.student_id, v_student.full_name, v_student.class_level, v_student.school_name)
  ON CONFLICT (student_id, school_name) DO UPDATE SET
    full_name = v_student.full_name,
    class_level = v_student.class_level
  RETURNING id INTO v_main_student_id;

  -- If no RETURNING value (conflict case), get the existing student ID
  IF v_main_student_id IS NULL THEN
    SELECT students.id INTO v_main_student_id
    FROM public.students students
    WHERE students.student_id = p_student_id
    AND (v_student.school_name IS NULL OR students.school_name = v_student.school_name)
    LIMIT 1;
  END IF;

  -- Check if student already has a participant record
  SELECT sp.id INTO v_existing_participant
  FROM public.session_participants sp
  WHERE sp.session_id = v_session.id 
  AND sp.student_id = v_main_student_id;

  IF v_existing_participant IS NOT NULL THEN
    -- Student already joined, return existing participation
    RETURN jsonb_build_object(
      'success', true,
      'already_joined', true,
      'student_name', v_student.full_name,
      'student_class_level', v_student.class_level,
      'session_id', v_session.id,
      'session_code', v_session.session_code,
      'exam_id', v_session.exam_id,
      'exam_title', v_exam.title,
      'duration_minutes', v_exam.duration_minutes,
      'instructions', v_session.instructions,
      'participant_id', v_existing_participant,
      'student_id', v_main_student_id,
      'teacher_id', v_session.teacher_id,
      'camera_monitoring_enabled', v_session.camera_monitoring_enabled,
      'show_results_after_submit', v_session.show_results_after_submit
    );
  END IF;

  -- Join the session
  INSERT INTO public.session_participants (session_id, student_id)
  VALUES (v_session.id, v_main_student_id)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_joined', false,
    'student_name', v_student.full_name,
    'student_class_level', v_student.class_level,
    'session_id', v_session.id,
    'session_code', v_session.session_code,
    'exam_id', v_session.exam_id,
    'exam_title', v_exam.title,
    'duration_minutes', v_exam.duration_minutes,
    'instructions', v_session.instructions,
    'participant_id', v_participant_id,
    'student_id', v_main_student_id,
    'teacher_id', v_session.teacher_id,
    'camera_monitoring_enabled', v_session.camera_monitoring_enabled,
    'show_results_after_submit', v_session.show_results_after_submit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get student exam status (updated for YAN system)
CREATE OR REPLACE FUNCTION public.get_student_exam_status(
  p_session_id UUID,
  p_student_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_student_id UUID;
  v_attempt student_exam_attempts%ROWTYPE;
BEGIN
  -- Get the main student ID from the students table
  SELECT id INTO v_student_id
  FROM public.students
  WHERE student_id = p_student_id;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student not found'
    );
  END IF;

  -- Get the latest attempt for this student and session
  SELECT * INTO v_attempt
  FROM public.student_exam_attempts
  WHERE student_id = v_student_id
  AND session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_attempt IS NULL THEN
    -- No attempt exists
    RETURN jsonb_build_object(
      'success', true,
      'can_resume', false,
      'attempt_id', NULL,
      'time_remaining', NULL
    );
  END IF;

  -- Check if the attempt can be resumed
  DECLARE
    v_can_resume BOOLEAN := false;
    v_time_remaining INTEGER := NULL;
  BEGIN
    IF v_attempt.status = 'in_progress' THEN
      -- Calculate remaining time
      v_time_remaining := GREATEST(0, v_attempt.duration_minutes - 
        EXTRACT(EPOCH FROM (NOW() - v_attempt.started_at)) / 60);
      
      -- Can resume if there's still time left
      v_can_resume := v_time_remaining > 0;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'can_resume', v_can_resume,
      'attempt_id', v_attempt.id,
      'time_remaining', v_time_remaining,
      'status', v_attempt.status
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.join_session_by_student_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_exam_status TO anon, authenticated;

-- Create index for better performance on school_students lookup
CREATE INDEX IF NOT EXISTS idx_school_students_student_id_lookup ON public.school_students(student_id, is_active);

SELECT 'Updated student login functions for YAN ID system!' as status;
SELECT 'Features:' as feature;
SELECT '- Uses new school_students table for YAN IDs' as feature;
SELECT '- Maintains compatibility with existing session system' as feature;
SELECT '- Improved performance with new indexes' as feature;
SELECT '- Better error handling for YAN student IDs' as feature;
