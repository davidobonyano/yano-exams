-- Fix student login function for YAN system
-- Remove class level restriction that's causing "student class level does not match session" error

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

  -- REMOVED: Class level match check - allow any student to join any session
  -- This was causing the "student class level does not match session" error

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.join_session_by_student_id TO anon, authenticated;

SELECT 'Fixed student login function for YAN system!' as status;
SELECT 'Changes:' as change;
SELECT '- Removed class level restriction' as change;
SELECT '- Students can now join any session regardless of class' as change;
SELECT '- Works with YAN IDs from school_students table' as change;
