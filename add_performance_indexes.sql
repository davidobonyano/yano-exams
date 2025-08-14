-- Add indexes for better performance

-- Index for session lookup
CREATE INDEX IF NOT EXISTS idx_exam_sessions_code_status 
ON exam_sessions (session_code, status) 
WHERE status = 'active';

-- Index for student lookup
CREATE INDEX IF NOT EXISTS idx_teacher_students_lookup 
ON teacher_students (teacher_id, student_id, is_active) 
WHERE is_active = true;

-- Index for session participants
CREATE INDEX IF NOT EXISTS idx_session_participants_lookup 
ON session_participants (session_id, student_id);

-- Index for student answers performance
CREATE INDEX IF NOT EXISTS idx_student_answers_attempt 
ON student_answers (attempt_id, is_correct);

-- Index for questions by exam
CREATE INDEX IF NOT EXISTS idx_questions_exam 
ON questions (exam_id);

-- Index for exam attempts
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_session 
ON student_exam_attempts (session_id, status);

SELECT 'Performance indexes created!' as status;
