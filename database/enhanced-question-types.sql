-- Add support for fill-in-the-gap and subjective questions
-- Update the question_type enum to include new types

-- First, add the new values to the enum
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'fill_in_gap';
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'subjective';

-- Function to delete ended exams
CREATE OR REPLACE FUNCTION public.delete_ended_exam(p_exam_id UUID, p_teacher_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_exam exams%ROWTYPE;
  v_active_sessions INTEGER;
BEGIN
  -- Check if exam exists and belongs to teacher
  SELECT * INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id AND created_by = p_teacher_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found or access denied');
  END IF;

  -- Check if there are any active sessions for this exam
  SELECT COUNT(*) INTO v_active_sessions
  FROM public.exam_sessions
  WHERE exam_id = p_exam_id 
  AND status IN ('active', 'paused')
  AND NOW() < ends_at;

  IF v_active_sessions > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete exam with active sessions');
  END IF;

  -- Delete the exam (CASCADE will handle related records)
  DELETE FROM public.exams WHERE id = p_exam_id;

  RETURN jsonb_build_object('success', true, 'message', 'Exam deleted successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create demo exam
CREATE OR REPLACE FUNCTION public.create_demo_exam(p_teacher_id UUID, p_class_level class_level)
RETURNS JSONB AS $$
DECLARE
  v_exam_id UUID;
  v_demo_questions JSONB[];
BEGIN
  -- Create demo exam
  INSERT INTO public.exams (
    title,
    description,
    class_level,
    duration_minutes,
    total_questions,
    passing_score,
    is_active,
    created_by
  ) VALUES (
    'Demo Exam - ' || p_class_level,
    'This is a demonstration exam with sample questions to test the system.',
    p_class_level,
    15, -- 15 minutes
    5,  -- 5 questions
    60, -- 60% passing score
    true,
    p_teacher_id
  ) RETURNING id INTO v_exam_id;

  -- Create sample questions
  v_demo_questions := ARRAY[
    jsonb_build_object(
      'question_text', 'What is the capital of Nigeria?',
      'question_type', 'multiple_choice',
      'options', jsonb_build_object('A', 'Lagos', 'B', 'Abuja', 'C', 'Kano', 'D', 'Port Harcourt'),
      'correct_answer', 'B',
      'points', 2,
      'explanation', 'Abuja is the capital city of Nigeria, located in the Federal Capital Territory.'
    ),
    jsonb_build_object(
      'question_text', 'Nigeria gained independence in 1960.',
      'question_type', 'true_false',
      'options', jsonb_build_object('A', 'True', 'B', 'False'),
      'correct_answer', 'A',
      'points', 1,
      'explanation', 'Nigeria gained independence from Britain on October 1, 1960.'
    ),
    jsonb_build_object(
      'question_text', 'Fill in the gap: The longest river in Nigeria is the _____ River.',
      'question_type', 'fill_in_gap',
      'options', null,
      'correct_answer', 'Niger',
      'points', 2,
      'explanation', 'The Niger River is the longest river in Nigeria and the third longest river in Africa.'
    ),
    jsonb_build_object(
      'question_text', 'What is 15 + 27?',
      'question_type', 'short_answer',
      'options', null,
      'correct_answer', '42',
      'points', 1,
      'explanation', '15 + 27 = 42'
    ),
    jsonb_build_object(
      'question_text', 'Explain the importance of education in personal development. (Write at least 3 sentences)',
      'question_type', 'subjective',
      'options', null,
      'correct_answer', 'Sample answer: Education plays a crucial role in personal development by expanding knowledge and critical thinking skills. It provides individuals with the tools needed to understand the world around them and make informed decisions. Furthermore, education opens up opportunities for career advancement and helps develop social skills through interaction with peers and teachers.',
      'points', 3,
      'explanation', 'This is a subjective question that should be graded based on content quality, coherence, and relevance to the topic.'
    )
  ];

  -- Insert demo questions
  FOR i IN 1..array_length(v_demo_questions, 1) LOOP
    INSERT INTO public.questions (
      exam_id,
      question_text,
      question_type,
      options,
      correct_answer,
      points,
      explanation
    ) VALUES (
      v_exam_id,
      (v_demo_questions[i]->>'question_text')::TEXT,
      (v_demo_questions[i]->>'question_type')::question_type,
      (v_demo_questions[i]->'options'),
      (v_demo_questions[i]->>'correct_answer')::TEXT,
      (v_demo_questions[i]->>'points')::INTEGER,
      (v_demo_questions[i]->>'explanation')::TEXT
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'exam_id', v_exam_id,
    'message', 'Demo exam created successfully with ' || array_length(v_demo_questions, 1) || ' sample questions'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.delete_ended_exam TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_demo_exam TO anon, authenticated;

SELECT 'Enhanced question types and admin functions added successfully!' as status;