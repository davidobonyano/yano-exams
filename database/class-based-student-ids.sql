-- Enhanced Student ID Generation with CLASS-NUMBER format
-- This updates the system to generate IDs like JSS1A-001, JSS1B-015, SS2A-023, etc.

-- Drop existing function to replace it
DROP FUNCTION IF EXISTS public.generate_student_id CASCADE;
DROP FUNCTION IF EXISTS public.add_student_to_class CASCADE;

-- Create a new table to track student sequences per class level
CREATE TABLE IF NOT EXISTS public.class_student_sequences (
  class_level class_level NOT NULL,
  section CHAR(1) DEFAULT 'A', -- A, B, C, etc.
  next_number INTEGER DEFAULT 1,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (teacher_id, class_level, section)
);

-- Enhanced function to generate class-based student IDs
CREATE OR REPLACE FUNCTION public.generate_class_student_id(
  p_teacher_id UUID, 
  p_class_level class_level,
  p_section CHAR(1) DEFAULT 'A'
)
RETURNS TEXT AS $$
DECLARE
  v_next_number INTEGER;
  v_student_id TEXT;
  v_existing_count INTEGER;
BEGIN
  -- Check how many students already exist for this class/section
  SELECT COUNT(*) INTO v_existing_count
  FROM public.teacher_students
  WHERE teacher_id = p_teacher_id 
  AND class_level = p_class_level
  AND student_id LIKE p_class_level || p_section || '-%';

  -- Get or create sequence record
  INSERT INTO public.class_student_sequences (teacher_id, class_level, section, next_number)
  VALUES (p_teacher_id, p_class_level, p_section, v_existing_count + 1)
  ON CONFLICT (teacher_id, class_level, section) 
  DO UPDATE SET 
    next_number = class_student_sequences.next_number + 1,
    updated_at = NOW()
  RETURNING next_number INTO v_next_number;

  -- Format: JSS1A-001, JSS2B-015, SS3C-099, etc.
  v_student_id := p_class_level || p_section || '-' || LPAD(v_next_number::TEXT, 3, '0');

  RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to add student with class-based ID
CREATE OR REPLACE FUNCTION public.add_student_to_class(
  p_teacher_id UUID,
  p_full_name TEXT,
  p_class_level class_level,
  p_school_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_parent_name TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL,
  p_custom_prefix TEXT DEFAULT NULL, -- Will be ignored, kept for compatibility
  p_section CHAR(1) DEFAULT 'A' -- New parameter for class section
)
RETURNS JSONB AS $$
DECLARE
  v_student_id TEXT;
  v_new_student teacher_students%ROWTYPE;
  v_section CHAR(1);
BEGIN
  -- Determine section - auto-assign if not provided
  IF p_section IS NULL OR p_section = '' THEN
    -- Auto-assign section based on existing students in class
    SELECT COALESCE(
      CASE 
        WHEN COUNT(*) < 30 THEN 'A'
        WHEN COUNT(*) < 60 THEN 'B' 
        WHEN COUNT(*) < 90 THEN 'C'
        WHEN COUNT(*) < 120 THEN 'D'
        ELSE 'E'
      END, 'A'
    ) INTO v_section
    FROM public.teacher_students
    WHERE teacher_id = p_teacher_id AND class_level = p_class_level;
  ELSE
    v_section := UPPER(p_section);
  END IF;

  -- Generate class-based student ID
  v_student_id := public.generate_class_student_id(p_teacher_id, p_class_level, v_section);

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
    'student', row_to_json(v_new_student),
    'student_id', v_student_id,
    'section', v_section
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

-- Function to join session with student ID only (simplified login)
CREATE OR REPLACE FUNCTION public.join_session_by_student_id(
  p_session_code TEXT,
  p_student_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_session exam_sessions%ROWTYPE;
  v_student teacher_students%ROWTYPE;
  v_exam exams%ROWTYPE;
  v_existing_participant UUID;
  v_participant_id UUID;
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

  -- Find the student by student_id
  SELECT * INTO v_student
  FROM public.teacher_students
  WHERE student_id = p_student_id
  AND teacher_id = v_session.teacher_id
  AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student ID not found or not active');
  END IF;

  -- Check class level match
  IF v_student.class_level != v_session.class_level THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student class level does not match session');
  END IF;

  -- Get exam details
  SELECT * INTO v_exam
  FROM public.exams
  WHERE id = v_session.exam_id;

  -- Check if student already has a participant record
  SELECT sp.id INTO v_existing_participant
  FROM public.session_participants sp
  JOIN public.students s ON s.id = sp.student_id
  WHERE sp.session_id = v_session.id 
  AND s.student_id = p_student_id;

  IF v_existing_participant IS NOT NULL THEN
    -- Student already joined, return existing participation
    RETURN jsonb_build_object(
      'success', true,
      'already_joined', true,
      'student_name', v_student.full_name,
      'session_id', v_session.id,
      'exam_id', v_session.exam_id,
      'exam_title', v_exam.title,
      'duration_minutes', v_exam.duration_minutes,
      'participant_id', v_existing_participant,
      'student_id', v_student.id
    );
  END IF;

  -- Create student record in main students table if needed
  INSERT INTO public.students (student_id, full_name, class_level, school_name)
  VALUES (v_student.student_id, v_student.full_name, v_student.class_level, v_student.school_name)
  ON CONFLICT (student_id, school_name) DO UPDATE SET
    full_name = v_student.full_name,
    class_level = v_student.class_level;

  -- Join the session
  INSERT INTO public.session_participants (session_id, student_id)
  SELECT v_session.id, students.id
  FROM public.students students
  WHERE students.student_id = p_student_id
  AND (v_student.school_name IS NULL OR students.school_name = v_student.school_name)
  RETURNING public.session_participants.id INTO v_participant_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_joined', false,
    'student_name', v_student.full_name,
    'session_id', v_session.id,
    'exam_id', v_session.exam_id,
    'exam_title', v_exam.title,
    'duration_minutes', v_exam.duration_minutes,
    'instructions', v_session.instructions,
    'participant_id', v_participant_id,
    'student_id', (SELECT students.id FROM public.students students WHERE students.student_id = p_student_id LIMIT 1)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to join session: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get student exam status
CREATE OR REPLACE FUNCTION public.get_student_exam_status(
  p_session_id UUID,
  p_student_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_attempt student_exam_attempts%ROWTYPE;
  v_student students%ROWTYPE;
  v_result exam_results%ROWTYPE;
BEGIN
  -- Find student
  SELECT * INTO v_student
  FROM public.students
  WHERE student_id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not found');
  END IF;

  -- Find attempt
  SELECT * INTO v_attempt
  FROM public.student_exam_attempts
  WHERE session_id = p_session_id AND student_id = v_student.id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'not_started',
      'can_start', true
    );
  END IF;

  -- Get result if completed
  IF v_attempt.status IN ('completed', 'submitted') THEN
    SELECT * INTO v_result
    FROM public.exam_results
    WHERE attempt_id = v_attempt.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_attempt.status,
    'attempt_id', v_attempt.id,
    'started_at', v_attempt.started_at,
    'time_remaining', v_attempt.time_remaining,
    'current_question_index', v_attempt.current_question_index,
    'can_resume', v_attempt.status = 'in_progress',
    'result', CASE 
      WHEN v_result.id IS NOT NULL THEN row_to_json(v_result)
      ELSE NULL
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS and set policies
ALTER TABLE public.class_student_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage class sequences" ON public.class_student_sequences FOR ALL USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_class_student_sequences_teacher_class ON public.class_student_sequences(teacher_id, class_level);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student_id ON public.teacher_students(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_class_section ON public.teacher_students(class_level, substring(student_id from '^[A-Z0-9]+([A-Z])'));

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_class_student_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_session_by_student_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_exam_status TO anon, authenticated;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS handle_class_student_sequences_updated_at ON public.class_student_sequences;
CREATE TRIGGER handle_class_student_sequences_updated_at
  BEFORE UPDATE ON public.class_student_sequences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

SELECT 'Class-based student ID system implemented successfully!' as status;