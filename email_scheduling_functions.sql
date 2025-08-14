-- Email scheduling functions for automated result delivery

-- Function to schedule result emails
CREATE OR REPLACE FUNCTION public.schedule_result_emails(p_attempt_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_attempt student_exam_attempts%ROWTYPE;
  v_session exam_sessions%ROWTYPE;
  v_student students%ROWTYPE;
  v_teacher_student teacher_students%ROWTYPE;
  v_exam exams%ROWTYPE;
  v_result exam_results%ROWTYPE;
  v_teacher teachers%ROWTYPE;
  v_scheduled_date TIMESTAMP WITH TIME ZONE;
  v_student_email_id UUID;
  v_parent_email_id UUID;
BEGIN
  -- Get attempt details
  SELECT * INTO v_attempt FROM student_exam_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;

  -- Get session details
  SELECT * INTO v_session FROM exam_sessions WHERE id = v_attempt.session_id;
  IF NOT FOUND OR NOT v_session.auto_email_results THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or auto-email disabled');
  END IF;

  -- Get exam, student, and result details
  SELECT * INTO v_exam FROM exams WHERE id = v_attempt.exam_id;
  SELECT * INTO v_student FROM students WHERE id = v_attempt.student_id;
  SELECT * INTO v_result FROM exam_results WHERE attempt_id = p_attempt_id;
  SELECT * INTO v_teacher FROM teachers WHERE id = v_session.teacher_id;
  
  -- Get teacher_student record for additional email info
  SELECT * INTO v_teacher_student 
  FROM teacher_students 
  WHERE teacher_id = v_session.teacher_id 
    AND student_id = v_student.student_id;

  -- Calculate scheduled date
  v_scheduled_date := v_attempt.completed_at + INTERVAL '1 day' * v_session.email_delay_days;

  -- Schedule email to student (if enabled and email exists)
  IF v_session.email_to_students AND (v_student.email IS NOT NULL OR v_teacher_student.email IS NOT NULL) THEN
    INSERT INTO email_queue (
      attempt_id,
      recipient_email,
      recipient_name,
      recipient_type,
      email_subject,
      email_body,
      scheduled_at
    ) VALUES (
      p_attempt_id,
      COALESCE(v_student.email, v_teacher_student.email),
      v_student.full_name,
      'student',
      'Your ' || v_exam.title || ' Results - ' || v_student.full_name,
      'TEMPLATE:student_results', -- Will be processed by email service
      v_scheduled_date
    ) RETURNING id INTO v_student_email_id;
  END IF;

  -- Schedule email to parent (if enabled and email exists)
  IF v_session.email_to_parents AND (v_student.parent_email IS NOT NULL OR v_teacher_student.parent_email IS NOT NULL) THEN
    INSERT INTO email_queue (
      attempt_id,
      recipient_email,
      recipient_name,
      recipient_type,
      email_subject,
      email_body,
      scheduled_at
    ) VALUES (
      p_attempt_id,
      COALESCE(v_student.parent_email, v_teacher_student.parent_email),
      COALESCE(v_student.parent_name, v_teacher_student.parent_name, 'Parent/Guardian'),
      'parent',
      'Your Child''s Exam Results - ' || v_student.full_name || ' (' || v_exam.title || ')',
      'TEMPLATE:parent_results', -- Will be processed by email service
      v_scheduled_date
    ) RETURNING id INTO v_parent_email_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'scheduled_date', v_scheduled_date,
    'student_email_scheduled', v_student_email_id IS NOT NULL,
    'parent_email_scheduled', v_parent_email_id IS NOT NULL,
    'student_email_id', v_student_email_id,
    'parent_email_id', v_parent_email_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending emails for processing
CREATE OR REPLACE FUNCTION public.get_pending_emails(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  email_id UUID,
  attempt_id UUID,
  recipient_email VARCHAR,
  recipient_name VARCHAR,
  recipient_type VARCHAR,
  email_subject VARCHAR,
  email_body TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.attempt_id,
    eq.recipient_email,
    eq.recipient_name,
    eq.recipient_type,
    eq.email_subject,
    eq.email_body,
    eq.scheduled_at
  FROM email_queue eq
  WHERE eq.status = 'pending'
    AND eq.scheduled_at <= NOW()
  ORDER BY eq.scheduled_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as sent
CREATE OR REPLACE FUNCTION public.mark_email_sent(p_email_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE email_queue 
  SET 
    status = 'sent',
    sent_at = NOW(),
    updated_at = NOW()
  WHERE id = p_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as failed
CREATE OR REPLACE FUNCTION public.mark_email_failed(p_email_id UUID, p_error_message TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE email_queue 
  SET 
    status = 'failed',
    error_message = p_error_message,
    retry_count = retry_count + 1,
    updated_at = NOW()
  WHERE id = p_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically schedule emails when exam is completed
CREATE OR REPLACE FUNCTION trigger_schedule_result_emails()
RETURNS TRIGGER AS $$
BEGIN
  -- Only schedule emails when status changes to completed and session has auto-email enabled
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM schedule_result_emails(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS auto_schedule_result_emails ON student_exam_attempts;
CREATE TRIGGER auto_schedule_result_emails
  AFTER UPDATE ON student_exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_schedule_result_emails();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.schedule_result_emails TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_emails TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_sent TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_failed TO anon, authenticated;

SELECT 'Email scheduling functions created successfully!' as status;
