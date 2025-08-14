-- Debug script to check student ID relationships

-- Check students table structure
SELECT 'Students table contents:' as info;
SELECT 
  id as uuid_id,
  student_id as student_code,
  full_name,
  class_level,
  school_name
FROM students 
ORDER BY created_at DESC 
LIMIT 10;

-- Check teacher_students table
SELECT 'Teacher students table contents:' as info;
SELECT 
  id as uuid_id,
  student_id as student_code,
  full_name,
  class_level,
  teacher_id,
  is_active
FROM teacher_students 
ORDER BY created_at DESC 
LIMIT 10;

-- Check session participants
SELECT 'Session participants:' as info;
SELECT 
  sp.id as participant_id,
  sp.session_id,
  sp.student_id as student_uuid,
  s.student_id as student_code,
  s.full_name
FROM session_participants sp
JOIN students s ON s.id = sp.student_id
ORDER BY sp.joined_at DESC 
LIMIT 10;

-- Check for any orphaned student_exam_attempts
SELECT 'Orphaned exam attempts (if any):' as info;
SELECT 
  sea.id,
  sea.student_id,
  sea.session_id,
  sea.exam_id,
  'Missing student?' as issue
FROM student_exam_attempts sea
LEFT JOIN students s ON s.id = sea.student_id
WHERE s.id IS NULL
LIMIT 5;
