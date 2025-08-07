-- Debug and fix session codes
-- Run this to see what's in the database and fix any issues

-- Check if sessions exist
SELECT 
    session_code,
    session_name,
    class_level,
    status,
    starts_at,
    ends_at,
    NOW() as current_time,
    CASE 
        WHEN status != 'active' THEN 'Session not active'
        WHEN NOW() < starts_at THEN 'Session not started yet'
        WHEN NOW() > ends_at THEN 'Session expired'
        ELSE 'Session should work'
    END as session_status
FROM public.exam_sessions
ORDER BY created_at DESC;

-- Check if exams exist
SELECT id, title, class_level, is_active 
FROM public.exams
ORDER BY created_at DESC;

-- Check if questions exist
SELECT exam_id, COUNT(*) as question_count
FROM public.questions
GROUP BY exam_id;

-- If no sessions found, let's create them right now
DO $$
DECLARE
    jss1_math_exam_id UUID;
    jss1_english_exam_id UUID;
    jss2_science_exam_id UUID;
    session_count INTEGER;
BEGIN
    -- Check if we have sessions
    SELECT COUNT(*) INTO session_count FROM public.exam_sessions;
    
    IF session_count = 0 THEN
        RAISE NOTICE 'No sessions found. Creating new ones...';
        
        -- Get exam IDs
        SELECT id INTO jss1_math_exam_id FROM public.exams WHERE title = 'JSS1 Mathematics Test' LIMIT 1;
        SELECT id INTO jss1_english_exam_id FROM public.exams WHERE title = 'JSS1 English Language Quiz' LIMIT 1;
        SELECT id INTO jss2_science_exam_id FROM public.exams WHERE title = 'JSS2 Basic Science Exam' LIMIT 1;
        
        IF jss1_math_exam_id IS NOT NULL THEN
            -- Delete any existing sessions first
            DELETE FROM public.exam_sessions;
            
            -- Create fresh sessions with longer duration
            INSERT INTO public.exam_sessions (
                session_code, exam_id, session_name, class_level,
                max_students, starts_at, ends_at, status, instructions
            ) VALUES 
            (
                '123456', 
                jss1_math_exam_id, 
                'JSS1 Mathematics - Test Session', 
                'JSS1',
                20, 
                NOW() - INTERVAL '5 minutes', -- Started 5 minutes ago
                NOW() + INTERVAL '6 hours',   -- Ends in 6 hours
                'active',
                'Use a calculator if needed.'
            ),
            (
                '789012', 
                jss1_english_exam_id, 
                'JSS1 English - Test Session', 
                'JSS1',
                15, 
                NOW() - INTERVAL '5 minutes',
                NOW() + INTERVAL '6 hours', 
                'active',
                'Read questions carefully.'
            );
            
            -- Add JSS2 session if exam exists
            IF jss2_science_exam_id IS NOT NULL THEN
                INSERT INTO public.exam_sessions (
                    session_code, exam_id, session_name, class_level,
                    max_students, starts_at, ends_at, status, instructions
                ) VALUES (
                    '345678', 
                    jss2_science_exam_id, 
                    'JSS2 Science - Test Session', 
                    'JSS2',
                    25, 
                    NOW() - INTERVAL '5 minutes',
                    NOW() + INTERVAL '6 hours', 
                    'active',
                    'Science test for JSS2.'
                );
            END IF;
            
            RAISE NOTICE '✅ Sessions created successfully!';
        ELSE
            RAISE NOTICE '❌ No exams found. Run test-data-no-teacher.sql first!';
        END IF;
    ELSE
        RAISE NOTICE 'Found % existing sessions', session_count;
    END IF;
END $$;

-- Show final session status
SELECT 
    '🎯 ACTIVE SESSION CODES:' as info,
    session_code,
    session_name,
    class_level,
    'Ready to use!' as status
FROM public.exam_sessions
WHERE status = 'active' 
AND NOW() BETWEEN starts_at AND ends_at
ORDER BY session_code;