-- Run this script in your Supabase SQL Editor to fix the student management system
-- This will replace the problematic school profiles system with a clean, year-based approach

-- Step 1: Run the new student management system
\i database/new-student-management-system.sql

-- Step 2: Verify the installation
SELECT '✅ New student management system installed successfully!' as status;

-- Step 3: Check the created tables
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('school_classes', 'central_students', 'student_sequences')
ORDER BY table_name;

-- Step 4: Check sample data
SELECT '📊 Sample students created:' as info;
SELECT student_id, full_name, class_level, section, academic_year 
FROM public.central_students 
ORDER BY academic_year DESC, class_level, section, full_name;

-- Step 5: Check class statistics
SELECT '📈 Class statistics:' as info;
SELECT class_level, section, academic_year, COUNT(*) as student_count
FROM public.central_students 
GROUP BY class_level, section, academic_year
ORDER BY academic_year DESC, class_level, section;

-- Step 6: Test the functions
SELECT '🧪 Testing functions:' as info;
SELECT public.generate_year_based_student_id('JSS1', 'A', 2024) as test_student_id;

-- Ready to use! 🎉
SELECT '🚀 Your new student management system is ready!' as ready;
SELECT 'Features:' as feature;
SELECT '- Year-based student IDs (e.g., 2024/JSS1/A/001)' as feature;
SELECT '- Sections A-E for each class level' as feature;
SELECT '- Centralized admin dashboard to prevent duplicates' as feature;
SELECT '- Support for last 6 years (2019-2024)' as feature;
SELECT '- Automatic class creation and student numbering' as feature;
