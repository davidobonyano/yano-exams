-- Manual camera control functions for teachers
-- Allows teachers to manually turn off cameras after exam submission

-- Function to manually disable camera for a specific student
CREATE OR REPLACE FUNCTION manual_disable_student_camera(
  p_attempt_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_attempt student_exam_attempts%ROWTYPE;
  v_result JSONB;
BEGIN
  -- Get the attempt details
  SELECT * INTO v_attempt 
  FROM student_exam_attempts 
  WHERE id = p_attempt_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;
  
  -- Update camera status to disabled
  UPDATE student_exam_attempts 
  SET camera_enabled = false, updated_at = NOW()
  WHERE id = p_attempt_id;
  
  -- Log the manual camera disable
  INSERT INTO camera_control_logs (
    attempt_id,
    student_id,
    session_id,
    action,
    teacher_id,
    details
  ) VALUES (
    p_attempt_id,
    v_attempt.student_id,
    v_attempt.session_id,
    'manual_disable',
    (SELECT teacher_id FROM exam_sessions WHERE id = v_attempt.session_id),
    'Camera manually disabled by teacher after exam submission'
  );
  
  -- Send notification for real-time updates
  PERFORM pg_notify(
    'camera_manual_control', 
    json_build_object(
      'action', 'disable',
      'attempt_id', p_attempt_id,
      'student_id', v_attempt.student_id,
      'session_id', v_attempt.session_id,
      'timestamp', NOW()
    )::text
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Camera disabled successfully',
    'attempt_id', p_attempt_id,
    'student_id', v_attempt.student_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manually disable all cameras in a session
CREATE OR REPLACE FUNCTION manual_disable_session_cameras(
  p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_updated_count INTEGER;
  v_session exam_sessions%ROWTYPE;
BEGIN
  -- Get session details
  SELECT * INTO v_session 
  FROM exam_sessions 
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;
  
  -- Update all cameras in the session to disabled
  UPDATE student_exam_attempts 
  SET camera_enabled = false, updated_at = NOW()
  WHERE session_id = p_session_id AND camera_enabled = true;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Log the bulk camera disable
  INSERT INTO camera_control_logs (
    session_id,
    action,
    teacher_id,
    details
  ) VALUES (
    p_session_id,
    'bulk_disable',
    v_session.teacher_id,
    format('Manually disabled %s cameras in session', v_updated_count)
  );
  
  -- Send notification for real-time updates
  PERFORM pg_notify(
    'camera_manual_control', 
    json_build_object(
      'action', 'bulk_disable',
      'session_id', p_session_id,
      'updated_count', v_updated_count,
      'timestamp', NOW()
    )::text
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Disabled %s cameras successfully', v_updated_count),
    'session_id', p_session_id,
    'updated_count', v_updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get camera status for a session
CREATE OR REPLACE FUNCTION get_session_camera_status(
  p_session_id UUID
)
RETURNS TABLE (
  attempt_id UUID,
  student_id UUID,
  student_name TEXT,
  student_school_id TEXT,
  camera_enabled BOOLEAN,
  exam_status TEXT,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sea.id as attempt_id,
    sea.student_id,
    COALESCE(s.full_name, ss.full_name) as student_name,
    COALESCE(s.student_id, ss.student_id) as student_school_id,
    sea.camera_enabled,
    sea.status as exam_status,
    sea.updated_at as last_activity
  FROM student_exam_attempts sea
  LEFT JOIN students s ON s.id = sea.student_id
  LEFT JOIN school_students ss ON ss.student_id = s.student_id
  WHERE sea.session_id = p_session_id
  ORDER BY sea.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create camera control logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS camera_control_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES student_exam_attempts(id),
  student_id UUID REFERENCES students(id),
  session_id UUID REFERENCES exam_sessions(id),
  action TEXT NOT NULL,
  teacher_id UUID REFERENCES teachers(id),
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_camera_control_logs_attempt_id ON camera_control_logs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_camera_control_logs_session_id ON camera_control_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_camera_control_logs_teacher_id ON camera_control_logs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_camera_enabled ON student_exam_attempts(camera_enabled);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION manual_disable_student_camera TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manual_disable_session_cameras TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_session_camera_status TO anon, authenticated;

-- Grant table permissions
GRANT SELECT, INSERT ON camera_control_logs TO anon, authenticated;

SELECT 'Manual camera control functions created successfully!' as status;
SELECT 'Functions available:' as function;
SELECT '- manual_disable_student_camera(attempt_id)' as function;
SELECT '- manual_disable_session_cameras(session_id)' as function;
SELECT '- get_session_camera_status(session_id)' as function;
