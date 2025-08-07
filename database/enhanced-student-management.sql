-- Enhanced Student Management System
-- Adds comprehensive student management, tracking, and scoring features

-- Create handle_updated_at function for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add camera monitoring support to exam_sessions table
ALTER TABLE public.exam_sessions 
ADD COLUMN IF NOT EXISTS camera_monitoring_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS camera_access_required BOOLEAN DEFAULT FALSE;

-- Create student management table for teachers
CREATE TABLE IF NOT EXISTS public.teacher_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT NOT NULL, -- Auto-generated format: SCH001, SCH002, etc.
  full_name TEXT NOT NULL,
  class_level class_level NOT NULL,
  school_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,  
  parent_name TEXT,
  parent_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(teacher_id, student_id), -- Student ID unique per teacher
  UNIQUE(teacher_id, full_name, class_level) -- Prevent duplicate names in same class
);

-- Create sequence for auto student ID generation per teacher
CREATE TABLE IF NOT EXISTS public.teacher_student_sequences (
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE PRIMARY KEY,
  next_number INTEGER DEFAULT 1,
  prefix TEXT DEFAULT 'STU', -- Can be customized per teacher
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enhanced student exam attempts with real-time tracking
ALTER TABLE public.student_exam_attempts ADD COLUMN IF NOT EXISTS started_by_teacher_student_id UUID REFERENCES public.teacher_students(id);
ALTER TABLE public.student_exam_attempts ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0;
ALTER TABLE public.student_exam_attempts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE public.student_exam_attempts ADD COLUMN IF NOT EXISTS browser_info JSONB;
ALTER TABLE public.student_exam_attempts ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE public.student_exam_attempts ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;
ALTER TABLE public.student_exam_attempts ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE public.student_exam_attempts ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT false;

-- Enhanced cheating logs with more details
ALTER TABLE public.cheating_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'low'; -- low, medium, high, critical
ALTER TABLE public.cheating_logs ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
ALTER TABLE public.cheating_logs ADD COLUMN IF NOT EXISTS browser_data JSONB;
ALTER TABLE public.cheating_logs ADD COLUMN IF NOT EXISTS teacher_notified BOOLEAN DEFAULT false;
ALTER TABLE public.cheating_logs ADD COLUMN IF NOT EXISTS teacher_action TEXT; -- ignored, warned, flagged, disqualified

-- Student warnings table for real-time teacher warnings
CREATE TABLE IF NOT EXISTS public.student_warnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.student_exam_attempts(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.teacher_students(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  acknowledged BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Real-time session monitoring
CREATE TABLE IF NOT EXISTS public.session_live_stats (
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE PRIMARY KEY,
  total_participants INTEGER DEFAULT 0,
  active_participants INTEGER DEFAULT 0,
  completed_participants INTEGER DEFAULT 0,
  flagged_participants INTEGER DEFAULT 0,
  cheating_incidents INTEGER DEFAULT 0,
  average_completion_time INTERVAL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS public.generate_student_id CASCADE;
DROP FUNCTION IF EXISTS public.add_student_to_class CASCADE;
DROP FUNCTION IF EXISTS public.start_exam_attempt CASCADE;
DROP FUNCTION IF EXISTS public.log_cheating_incident CASCADE;
DROP FUNCTION IF EXISTS public.calculate_exam_score CASCADE;

-- Function to generate next student ID for a teacher
CREATE OR REPLACE FUNCTION public.generate_student_id(p_teacher_id UUID, p_custom_prefix TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_sequence_record teacher_student_sequences%ROWTYPE;
  v_next_number INTEGER;
  v_prefix TEXT;
  v_student_id TEXT;
BEGIN
  -- Get or create sequence record for teacher
  SELECT * INTO v_sequence_record
  FROM public.teacher_student_sequences
  WHERE teacher_id = p_teacher_id;

  IF NOT FOUND THEN
    -- Create new sequence for teacher
    INSERT INTO public.teacher_student_sequences (teacher_id, prefix)
    VALUES (p_teacher_id, COALESCE(p_custom_prefix, 'STU'))
    RETURNING * INTO v_sequence_record;
  END IF;

  v_next_number := v_sequence_record.next_number;
  v_prefix := COALESCE(p_custom_prefix, v_sequence_record.prefix);

  -- Format: PREFIX001, PREFIX002, etc.
  v_student_id := v_prefix || LPAD(v_next_number::TEXT, 3, '0');

  -- Update sequence
  UPDATE public.teacher_student_sequences
  SET next_number = next_number + 1,
      updated_at = NOW()
  WHERE teacher_id = p_teacher_id;

  RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add student to teacher's class
CREATE OR REPLACE FUNCTION public.add_student_to_class(
  p_teacher_id UUID,
  p_full_name TEXT,
  p_class_level class_level,
  p_school_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_parent_name TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL,
  p_custom_prefix TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_student_id TEXT;
  v_new_student teacher_students%ROWTYPE;
BEGIN
  -- Generate student ID
  v_student_id := public.generate_student_id(p_teacher_id, p_custom_prefix);

  -- Insert student
  INSERT INTO public.teacher_students (
    teacher_id,
    student_id,
    full_name,
    class_level,
    school_name,
    email,
    phone,
    parent_name,
    parent_phone
  ) VALUES (
    p_teacher_id,
    v_student_id,
    p_full_name,
    p_class_level,
    p_school_name,
    p_email,
    p_phone,
    p_parent_name,
    p_parent_phone
  ) RETURNING * INTO v_new_student;

  RETURN jsonb_build_object(
    'success', true,
    'student', row_to_json(v_new_student)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student with this name already exists in this class'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start exam attempt with tracking
CREATE OR REPLACE FUNCTION public.start_exam_attempt(
  p_session_id UUID,
  p_student_id UUID,
  p_browser_info JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_session exam_sessions%ROWTYPE;
  v_exam exams%ROWTYPE;
  v_attempt_id UUID;
  v_teacher_student_id UUID;
BEGIN
  -- Get session info
  SELECT es.* INTO v_session
  FROM public.exam_sessions es
  WHERE es.id = p_session_id AND es.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or not active');
  END IF;

  -- Get exam info
  SELECT e.* INTO v_exam
  FROM public.exams e
  WHERE e.id = v_session.exam_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found');
  END IF;

  -- Get teacher student ID if exists
  SELECT ts.id INTO v_teacher_student_id
  FROM public.teacher_students ts
  JOIN public.students s ON s.student_id = ts.student_id
  WHERE s.id = p_student_id AND ts.teacher_id = v_session.teacher_id;

  -- Create or update exam attempt
  INSERT INTO public.student_exam_attempts (
    session_id,
    student_id,
    exam_id,
    started_by_teacher_student_id,
    status,
    started_at,
    time_remaining,
    browser_info,
    ip_address,
    last_activity_at
  ) VALUES (
    p_session_id,
    p_student_id,
    v_exam.id,
    v_teacher_student_id,
    'in_progress',
    NOW(),
    v_exam.duration_minutes * 60, -- Convert to seconds
    p_browser_info,
    p_ip_address,
    NOW()
  ) ON CONFLICT (session_id, student_id, exam_id) 
  DO UPDATE SET
    status = 'in_progress',
    started_at = NOW(),
    time_remaining = v_exam.duration_minutes * 60,
    browser_info = p_browser_info,
    ip_address = p_ip_address,
    last_activity_at = NOW()
  RETURNING id INTO v_attempt_id;

  -- Update live stats
  INSERT INTO public.session_live_stats (session_id, total_participants, active_participants)
  VALUES (p_session_id, 1, 1)
  ON CONFLICT (session_id) DO UPDATE SET
    total_participants = (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = p_session_id
    ),
    active_participants = (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = p_session_id AND status = 'in_progress'
    ),
    last_updated = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'attempt_id', v_attempt_id,
    'time_remaining', v_exam.duration_minutes * 60
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log cheating incident
CREATE OR REPLACE FUNCTION public.log_cheating_incident(
  p_attempt_id UUID,
  p_violation_type TEXT,
  p_violation_details JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'low',
  p_screenshot_url TEXT DEFAULT NULL,
  p_browser_data JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_attempt student_exam_attempts%ROWTYPE;
  v_warning_count INTEGER;
  v_should_flag BOOLEAN := false;
BEGIN
  -- Get attempt details
  SELECT * INTO v_attempt FROM public.student_exam_attempts WHERE id = p_attempt_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;

  -- Insert cheating log
  INSERT INTO public.cheating_logs (
    attempt_id,
    student_id,
    session_id,
    violation_type,
    violation_details,
    severity,
    screenshot_url,
    browser_data
  ) VALUES (
    p_attempt_id,
    v_attempt.student_id,
    v_attempt.session_id,
    p_violation_type,
    p_violation_details,
    p_severity,
    p_screenshot_url,
    p_browser_data
  );

  -- Update warning count and check if should flag
  UPDATE public.student_exam_attempts
  SET 
    warning_count = warning_count + 1,
    last_activity_at = NOW(),
    is_flagged = CASE 
      WHEN p_severity = 'critical' THEN true
      WHEN p_severity = 'high' AND warning_count >= 2 THEN true
      WHEN warning_count >= 4 THEN true
      ELSE is_flagged
    END
  WHERE id = p_attempt_id
  RETURNING warning_count, is_flagged INTO v_warning_count, v_should_flag;

  -- Update session live stats
  UPDATE public.session_live_stats
  SET 
    cheating_incidents = cheating_incidents + 1,
    flagged_participants = (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = v_attempt.session_id AND is_flagged = true
    ),
    last_updated = NOW()
  WHERE session_id = v_attempt.session_id;

  RETURN jsonb_build_object(
    'success', true,
    'warning_count', v_warning_count,
    'is_flagged', v_should_flag,
    'action_required', CASE 
      WHEN v_should_flag THEN 'flag_student'
      WHEN v_warning_count >= 3 THEN 'warn_student'
      ELSE 'monitor'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate and save exam score
CREATE OR REPLACE FUNCTION public.calculate_exam_score(p_attempt_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_attempt student_exam_attempts%ROWTYPE;
  v_exam exams%ROWTYPE;
  v_total_questions INTEGER;
  v_correct_answers INTEGER;
  v_total_points INTEGER;
  v_points_earned INTEGER;
  v_percentage_score DECIMAL(5,2);
  v_passed BOOLEAN;
  v_result_id UUID;
BEGIN
  -- Get attempt details
  SELECT sea.* INTO v_attempt
  FROM public.student_exam_attempts sea
  WHERE sea.id = p_attempt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;

  -- Get exam details
  SELECT e.* INTO v_exam
  FROM public.exams e
  WHERE e.id = v_attempt.exam_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found');
  END IF;

  -- Calculate scores
  SELECT 
    COUNT(*) as total_questions,
    COUNT(*) FILTER (WHERE sa.is_correct = true) as correct_answers,
    SUM(q.points) as total_points,
    SUM(CASE WHEN sa.is_correct = true THEN q.points ELSE 0 END) as points_earned
  INTO v_total_questions, v_correct_answers, v_total_points, v_points_earned
  FROM public.student_answers sa
  JOIN public.questions q ON q.id = sa.question_id
  WHERE sa.attempt_id = p_attempt_id;

  -- Calculate percentage
  v_percentage_score := CASE 
    WHEN v_total_points > 0 THEN (v_points_earned::DECIMAL / v_total_points::DECIMAL) * 100
    ELSE 0
  END;

  -- Determine if passed
  v_passed := v_percentage_score >= v_exam.passing_score;

  -- Insert or update result
  INSERT INTO public.exam_results (
    attempt_id,
    student_id,
    session_id,
    exam_id,
    total_questions,
    correct_answers,
    total_points,
    points_earned,
    percentage_score,
    passed
  ) VALUES (
    p_attempt_id,
    v_attempt.student_id,
    v_attempt.session_id,
    v_attempt.exam_id,
    v_total_questions,
    v_correct_answers,
    v_total_points,
    v_points_earned,
    v_percentage_score,
    v_passed
  ) ON CONFLICT (attempt_id) DO UPDATE SET
    total_questions = v_total_questions,
    correct_answers = v_correct_answers,
    total_points = v_total_points,
    points_earned = v_points_earned,
    percentage_score = v_percentage_score,
    passed = v_passed
  RETURNING id INTO v_result_id;

  -- Update attempt status
  UPDATE public.student_exam_attempts
  SET 
    status = 'completed',
    completed_at = NOW(),
    submitted_at = NOW()
  WHERE id = p_attempt_id;

  -- Update live stats
  UPDATE public.session_live_stats
  SET 
    completed_participants = (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = v_attempt.session_id AND status IN ('completed', 'submitted')
    ),
    active_participants = (
      SELECT COUNT(*) FROM public.student_exam_attempts 
      WHERE session_id = v_attempt.session_id AND status = 'in_progress'
    ),
    average_completion_time = (
      SELECT AVG(completed_at - started_at) 
      FROM public.student_exam_attempts 
      WHERE session_id = v_attempt.session_id AND completed_at IS NOT NULL
    ),
    last_updated = NOW()
  WHERE session_id = v_attempt.session_id;

  RETURN jsonb_build_object(
    'success', true,
    'result_id', v_result_id,
    'total_questions', v_total_questions,
    'correct_answers', v_correct_answers,
    'total_points', v_total_points,
    'points_earned', v_points_earned,
    'percentage_score', v_percentage_score,
    'passed', v_passed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher_id ON public.teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_class_level ON public.teacher_students(class_level);
CREATE INDEX IF NOT EXISTS idx_teacher_students_active ON public.teacher_students(is_active);
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_last_activity ON public.student_exam_attempts(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_status ON public.student_exam_attempts(status);
CREATE INDEX IF NOT EXISTS idx_cheating_logs_severity ON public.cheating_logs(severity);
CREATE INDEX IF NOT EXISTS idx_cheating_logs_session_id ON public.cheating_logs(session_id);

-- Enable RLS on new tables
ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage own students" ON public.teacher_students;
CREATE POLICY "Teachers can manage own students" ON public.teacher_students FOR ALL USING (true);

ALTER TABLE public.teacher_student_sequences ENABLE ROW LEVEL SECURITY; 
DROP POLICY IF EXISTS "Teachers can access own sequences" ON public.teacher_student_sequences;
CREATE POLICY "Teachers can access own sequences" ON public.teacher_student_sequences FOR ALL USING (true);

ALTER TABLE public.session_live_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to live stats" ON public.session_live_stats;
CREATE POLICY "Allow all access to live stats" ON public.session_live_stats FOR ALL USING (true);

ALTER TABLE public.student_warnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers can manage warnings" ON public.student_warnings;
CREATE POLICY "Teachers can manage warnings" ON public.student_warnings FOR ALL USING (true);

DROP POLICY IF EXISTS "Students can view own warnings" ON public.student_warnings;
CREATE POLICY "Students can view own warnings" ON public.student_warnings FOR SELECT USING (true);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_student_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_student_to_class TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_exam_attempt TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_cheating_incident TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_exam_score TO anon, authenticated;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS handle_teacher_students_updated_at ON public.teacher_students;
CREATE TRIGGER handle_teacher_students_updated_at
  BEFORE UPDATE ON public.teacher_students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_teacher_student_sequences_updated_at ON public.teacher_student_sequences;
CREATE TRIGGER handle_teacher_student_sequences_updated_at
  BEFORE UPDATE ON public.teacher_student_sequences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS handle_student_warnings_updated_at ON public.student_warnings;
CREATE TRIGGER handle_student_warnings_updated_at
  BEFORE UPDATE ON public.student_warnings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

SELECT 'Enhanced student management system installed successfully!' as status;