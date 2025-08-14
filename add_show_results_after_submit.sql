-- Add show_results_after_submit column to exam_sessions table (only if it doesn't exist)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'exam_sessions' 
                   AND column_name = 'show_results_after_submit') THEN
        ALTER TABLE exam_sessions 
        ADD COLUMN show_results_after_submit BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Update existing sessions to not show results by default (maintaining current behavior)
UPDATE exam_sessions SET show_results_after_submit = FALSE WHERE show_results_after_submit IS NULL;

-- Create the generate_session_code function if it doesn't exist
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
  v_code VARCHAR(6);
  v_exists BOOLEAN;
  v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric code
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || SUBSTRING(v_chars FROM FLOOR(RANDOM() * LENGTH(v_chars) + 1)::INTEGER FOR 1);
    END LOOP;
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM exam_sessions WHERE session_code = v_code) INTO v_exists;
    
    -- If code doesn't exist, we can use it
    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Drop the old function first to avoid conflicts
DROP FUNCTION IF EXISTS create_exam_session(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS create_exam_session(UUID, VARCHAR, class_level, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS create_exam_session(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS create_exam_session(UUID, VARCHAR, class_level, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT, BOOLEAN);

-- Create the create_exam_session function with the new parameter
CREATE OR REPLACE FUNCTION create_exam_session(
  p_exam_id UUID,
  p_session_name VARCHAR(255),
  p_class_level class_level,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_max_students INTEGER,
  p_instructions TEXT DEFAULT NULL,
  p_camera_monitoring_enabled BOOLEAN DEFAULT FALSE,
  p_show_results_after_submit BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_teacher_id UUID;
  v_session_code VARCHAR(6);
  v_session_id UUID;
  v_result JSON;
BEGIN
  -- Get the authenticated user
  SELECT auth.uid() INTO v_teacher_id;
  
  IF v_teacher_id IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Not authenticated'
    );
  END IF;

  -- Generate unique session code
  v_session_code := generate_session_code();
  
  -- Create the exam session
  INSERT INTO exam_sessions (
    exam_id, 
    teacher_id, 
    session_name, 
    session_code, 
    class_level, 
    starts_at, 
    ends_at, 
    max_students, 
    instructions, 
    camera_monitoring_enabled,
    show_results_after_submit,
    status
  ) VALUES (
    p_exam_id, 
    v_teacher_id, 
    p_session_name, 
    v_session_code, 
    p_class_level, 
    p_starts_at, 
    p_ends_at, 
    p_max_students, 
    p_instructions, 
    p_camera_monitoring_enabled,
    p_show_results_after_submit,
    'active'
  )
  RETURNING id INTO v_session_id;

  -- Return success with session details
  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_code', v_session_code,
    'message', 'Session created successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM
    );
END;
$$;
