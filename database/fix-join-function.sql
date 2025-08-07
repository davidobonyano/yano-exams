-- Fix the join_exam_session function
-- Run this in Supabase SQL Editor

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.join_exam_session CASCADE;

-- Create the join_exam_session function with correct parameters
CREATE OR REPLACE FUNCTION public.join_exam_session(
  p_session_code TEXT,
  p_student_id TEXT,
  p_full_name TEXT,
  p_class_level class_level,
  p_school_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_session exam_sessions%ROWTYPE;
  v_student students%ROWTYPE;
  v_participant_id UUID;
BEGIN
  -- Find the session
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE session_code = p_session_code
  AND status = 'active'
  AND NOW() BETWEEN starts_at AND ends_at;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session code');
  END IF;

  -- Check class level match
  IF v_session.class_level != p_class_level THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class level does not match this session');
  END IF;

  -- Find or create student
  SELECT * INTO v_student
  FROM public.students
  WHERE student_id = p_student_id AND (p_school_name IS NULL OR school_name = p_school_name);

  IF NOT FOUND THEN
    -- Create new student
    INSERT INTO public.students (student_id, full_name, class_level, school_name)
    VALUES (p_student_id, p_full_name, p_class_level, p_school_name)
    RETURNING * INTO v_student;
  END IF;

  -- Check if already joined
  IF EXISTS (
    SELECT 1 FROM public.session_participants
    WHERE session_id = v_session.id AND student_id = v_student.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already joined this session');
  END IF;

  -- Join session
  INSERT INTO public.session_participants (session_id, student_id)
  VALUES (v_session.id, v_student.id)
  RETURNING id INTO v_participant_id;

  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student.id,
    'session_id', v_session.id,
    'exam_id', v_session.exam_id,
    'participant_id', v_participant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all versions of create_exam_session function first
DROP FUNCTION IF EXISTS public.create_exam_session CASCADE;

-- Also create the session creation function (for completeness)
CREATE OR REPLACE FUNCTION public.create_exam_session(
  p_exam_id UUID,
  p_session_name TEXT,
  p_class_level class_level,
  p_starts_at TIMESTAMP WITH TIME ZONE,
  p_ends_at TIMESTAMP WITH TIME ZONE,
  p_max_students INTEGER DEFAULT 50,
  p_instructions TEXT DEFAULT NULL,
  p_camera_monitoring_enabled BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
  v_session_code TEXT;
  v_session_id UUID;
  v_teacher_id UUID;
BEGIN
  -- Get current teacher ID from auth context (or use NULL for testing)
  v_teacher_id := auth.uid();
  
  -- Generate unique session code
  LOOP
    v_session_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.exam_sessions WHERE session_code = v_session_code);
  END LOOP;

  -- Create session
  INSERT INTO public.exam_sessions (
    session_code, exam_id, teacher_id, session_name, class_level,
    max_students, starts_at, ends_at, instructions, camera_monitoring_enabled
  ) VALUES (
    v_session_code, p_exam_id, v_teacher_id, p_session_name, p_class_level,
    p_max_students, p_starts_at, p_ends_at, p_instructions, p_camera_monitoring_enabled
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_code', v_session_code,
    'message', 'Session created successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.join_exam_session TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_exam_session TO anon, authenticated;

-- Test the function
SELECT 'Functions created successfully!' as status;