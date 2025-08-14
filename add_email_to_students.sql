-- Script to add email collection to student registration

-- You can run this to add emails to existing students
-- Update students with sample email addresses (replace with real collection method)

-- Example: Update specific students with emails
-- UPDATE teacher_students 
-- SET email = 'student1@example.com', 
--     parent_email = 'parent1@example.com',
--     parent_name = 'Parent Name'
-- WHERE student_id = 'JSS1A-001';

-- Or you can create a form to collect emails during student registration
-- This is just the database structure - you'll need to update your student registration UI

SELECT 'Email fields added to students table. Update your student registration form to collect:' as instruction;
SELECT '1. Student email (optional)' as field_1;
SELECT '2. Parent/Guardian email (recommended)' as field_2;
SELECT '3. Parent/Guardian name' as field_3;

-- Check which students are missing email information
SELECT 
  student_id,
  full_name,
  class_level,
  CASE 
    WHEN email IS NULL AND parent_email IS NULL THEN 'No emails'
    WHEN email IS NULL THEN 'Missing student email'
    WHEN parent_email IS NULL THEN 'Missing parent email'
    ELSE 'Has emails'
  END as email_status
FROM teacher_students 
WHERE is_active = true
ORDER BY class_level, student_id;
