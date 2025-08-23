-- Fix camera shutdown after exam submission
-- This ensures cameras are properly turned off when students submit exams

-- First, make sure the camera_enabled column exists
ALTER TABLE public.student_exam_attempts 
ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT false;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS nuclear_camera_shutdown_trigger ON student_exam_attempts;

-- Create the nuclear camera shutdown function
CREATE OR REPLACE FUNCTION nuclear_camera_shutdown()
RETURNS TRIGGER AS $$
BEGIN
  -- If exam status changes to 'completed' OR 'submitted', immediately disable camera
  IF (NEW.status IN ('completed', 'submitted')) AND (OLD.status NOT IN ('completed', 'submitted')) THEN
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
CREATE TRIGGER nuclear_camera_shutdown_trigger
  BEFORE UPDATE ON student_exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION nuclear_camera_shutdown();

-- Also add a function to manually fix any stuck cameras
CREATE OR REPLACE FUNCTION fix_stuck_cameras()
RETURNS JSONB AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Find and disable cameras for completed exams that still have camera_enabled = true
  UPDATE student_exam_attempts 
  SET camera_enabled = false, updated_at = NOW()
  WHERE status IN ('completed', 'submitted') AND camera_enabled = true;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Fixed %s stuck cameras', v_updated_count),
    'updated_count', v_updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION fix_stuck_cameras TO anon, authenticated;

-- Run the fix function to clean up any existing stuck cameras
SELECT fix_stuck_cameras();

SELECT 'Camera shutdown trigger fixed successfully!' as status;
SELECT 'Features:' as feature;
SELECT '- Automatic camera disable on exam submission' as feature;
SELECT '- Real-time notifications for camera shutdown' as feature;
SELECT '- Function to fix stuck cameras' as feature; 