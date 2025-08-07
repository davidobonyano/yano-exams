-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create custom types
CREATE TYPE class_level AS ENUM ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false', 'short_answer');
CREATE TYPE exam_status AS ENUM ('not_started', 'in_progress', 'completed', 'submitted');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  class_level class_level NOT NULL,
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

-- User exam attempts table (prevent retaking)
CREATE TABLE public.user_exam_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  status exam_status DEFAULT 'not_started',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  time_remaining INTEGER, -- in seconds
  is_paused BOOLEAN DEFAULT false,
  pause_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, exam_id) -- Prevent multiple attempts
);

-- User answers table
CREATE TABLE public.user_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES public.user_exam_attempts(id) ON DELETE CASCADE NOT NULL,
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
  attempt_id UUID REFERENCES public.user_exam_attempts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
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
  attempt_id UUID REFERENCES public.user_exam_attempts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  violation_type TEXT NOT NULL, -- 'tab_switch', 'copy_attempt', 'right_click', etc.
  violation_details JSONB,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Row Level Security Policies

-- Users can only see and edit their own data
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Classes are viewable by all authenticated users
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Classes are viewable by authenticated users" ON public.classes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Exams are viewable by users of the same class level
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view exams for their class" ON public.exams
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    class_level = (SELECT class_level FROM public.users WHERE id = auth.uid())
  );

-- Questions are viewable by users taking the exam
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view questions for exams they're taking" ON public.questions
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.user_exam_attempts ua
      JOIN public.users u ON u.id = ua.user_id
      WHERE ua.user_id = auth.uid() 
      AND ua.exam_id = questions.exam_id
      AND ua.status IN ('in_progress', 'completed', 'submitted')
    )
  );

-- User exam attempts - users can only see their own
ALTER TABLE public.user_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own attempts" ON public.user_exam_attempts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON public.user_exam_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON public.user_exam_attempts
  FOR UPDATE USING (auth.uid() = user_id);

-- User answers - users can only see and modify their own
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own answers" ON public.user_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_exam_attempts ua
      WHERE ua.id = user_answers.attempt_id AND ua.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own answers" ON public.user_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_exam_attempts ua
      WHERE ua.id = user_answers.attempt_id AND ua.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own answers" ON public.user_answers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_exam_attempts ua
      WHERE ua.id = user_answers.attempt_id AND ua.user_id = auth.uid()
    )
  );

-- Exam results - users can only see their own
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own results" ON public.exam_results
  FOR SELECT USING (auth.uid() = user_id);

-- Cheating logs - users can only see their own
ALTER TABLE public.cheating_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cheating logs" ON public.cheating_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert cheating logs" ON public.cheating_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX idx_users_class_level ON public.users(class_level);
CREATE INDEX idx_exams_class_level ON public.exams(class_level);
CREATE INDEX idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX idx_user_exam_attempts_user_id ON public.user_exam_attempts(user_id);
CREATE INDEX idx_user_exam_attempts_exam_id ON public.user_exam_attempts(exam_id);
CREATE INDEX idx_user_answers_attempt_id ON public.user_answers(attempt_id);
CREATE INDEX idx_user_answers_question_id ON public.user_answers(question_id);
CREATE INDEX idx_exam_results_user_id ON public.exam_results(user_id);
CREATE INDEX idx_cheating_logs_attempt_id ON public.cheating_logs(attempt_id);