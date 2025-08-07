-- Test Data WITHOUT Teacher Account Required
-- This creates sample exams and sessions that students can join immediately

DO $$
DECLARE
    jss1_math_exam_id UUID;
    jss1_english_exam_id UUID;
    jss2_science_exam_id UUID;
BEGIN
    -- Create sample exams (without teacher requirement)
    INSERT INTO public.exams (title, description, class_level, duration_minutes, total_questions, passing_score, is_active) VALUES
    ('JSS1 Mathematics Test', 'Basic arithmetic and geometry for JSS1 students', 'JSS1', 30, 5, 60, true),
    ('JSS1 English Language Quiz', 'Grammar, vocabulary and comprehension', 'JSS1', 25, 4, 70, true),
    ('JSS2 Basic Science Exam', 'Introduction to physics, chemistry and biology', 'JSS2', 45, 6, 65, true);

    -- Get exam IDs
    SELECT id INTO jss1_math_exam_id FROM public.exams WHERE title = 'JSS1 Mathematics Test';
    SELECT id INTO jss1_english_exam_id FROM public.exams WHERE title = 'JSS1 English Language Quiz';
    SELECT id INTO jss2_science_exam_id FROM public.exams WHERE title = 'JSS2 Basic Science Exam';

    -- Add questions to JSS1 Math exam
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (jss1_math_exam_id, 'What is 12 + 8?', 'multiple_choice', '{"A": "18", "B": "20", "C": "22", "D": "24"}', 'B', 1, '12 + 8 = 20'),
    (jss1_math_exam_id, 'What is 7 × 6?', 'multiple_choice', '{"A": "42", "B": "48", "C": "36", "D": "40"}', 'A', 1, '7 × 6 = 42'),
    (jss1_math_exam_id, 'What is 1/2 + 1/3?', 'multiple_choice', '{"A": "2/5", "B": "5/6", "C": "3/6", "D": "1/6"}', 'B', 1, '1/2 + 1/3 = 3/6 + 2/6 = 5/6'),
    (jss1_math_exam_id, 'How many degrees are in a right angle?', 'multiple_choice', '{"A": "45°", "B": "60°", "C": "90°", "D": "180°"}', 'C', 1, 'A right angle is exactly 90 degrees'),
    (jss1_math_exam_id, 'What is 15 - 7?', 'multiple_choice', '{"A": "6", "B": "7", "C": "8", "D": "9"}', 'C', 1, '15 - 7 = 8');

    -- Add questions to JSS1 English exam
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (jss1_english_exam_id, 'Choose the correct plural form of "box":', 'multiple_choice', '{"A": "boxs", "B": "boxes", "C": "boxies", "D": "boxen"}', 'B', 1, 'The plural of "box" is "boxes"'),
    (jss1_english_exam_id, 'Which word is a verb?', 'multiple_choice', '{"A": "beautiful", "B": "quickly", "C": "running", "D": "happiness"}', 'C', 1, '"Running" is a verb (action word)'),
    (jss1_english_exam_id, 'Complete the sentence: "She ___ to school every day."', 'multiple_choice', '{"A": "go", "B": "goes", "C": "going", "D": "gone"}', 'B', 1, '"She goes" is the correct present tense form'),
    (jss1_english_exam_id, 'What is the opposite of "hot"?', 'multiple_choice', '{"A": "warm", "B": "cool", "C": "cold", "D": "freezing"}', 'C', 1, 'The opposite of "hot" is "cold"');

    -- Add questions to JSS2 Science exam
    INSERT INTO public.questions (exam_id, question_text, question_type, options, correct_answer, points, explanation) VALUES
    (jss2_science_exam_id, 'What is the chemical formula for water?', 'multiple_choice', '{"A": "H2O", "B": "HO2", "C": "H2O2", "D": "HO"}', 'A', 1, 'Water is H2O - two hydrogen and one oxygen atom'),
    (jss2_science_exam_id, 'Which planet is closest to the Sun?', 'multiple_choice', '{"A": "Venus", "B": "Earth", "C": "Mercury", "D": "Mars"}', 'C', 1, 'Mercury is the planet closest to the Sun'),
    (jss2_science_exam_id, 'How many bones are in the adult human body?', 'multiple_choice', '{"A": "206", "B": "208", "C": "210", "D": "212"}', 'A', 1, 'Adults have 206 bones in their body'),
    (jss2_science_exam_id, 'What gas do plants absorb from the air?', 'multiple_choice', '{"A": "Oxygen", "B": "Nitrogen", "C": "Carbon dioxide", "D": "Hydrogen"}', 'C', 1, 'Plants absorb carbon dioxide for photosynthesis'),
    (jss2_science_exam_id, 'What is the boiling point of water?', 'multiple_choice', '{"A": "90°C", "B": "100°C", "C": "110°C", "D": "120°C"}', 'B', 1, 'Water boils at 100°C at sea level'),
    (jss2_science_exam_id, 'Which organ pumps blood in the human body?', 'multiple_choice', '{"A": "Lungs", "B": "Heart", "C": "Liver", "D": "Brain"}', 'B', 1, 'The heart pumps blood throughout the body');

    -- Create active exam sessions (without teacher_id requirement)
    INSERT INTO public.exam_sessions (
        session_code, exam_id, session_name, class_level,
        max_students, starts_at, ends_at, status, instructions
    ) VALUES 
    (
        '123456', 
        jss1_math_exam_id, 
        'JSS1 Mathematics - Morning Session', 
        'JSS1',
        20, 
        NOW(), 
        NOW() + INTERVAL '4 hours', 
        'active',
        'Use a calculator if needed. Show your working clearly.'
    ),
    (
        '789012', 
        jss1_english_exam_id, 
        'JSS1 English - Practice Test', 
        'JSS1',
        15, 
        NOW(), 
        NOW() + INTERVAL '4 hours', 
        'active',
        'Read each question carefully before answering.'
    ),
    (
        '345678', 
        jss2_science_exam_id, 
        'JSS2 Science - Unit Test', 
        'JSS2',
        25, 
        NOW() + INTERVAL '1 hour', 
        NOW() + INTERVAL '5 hours', 
        'active',
        'This test covers topics from the last 3 weeks.'
    );

    RAISE NOTICE '🎉 TEST DATA CREATED SUCCESSFULLY!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 READY-TO-USE SESSION CODES:';
    RAISE NOTICE '   123456 → JSS1 Mathematics (5 questions, 30 min)';
    RAISE NOTICE '   789012 → JSS1 English (4 questions, 25 min)';
    RAISE NOTICE '   345678 → JSS2 Science (6 questions, 45 min)';
    RAISE NOTICE '';
    RAISE NOTICE '👥 TEST STUDENTS (use any of these):';
    RAISE NOTICE '   Student ID: JSS1/001/2024, Name: Alice Johnson, Class: JSS1';
    RAISE NOTICE '   Student ID: JSS1/002/2024, Name: Bob Smith, Class: JSS1';
    RAISE NOTICE '   Student ID: JSS2/001/2024, Name: Carol Brown, Class: JSS2';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 READY TO TEST:';
    RAISE NOTICE '   1. Go to http://localhost:3000';
    RAISE NOTICE '   2. Enter session code 123456';
    RAISE NOTICE '   3. Use Alice Johnson, JSS1/001/2024, JSS1';
    RAISE NOTICE '   4. Take the math exam!';
    
END $$;