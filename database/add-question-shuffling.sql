-- Add question shuffling support to the database
-- This ensures each student gets a unique, consistent question order

-- Create table to store question order per student per exam
CREATE TABLE IF NOT EXISTS public.student_question_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  question_order JSONB NOT NULL, -- Array of question IDs in shuffled order
  option_mappings JSONB NOT NULL DEFAULT '{}', -- Maps question_id -> {original_option -> shuffled_option}
  seed INTEGER NOT NULL, -- Seed used for shuffling (for debugging)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, exam_id, session_id) -- One order per student per exam per session
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_question_orders_student ON public.student_question_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_student_question_orders_exam ON public.student_question_orders(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_question_orders_session ON public.student_question_orders(session_id);

-- RLS Policy for question orders
ALTER TABLE public.student_question_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on question orders" ON public.student_question_orders FOR ALL USING (true);

-- Function to get or create shuffled questions for a student
CREATE OR REPLACE FUNCTION public.get_shuffled_questions_for_student(
  p_student_id UUID,
  p_exam_id UUID,
  p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_existing_order student_question_orders%ROWTYPE;
  v_questions JSONB;
  v_shuffled_questions JSONB;
  v_seed INTEGER;
BEGIN
  -- Check if we already have a question order for this student
  SELECT * INTO v_existing_order
  FROM public.student_question_orders
  WHERE student_id = p_student_id 
    AND exam_id = p_exam_id 
    AND session_id = p_session_id;

  IF FOUND THEN
    -- Return existing shuffled questions
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'question_type', q.question_type,
        'options', CASE 
          WHEN q.question_type = 'multiple_choice' AND v_existing_order.option_mappings ? q.id::text
          THEN (
            SELECT jsonb_object_agg(
              new_key, 
              q.options->original_key
            )
            FROM jsonb_each_text(v_existing_order.option_mappings->q.id::text) AS mapping(original_key, new_key)
          )
          ELSE q.options
        END,
        'points', q.points,
        'explanation', q.explanation,
        'original_correct_answer', q.correct_answer,
        'shuffled_correct_answer', CASE 
          WHEN q.question_type = 'multiple_choice' AND v_existing_order.option_mappings ? q.id::text
          THEN v_existing_order.option_mappings->q.id::text->>q.correct_answer
          ELSE q.correct_answer
        END
      ) ORDER BY array_position(
        ARRAY(SELECT jsonb_array_elements_text(v_existing_order.question_order)), 
        q.id::text
      )
    ) INTO v_shuffled_questions
    FROM public.questions q
    WHERE q.exam_id = p_exam_id
      AND q.id::text = ANY(ARRAY(SELECT jsonb_array_elements_text(v_existing_order.question_order)));

    RETURN jsonb_build_object(
      'questions', v_shuffled_questions,
      'seed', v_existing_order.seed,
      'cached', true
    );
  END IF;

  -- Generate new shuffled order
  -- Get all questions for the exam
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'question_text', question_text,
      'question_type', question_type,
      'options', options,
      'correct_answer', correct_answer,
      'points', points,
      'explanation', explanation
    )
  ) INTO v_questions
  FROM public.questions
  WHERE exam_id = p_exam_id
  ORDER BY created_at;

  -- Generate seed based on student and exam
  SELECT ABS(hashtext(p_student_id::text || '-' || p_exam_id::text)) INTO v_seed;

  -- The actual shuffling will be done in the application layer
  -- For now, just store the original order and let the app handle shuffling
  INSERT INTO public.student_question_orders (
    student_id,
    exam_id, 
    session_id,
    question_order,
    option_mappings,
    seed
  ) VALUES (
    p_student_id,
    p_exam_id,
    p_session_id,
    (SELECT jsonb_agg(q.id) FROM public.questions q WHERE q.exam_id = p_exam_id ORDER BY created_at),
    '{}',
    v_seed
  );

  RETURN jsonb_build_object(
    'questions', v_questions,
    'seed', v_seed,
    'cached', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update shuffled question order (called from app after shuffling)
CREATE OR REPLACE FUNCTION public.update_shuffled_question_order(
  p_student_id UUID,
  p_exam_id UUID,
  p_session_id UUID,
  p_question_order JSONB,
  p_option_mappings JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.student_question_orders
  SET 
    question_order = p_question_order,
    option_mappings = p_option_mappings
  WHERE student_id = p_student_id 
    AND exam_id = p_exam_id 
    AND session_id = p_session_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_shuffled_questions_for_student TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shuffled_question_order TO anon, authenticated;

SELECT 'Question shuffling support added successfully!' as status;