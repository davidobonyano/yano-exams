-- Test Admin Permissions
-- Run this after applying fix_admin_permissions.sql to verify everything works

-- 1. Check if teachers table exists and has correct structure
SELECT 
    'Teachers table structure:' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'teachers' 
ORDER BY ordinal_position;

-- 2. Check if RLS policies exist for teachers
SELECT 
    'Teachers RLS policies:' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'teachers';

-- 3. Check if admin policies exist for exams
SELECT 
    'Exams admin policies:' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'exams' AND policyname LIKE '%teacher%';

-- 4. Check if admin policies exist for questions
SELECT 
    'Questions admin policies:' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'questions' AND policyname LIKE '%teacher%';

-- 5. Check if is_teacher function exists
SELECT 
    'is_teacher function:' as check_type,
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'is_teacher';

-- 6. Check grants for authenticated users
SELECT 
    'Grants for authenticated users:' as check_type,
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges 
WHERE grantee = 'authenticated' 
AND table_name IN ('exams', 'questions', 'classes', 'teachers')
ORDER BY table_name, privilege_type;

-- 7. Test the is_teacher function (will return false if not authenticated as teacher)
SELECT 
    'Test is_teacher function:' as check_type,
    public.is_teacher() as is_teacher_result;

-- Summary
SELECT 'Admin permissions check completed. Review the results above.' as summary; 