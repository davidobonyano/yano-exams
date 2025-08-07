-- Test Data for Session-Based Exam Platform
-- This will automatically find your teacher and create test data

DO $$
DECLARE
    teacher_id UUID;
    teacher_email TEXT := 'teacher@test.com'; -- Change this if you used a different email
    jss1_math_exam_id UUID;
    jss1_english_exam_id UUID;
    jss2_science_exam_id UUID;
BEGIN
    -- Find teacher ID automatically
    SELECT au.id INTO teacher_id 
    FROM auth.users au 
    JOIN public.teachers t ON t.id = au.id 
    WHERE au.email = teacher_email
    LIMIT 1;

    -- Check if teacher was found
    IF teacher_id IS NULL THEN
        RAISE EXCEPTION 'Teacher not found with email: %. Please create a teacher account first at /admin', teacher_email;
    END IF;

    RAISE NOTICE 'Found teacher ID: %', teacher_id;

    -- Create sample exams
    INSERT INTO public.exams (title, description, class_level, duration_minutes, total_questions, passing_score, created_by) VALUES
    ('JSS1 Mathematics Test', 'Basic arithmetic and geometry for JSS1 students', 'JSS1', 30, 5, 60, teacher_id),
    ('JSS1 English Language Quiz', 'Grammar, vocabulary and comprehension', 'JSS1', 25, 4, 70, teacher_id),
    ('JSS2 Basic Science Exam', 'Introduction to physics, chemistry and biology', 'JSS2', 45, 6, 65, teacher_id);

    -- Get exam IDs
    SELECT id INTO jss1_math_exam_id FROM public.exams WHERE title = 'JSS1 Mathematics Test' AND created_by = teacher_id;
    SELECT id INTO jss1_english_exam_id FROM public.exams WHERE title = 'JSS1 English Language Quiz' AND created_by = teacher_id;
    SELECT id INTO jss2_science_exam_id FROM public.exams WHERE title = 'JSS2 Basic Science Exam' AND created_by = teacher_id;

    RAISE NOTICE 'Created exams: Math=%, English=%, Science=%', jss1_math_exam_id, jss1_english_exam_id, jss2_science_exam_id;

    -- Add questions to JSS1 Math exam
    PERFORM public.create_question(
        jss1_math_exam_id,
        'What is 12 + 8?',
        'multiple_choice',
        '{"A": "18", "B": "20", "C": "22", "D": "24"}'::jsonb,
        'B',
        1,
        '12 + 8 = 20'
    );

    PERFORM public.create_question(
        jss1_math_exam_id,
        'What is 7 × 6?',
        'multiple_choice',
        '{"A": "42", "B": "48", "C": "36", "D": "40"}'::jsonb,
        'A',
        1,
        '7 × 6 = 42'
    );

    PERFORM public.create_question(
        jss1_math_exam_id,
        'What is 1/2 + 1/3?',
        'multiple_choice',
        '{"A": "2/5", "B": "5/6", "C": "3/6", "D": "1/6"}'::jsonb,
        'B',
        1,
        '1/2 + 1/3 = 3/6 + 2/6 = 5/6'
    );

    PERFORM public.create_question(
        jss1_math_exam_id,
        'How many degrees are in a right angle?',
        'multiple_choice',
        '{"A": "45°", "B": "60°", "C": "90°", "D": "180°"}'::jsonb,
        'C',
        1,
        'A right angle is exactly 90 degrees'
    );

    PERFORM public.create_question(
        jss1_math_exam_id,
        'What is 15 - 7?',
        'multiple_choice',
        '{"A": "6", "B": "7", "C": "8", "D": "9"}'::jsonb,
        'C',
        1,
        '15 - 7 = 8'
    );

    -- Add questions to JSS1 English exam
    PERFORM public.create_question(
        jss1_english_exam_id,
        'Choose the correct plural form of "box":',
        'multiple_choice',
        '{"A": "boxs", "B": "boxes", "C": "boxies", "D": "boxen"}'::jsonb,
        'B',
        1,
        'The plural of "box" is "boxes"'
    );

    PERFORM public.create_question(
        jss1_english_exam_id,
        'Which word is a verb?',
        'multiple_choice',
        '{"A": "beautiful", "B": "quickly", "C": "running", "D": "happiness"}'::jsonb,
        'C',
        1,
        '"Running" is a verb (action word)'
    );

    PERFORM public.create_question(
        jss1_english_exam_id,
        'Complete the sentence: "She ___ to school every day."',
        'multiple_choice',
        '{"A": "go", "B": "goes", "C": "going", "D": "gone"}'::jsonb,
        'B',
        1,
        '"She goes" is the correct present tense form'
    );

    PERFORM public.create_question(
        jss1_english_exam_id,
        'What is the opposite of "hot"?',
        'multiple_choice',
        '{"A": "warm", "B": "cool", "C": "cold", "D": "freezing"}'::jsonb,
        'C',
        1,
        'The opposite of "hot" is "cold"'
    );

    -- Add questions to JSS2 Science exam
    PERFORM public.create_question(
        jss2_science_exam_id,
        'What is the chemical formula for water?',
        'multiple_choice',
        '{"A": "H2O", "B": "HO2", "C": "H2O2", "D": "HO"}'::jsonb,
        'A',
        1,
        'Water is H2O - two hydrogen and one oxygen atom'
    );

    PERFORM public.create_question(
        jss2_science_exam_id,
        'Which planet is closest to the Sun?',
        'multiple_choice',
        '{"A": "Venus", "B": "Earth", "C": "Mercury", "D": "Mars"}'::jsonb,
        'C',
        1,
        'Mercury is the planet closest to the Sun'
    );

    PERFORM public.create_question(
        jss2_science_exam_id,
        'How many bones are in the adult human body?',
        'multiple_choice',
        '{"A": "206", "B": "208", "C": "210", "D": "212"}'::jsonb,
        'A',
        1,
        'Adults have 206 bones in their body'
    );

    PERFORM public.create_question(
        jss2_science_exam_id,
        'What gas do plants absorb from the air?',
        'multiple_choice',
        '{"A": "Oxygen", "B": "Nitrogen", "C": "Carbon dioxide", "D": "Hydrogen"}'::jsonb,
        'C',
        1,
        'Plants absorb carbon dioxide for photosynthesis'
    );

    PERFORM public.create_question(
        jss2_science_exam_id,
        'What is the boiling point of water?',
        'multiple_choice',
        '{"A": "90°C", "B": "100°C", "C": "110°C", "D": "120°C"}'::jsonb,
        'B',
        1,
        'Water boils at 100°C at sea level'
    );

    PERFORM public.create_question(
        jss2_science_exam_id,
        'Which organ pumps blood in the human body?',
        'multiple_choice',
        '{"A": "Lungs", "B": "Heart", "C": "Liver", "D": "Brain"}'::jsonb,
        'B',
        1,
        'The heart pumps blood throughout the body'
    );

    -- Create active exam sessions (set times for next 2 hours)
    INSERT INTO public.exam_sessions (
        session_code, exam_id, teacher_id, session_name, class_level,
        max_students, starts_at, ends_at, status, instructions
    ) VALUES 
    (
        '123456', 
        jss1_math_exam_id, 
        teacher_id, 
        'JSS1 Mathematics - Morning Session', 
        'JSS1',
        20, 
        NOW(), 
        NOW() + INTERVAL '2 hours', 
        'active',
        'Use a calculator if needed. Show your working clearly.'
    ),
    (
        '789012', 
        jss1_english_exam_id, 
        teacher_id, 
        'JSS1 English - Practice Test', 
        'JSS1',
        15, 
        NOW(), 
        NOW() + INTERVAL '2 hours', 
        'active',
        'Read each question carefully before answering.'
    ),
    (
        '345678', 
        jss2_science_exam_id, 
        teacher_id, 
        'JSS2 Science - Unit Test', 
        'JSS2',
        25, 
        NOW(), 
        NOW() + INTERVAL '3 hours', 
        'active',
        'This test covers topics from the last 3 weeks.'
    );

    RAISE NOTICE '✅ Test data created successfully!';
    RAISE NOTICE '🎯 Session Codes Ready:';
    RAISE NOTICE '   123456 - JSS1 Mathematics (5 questions, 30 min)';
    RAISE NOTICE '   789012 - JSS1 English (4 questions, 25 min)';
    RAISE NOTICE '   345678 - JSS2 Science (6 questions, 45 min)';
    RAISE NOTICE '';
    RAISE NOTICE '👥 Test Students:';
    RAISE NOTICE '   JSS1/001/2024 - Alice Johnson (JSS1) → Use code 123456 or 789012';
    RAISE NOTICE '   JSS1/002/2024 - Bob Smith (JSS1) → Use code 123456 or 789012';
    RAISE NOTICE '   JSS2/001/2024 - Carol Brown (JSS2) → Use code 345678';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready to test! Go to http://localhost:3000';
    
END $$;