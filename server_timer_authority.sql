-- SERVER-SIDE TIMER AUTHORITY SYSTEM
-- Database is the absolute source of truth for exam timing
-- Students cannot manipulate the timer by refreshing, dev tools, etc.

-- 1. Update the student_exam_attempts table with core timer fields
ALTER TABLE student_exam_attempts 
ADD COLUMN IF NOT EXISTS server_start_time TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS exam_duration_seconds INTEGER DEFAULT 3600;

-- ⚠️ Remove invalid generated column if it exists
ALTER TABLE student_exam_attempts DROP COLUMN IF EXISTS server_end_time;

-- 2. Function to get REAL TIME REMAINING (server authoritative)
CREATE OR REPLACE FUNCTION get_real_time_remaining(attempt_id UUID)
RETURNS INTEGER AS $$
DECLARE
  attempt_record RECORD;
  exam_current_time TIMESTAMPTZ;  -- Renamed from current_time
  time_elapsed_seconds INTEGER;
  time_remaining_seconds INTEGER;
BEGIN
  -- Get the attempt record
  SELECT 
    server_start_time,
    exam_duration_seconds,
    status
  INTO attempt_record
  FROM student_exam_attempts 
  WHERE id = attempt_id;
  
  -- If attempt not found or completed, return 0
  IF attempt_record IS NULL OR attempt_record.status != 'in_progress' THEN
    RETURN 0;
  END IF;
  
  -- Current server time
  exam_current_time := NOW();
  
  -- Calculate elapsed time in seconds
  time_elapsed_seconds := EXTRACT(EPOCH FROM (exam_current_time - attempt_record.server_start_time))::INTEGER;
  
  -- Remaining time
  time_remaining_seconds := attempt_record.exam_duration_seconds - time_elapsed_seconds;
  
  -- Return maximum of 0 or remaining time
  RETURN GREATEST(0, time_remaining_seconds);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to check if exam time is up (server authoritative)
CREATE OR REPLACE FUNCTION is_exam_time_up(attempt_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_real_time_remaining(attempt_id) <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger function to auto-submit exams when time is up
CREATE OR REPLACE FUNCTION auto_submit_expired_exam()
RETURNS TRIGGER AS $$
BEGIN
  -- If time is up, auto-submit
  IF get_real_time_remaining(NEW.id) <= 0 AND NEW.status = 'in_progress' THEN
    NEW.status := 'submitted';
    NEW.submitted_at := NOW();
    NEW.completed_at := NOW();
    
    RAISE LOG 'AUTO-SUBMIT: Exam % expired at server time %', NEW.id, NOW();
    
    -- Notify client of auto-submission
    PERFORM pg_notify(
      'exam_auto_submitted',
      json_build_object(
        'attempt_id', NEW.id,
        'student_id', NEW.student_id,
        'submitted_at', NOW()
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the auto-submit trigger
DROP TRIGGER IF EXISTS auto_submit_expired_exam_trigger ON student_exam_attempts;
CREATE TRIGGER auto_submit_expired_exam_trigger
  BEFORE UPDATE ON student_exam_attempts
  FOR EACH ROW
  WHEN (get_real_time_remaining(NEW.id) <= 0 AND NEW.status = 'in_progress')
  EXECUTE FUNCTION auto_submit_expired_exam();

-- 5. View for real-time timer status (clients should query this)
CREATE OR REPLACE VIEW exam_timer_status AS
SELECT 
  id as attempt_id,
  student_id,
  session_id,
  exam_id,
  status,
  server_start_time,
  exam_duration_seconds,
  server_start_time + (exam_duration_seconds || ' seconds')::interval AS server_end_time,
  get_real_time_remaining(id) as time_remaining_seconds,
  is_exam_time_up(id) as is_expired,
  CASE 
    WHEN get_real_time_remaining(id) <= 0 THEN 'EXPIRED'
    WHEN get_real_time_remaining(id) <= 300 THEN 'WARNING' 
    WHEN get_real_time_remaining(id) <= 600 THEN 'CAUTION'
    ELSE 'NORMAL'
  END as timer_status,
  NOW() as server_current_time
FROM student_exam_attempts;

-- 6. Function to initialize exam with proper server timing
CREATE OR REPLACE FUNCTION start_exam_with_server_timer(
  p_session_id UUID,
  p_student_id UUID, 
  p_exam_id UUID,
  p_duration_minutes INTEGER
)
RETURNS UUID AS $$
DECLARE
  attempt_id UUID;
BEGIN
  -- Insert or update attempt with server timing
  INSERT INTO student_exam_attempts (
    session_id,
    student_id,
    exam_id,
    status,
    server_start_time,
    exam_duration_seconds,
    started_at
  ) VALUES (
    p_session_id,
    p_student_id,
    p_exam_id,
    'in_progress',
    NOW(), -- Server authoritative start time
    p_duration_minutes * 60,
    NOW()
  )
  ON CONFLICT (session_id, student_id, exam_id) 
  DO UPDATE SET
    status = 'in_progress',
    server_start_time = COALESCE(student_exam_attempts.server_start_time, NOW()),
    exam_duration_seconds = p_duration_minutes * 60,
    started_at = COALESCE(student_exam_attempts.started_at, NOW())
  RETURNING id INTO attempt_id;
  
  RETURN attempt_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Row Level Security (RLS) to prevent timer manipulation
ALTER TABLE student_exam_attempts ENABLE ROW LEVEL SECURITY;

-- Students can only see their own attempts and cannot modify timer fields
CREATE POLICY student_exam_attempts_policy ON student_exam_attempts
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid() AND server_start_time IS NOT NULL AND exam_duration_seconds IS NOT NULL);

-- Explicit deny of updates by students (so they cannot hack timer)
CREATE POLICY deny_student_updates ON student_exam_attempts
  FOR UPDATE TO authenticated
  USING (false);

-- Add comments
COMMENT ON FUNCTION get_real_time_remaining(UUID) IS 'Returns server-authoritative time remaining in seconds. Cannot be manipulated by client.';
COMMENT ON FUNCTION is_exam_time_up(UUID) IS 'Server-authoritative check if exam time has expired.';
COMMENT ON VIEW exam_timer_status IS 'Real-time view of exam timer status - clients should query this for timer updates.';
COMMENT ON FUNCTION start_exam_with_server_timer(UUID, UUID, UUID, INTEGER) IS 'Initialize exam with server-controlled timing.';