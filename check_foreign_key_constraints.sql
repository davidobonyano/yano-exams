-- Check Foreign Key Constraints for Questions Table
-- This will help identify why questions cannot be deleted

-- 1. Check all foreign key constraints referencing questions table
SELECT 
    'Foreign keys referencing questions:' as check_type,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'questions';

-- 2. Check if questions table has any foreign key constraints
SELECT 
    'Questions table foreign keys:' as check_type,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'questions';

-- 3. Check if there are any user_answers referencing the questions
SELECT 
    'User answers referencing questions:' as check_type,
    COUNT(*) as total_references
FROM public.user_answers ua
JOIN public.questions q ON ua.question_id = q.id;

-- 4. Check if there are any exam_results that might reference questions
SELECT 
    'Exam results count:' as check_type,
    COUNT(*) as total_results
FROM public.exam_results;

-- 5. Check RLS policies on questions table
SELECT 
    'Questions RLS policies:' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'questions';

-- 6. Check if questions table has RLS enabled
SELECT 
    'Questions RLS status:' as check_type,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'questions';

-- 7. Check current user permissions
SELECT 
    'Current user permissions:' as check_type,
    current_user as current_user,
    session_user as session_user,
    current_setting('role') as current_role;

-- Summary
SELECT 'Foreign key constraint check completed. Review the results above.' as summary; 