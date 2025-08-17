-- Nuclear camera shutdown trigger for immediate camera light OFF
-- This ensures camera status is immediately disabled when exam is completed

-- First, create a function to handle immediate camera shutdown
CREATE OR REPLACE FUNCTION nuclear_camera_shutdown()
RETURNS TRIGGER AS $$
BEGIN
  -- If exam status changes to 'completed', immediately disable camera
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.camera_enabled = false;
    
    -- Log the nuclear shutdown
    RAISE LOG 'NUCLEAR CAMERA SHUTDOWN: Student % exam completed, camera force disabled', NEW.student_id;
    
    -- Send immediate notification via pg_notify for real-time shutdown
    PERFORM pg_notify(
      'camera_nuclear_shutdown', 
      json_build_object(
        'student_id', NEW.student_id,
        'session_id', NEW.session_id,
        'attempt_id', NEW.id,
        'timestamp', NOW()
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires BEFORE update to immediately disable camera
DROP TRIGGER IF EXISTS nuclear_camera_shutdown_trigger ON student_exam_attempts;
CREATE TRIGGER nuclear_camera_shutdown_trigger
  BEFORE UPDATE ON student_exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION nuclear_camera_shutdown();

-- Create an additional cleanup function that can be called manually
CREATE OR REPLACE FUNCTION force_disable_all_cameras(session_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE student_exam_attempts 
  SET camera_enabled = false 
  WHERE session_id = session_id_param;
  
  RAISE LOG 'NUCLEAR: Force disabled all cameras for session %', session_id_param;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION nuclear_camera_shutdown() IS 'Immediately disables camera when exam is completed';
COMMENT ON FUNCTION force_disable_all_cameras(UUID) IS 'Emergency function to disable all cameras in a session';
