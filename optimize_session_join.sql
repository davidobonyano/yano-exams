-- Optimized join_session_by_student_id function for better performance

DROP FUNCTION IF EXISTS public.join_session_by_student_id CASCADE;

CREATE OR REPLACE FUNCTION public.join_session_by_student_id(
  p_session_code TEXT,
  p_student_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_session_data RECORD;
  v_student_uuid UUID;
  v_existing_participant UUID;
  v_participant_id UUID;
BEGIN
  -- Single query to get all session, exam, and student data
  SELECT 
    es.id as session_id,
    es.session_code,
    es.teacher_id,
    es.class_level as session_class_level,
    es.camera_monitoring_enabled,
    es.show_results_after_submit,
    es.instructions,
    e.id as exam_id,
    e.title as exam_title,
    e.duration_minutes,
    ts.id as teacher_student_id,
    ts.full_name as student_name,
    ts.class_level as student_class_level,
    ts.school_name
  INTO v_session_data
  FROM public.exam_sessions es
  JOIN public.exams e ON e.id = es.exam_id
  JOIN public.teacher_students ts ON ts.teacher_id = es.teacher_id 
    AND ts.student_id = p_student_id 
    AND ts.is_active = true
  WHERE es.session_code = p_session_code
    AND es.status = 'active'
    AND NOW() BETWEEN es.starts_at AND es.ends_at
    AND ts.class_level = es.class_level;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session, student ID, or class level mismatch');
  END IF;

  -- Get or create student in main table (optimized upsert)
  INSERT INTO public.students (student_id, full_name, class_level, school_name)
  VALUES (p_student_id, v_session_data.student_name, v_session_data.student_class_level, v_session_data.school_name)
  ON CONFLICT (student_id, school_name) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    class_level = EXCLUDED.class_level
  RETURNING id INTO v_student_uuid;

  -- Check for existing participant
  SELECT sp.id INTO v_existing_participant
  FROM public.session_participants sp
  WHERE sp.session_id = v_session_data.session_id 
    AND sp.student_id = v_student_uuid;

  IF v_existing_participant IS NOT NULL THEN
    -- Return existing participation
    RETURN jsonb_build_object(
      'success', true,
      'already_joined', true,
      'student_name', v_session_data.student_name,
      'student_class_level', v_session_data.student_class_level,
      'session_id', v_session_data.session_id,
      'session_code', v_session_data.session_code,
      'exam_id', v_session_data.exam_id,
      'exam_title', v_session_data.exam_title,
      'duration_minutes', v_session_data.duration_minutes,
      'instructions', v_session_data.instructions,
      'camera_monitoring_enabled', COALESCE(v_session_data.camera_monitoring_enabled, false),
      'show_results_after_submit', COALESCE(v_session_data.show_results_after_submit, false),
      'teacher_id', v_session_data.teacher_id,
      'participant_id', v_existing_participant,
      'student_id', v_student_uuid
    );
  END IF;

  -- Create new participant
  INSERT INTO public.session_participants (session_id, student_id)
  VALUES (v_session_data.session_id, v_student_uuid)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_joined', false,
    'student_name', v_session_data.student_name,
    'student_class_level', v_session_data.student_class_level,
    'session_id', v_session_data.session_id,
    'session_code', v_session_data.session_code,
    'exam_id', v_session_data.exam_id,
    'exam_title', v_session_data.exam_title,
    'duration_minutes', v_session_data.duration_minutes,
    'instructions', v_session_data.instructions,
    'camera_monitoring_enabled', COALESCE(v_session_data.camera_monitoring_enabled, false),
    'show_results_after_submit', COALESCE(v_session_data.show_results_after_submit, false),
    'teacher_id', v_session_data.teacher_id,
    'participant_id', v_participant_id,
    'student_id', v_student_uuid
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to join session: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.join_session_by_student_id TO anon, authenticated;

SELECT 'Optimized join_session_by_student_id for better performance!' as status;
