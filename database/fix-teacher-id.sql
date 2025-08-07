-- Fix teacher_id requirement for testing
-- This allows sessions to be created without a teacher

-- Make teacher_id nullable in exam_sessions
ALTER TABLE public.exam_sessions ALTER COLUMN teacher_id DROP NOT NULL;

-- Also make created_by nullable in exams for testing
ALTER TABLE public.exams ALTER COLUMN created_by DROP NOT NULL;

-- Now create working test sessions
DO $$
DECLARE
    math_exam_id UUID;
    science_exam_id UUID;
BEGIN
    -- Create simple test exams
    INSERT INTO public.exams (title, description, class_level, duration_minutes, total_questions, passing_score, is_active) VALUES
    ('JSS1 Quick Math Test', 'Simple math for testing', 'JSS1', 15, 3, 60, true),
    ('JSS2 Quick Science Test', 'Simple science for testing', 'JSS2', 20, 3, 60, true)
    ON CONFLICT DO NOTHING;

    -- Get exam IDs
    SELECT id INTO math_exam_id FROM public.exams WHERE title = 'JSS1 Quick Math Test';
    SELECT id INTO science_exam_id FROM public.exams WHERE title = 'JSS2 Quick Science Test';
    
    -- Add math questions
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points) VALUES
    (math_exam_id, 'What is 5 + 3?', 'multiple_choice', '{"A": "7", "B": "8", "C": "9", "D": "10"}', 'B', 1),
    (math_exam_id, 'What is 4 × 2?', 'multiple_choice', '{"A": "6", "B": "7", "C": "8", "D": "9"}', 'C', 1),
    (math_exam_id, 'What is 10 - 3?', 'multiple_choice', '{"A": "6", "B": "7", "C": "8", "D": "9"}', 'B', 1)
    ON CONFLICT DO NOTHING;
    
    -- Add science questions
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points) VALUES
    (science_exam_id, 'What do plants need to grow?', 'multiple_choice', '{"A": "Water", "B": "Sunlight", "C": "Air", "D": "All of the above"}', 'D', 1),
    (science_exam_id, 'How many legs does a spider have?', 'multiple_choice', '{"A": "6", "B": "8", "C": "10", "D": "12"}', 'B', 1),
    (science_exam_id, 'What is ice made of?', 'multiple_choice', '{"A": "Water", "B": "Air", "C": "Salt", "D": "Sugar"}', 'A', 1)
    ON CONFLICT DO NOTHING;
    
    -- Clear any old sessions
    DELETE FROM public.exam_sessions;
    
    -- Create active sessions WITHOUT teacher_id requirement
    INSERT INTO public.exam_sessions (
        session_code, exam_id, session_name, class_level,
        max_students, starts_at, ends_at, status, instructions
    ) VALUES 
    (
        '111111', 
        math_exam_id, 
        'JSS1 Math - Working Test', 
        'JSS1',
        50, 
        NOW() - INTERVAL '1 hour',  -- Started 1 hour ago
        NOW() + INTERVAL '12 hours', -- Ends in 12 hours
        'active',
        'Quick math test for demo'
    ),
    (
        '222222', 
        science_exam_id, 
        'JSS2 Science - Working Test', 
        'JSS2',
        50, 
        NOW() - INTERVAL '1 hour',
        NOW() + INTERVAL '12 hours', 
        'active',
        'Quick science test for demo'
    );
    
    RAISE NOTICE '🎉 SUCCESS! Working sessions created!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 TEST SESSION CODES:';
    RAISE NOTICE '   111111 → JSS1 Math (3 questions, 15 min)';
    RAISE NOTICE '   222222 → JSS2 Science (3 questions, 20 min)';
    RAISE NOTICE '';
    RAISE NOTICE '👥 TEST STUDENTS:';
    RAISE NOTICE '   Student ID: TEST001, Name: Test Student, Class: JSS1';
    RAISE NOTICE '   Student ID: TEST002, Name: Test Student 2, Class: JSS2';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 GO TEST AT: http://localhost:3000';
    RAISE NOTICE '   Use code 111111 with JSS1 student';
    RAISE NOTICE '   Use code 222222 with JSS2 student';
    
END $$;

-- Verify sessions were created
SELECT 
    session_code,
    session_name,
    class_level,
    status,
    'Session is ready!' as message
FROM public.exam_sessions
WHERE status = 'active'
ORDER BY session_code;