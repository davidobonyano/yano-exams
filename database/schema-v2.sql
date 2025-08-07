-- Enhanced Schema for Exam Session System
-- This replaces the previous email-based authentication with a session-based system

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create custom types
CREATE TYPE class_level AS ENUM ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false', 'short_answer');
CREATE TYPE exam_status AS ENUM ('not_started', 'in_progress', 'completed', 'submitted');
CREATE TYPE session_status AS ENUM ('active', 'paused', 'ended', 'cancelled');

-- Teachers/Admin table (still uses Supabase auth for teachers)
CREATE TABLE public.teachers (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  school_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Students table (no longer uses auth.users - purely session-based)
CREATE TABLE public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL, -- School registration number
  full_name TEXT NOT NULL,
  class_level class_level NOT NULL,
  school_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, school_name) -- Student ID unique per school
);

-- Exam sessions table (replaces direct exam access)
CREATE TABLE public.exam_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL UNIQUE, -- 6-digit code for students to join
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  session_name TEXT NOT NULL, -- e.g., "JSS1 Math - Morning Session"
  class_level class_level NOT NULL,
  max_students INTEGER DEFAULT 50,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status session_status DEFAULT 'active',
  allow_late_join BOOLEAN DEFAULT false,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Classes table
CREATE TABLE public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  level class_level NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Exams table
CREATE TABLE public.exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  class_level class_level NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_questions INTEGER NOT NULL,
  passing_score INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Questions table
CREATE TABLE public.questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'multiple_choice',
  options JSONB, -- For multiple choice options: {"A": "option1", "B": "option2", ...}
  correct_answer TEXT NOT NULL,
  points INTEGER DEFAULT 1,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Session participants (students who joined a session)
CREATE TABLE public.session_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(session_id, student_id) -- One participation per session per student
);

-- Student exam attempts (updated to use session-based auth)
CREATE TABLE public.student_exam_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  status exam_status DEFAULT 'not_started',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  time_remaining INTEGER, -- in seconds
  is_paused BOOLEAN DEFAULT false,
  pause_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(session_id, student_id, exam_id) -- One attempt per session per student per exam
);

-- Student answers table
CREATE TABLE public.student_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.student_exam_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  answer TEXT NOT NULL,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(attempt_id, question_id) -- One answer per question per attempt
);

-- Exam results table
CREATE TABLE public.exam_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.student_exam_attempts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  percentage_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Cheating detection logs
CREATE TABLE public.cheating_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.student_exam_attempts(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  violation_type TEXT NOT NULL, -- 'tab_switch', 'copy_attempt', 'right_click', etc.
  violation_details JSONB,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security Policies

-- Teachers can manage their own data
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view own profile" ON public.teachers
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Teachers can update own profile" ON public.teachers
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Teachers can insert own profile" ON public.teachers
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Students table - accessible by session participants
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own profile" ON public.students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.student_id = students.id AND sp.is_active = true
    )
  );

-- Exam sessions - teachers can manage their own, students can view active ones they're in
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own sessions" ON public.exam_sessions
  FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "Students can view sessions they joined" ON public.exam_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = exam_sessions.id AND sp.is_active = true
    )
  );

-- Classes are viewable by all authenticated users
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Classes are viewable by authenticated users" ON public.classes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Exams - teachers can manage own, students can view through sessions
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own exams" ON public.exams
  FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Students can view exams through sessions" ON public.exams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      JOIN public.session_participants sp ON sp.session_id = es.id
      WHERE es.exam_id = exams.id AND sp.is_active = true
    )
  );

-- Questions - accessible through active exam sessions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view questions during active sessions" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.exam_sessions es
      JOIN public.session_participants sp ON sp.session_id = es.id
      JOIN public.student_exam_attempts sea ON sea.session_id = es.id AND sea.student_id = sp.student_id
      WHERE es.exam_id = questions.exam_id 
      AND sp.is_active = true 
      AND sea.status IN ('in_progress', 'completed', 'submitted')
    )
  );

-- Session participants - students can view own participation
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own session participation" ON public.session_participants
  FOR SELECT USING (student_id IN (
    SELECT id FROM public.students -- Current session context
  ));

-- Student exam attempts - students can manage own attempts
ALTER TABLE public.student_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can manage own attempts" ON public.student_exam_attempts
  FOR ALL USING (student_id IN (
    SELECT id FROM public.students -- Current session context
  ));

-- Student answers - students can manage own answers
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can manage own answers" ON public.student_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.student_exam_attempts sea
      WHERE sea.id = student_answers.attempt_id 
      AND sea.student_id IN (SELECT id FROM public.students)
    )
  );

-- Exam results - students can view own results
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own results" ON public.exam_results
  FOR SELECT USING (student_id IN (
    SELECT id FROM public.students
  ));

-- Cheating logs - students can view own logs
ALTER TABLE public.cheating_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own cheating logs" ON public.cheating_logs
  FOR SELECT USING (student_id IN (
    SELECT id FROM public.students
  ));
CREATE POLICY "System can insert cheating logs" ON public.cheating_logs
  FOR INSERT WITH CHECK (student_id IN (
    SELECT id FROM public.students
  ));

-- Functions for session management
CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

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

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_exam_sessions_updated_at
  BEFORE UPDATE ON public.exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX idx_students_student_id ON public.students(student_id);
CREATE INDEX idx_students_class_level ON public.students(class_level);
CREATE INDEX idx_exam_sessions_code ON public.exam_sessions(session_code);
CREATE INDEX idx_exam_sessions_teacher ON public.exam_sessions(teacher_id);
CREATE INDEX idx_exam_sessions_status ON public.exam_sessions(status);
CREATE INDEX idx_exams_class_level ON public.exams(class_level);
CREATE INDEX idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX idx_session_participants_session ON public.session_participants(session_id);
CREATE INDEX idx_session_participants_student ON public.session_participants(student_id);
CREATE INDEX idx_student_exam_attempts_session ON public.student_exam_attempts(session_id);
CREATE INDEX idx_student_exam_attempts_student ON public.student_exam_attempts(student_id);
CREATE INDEX idx_student_answers_attempt_id ON public.student_answers(attempt_id);
CREATE INDEX idx_student_answers_question_id ON public.student_answers(question_id);
CREATE INDEX idx_exam_results_student_id ON public.exam_results(student_id);
CREATE INDEX idx_cheating_logs_attempt_id ON public.cheating_logs(attempt_id);