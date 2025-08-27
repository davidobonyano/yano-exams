export type ClassLevel = 'JSS1' | 'JSS2' | 'JSS3' | 'SS1' | 'SS2' | 'SS3'
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_gap' | 'subjective'
export type ExamStatus = 'not_started' | 'in_progress' | 'completed' | 'submitted'
export type SessionStatus = 'active' | 'paused' | 'ended' | 'cancelled'

export interface Teacher {
  id: string
  full_name: string
  email: string
  school_name?: string
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  student_id: string // School registration number
  full_name: string
  class_level: ClassLevel
  school_name?: string
  created_at: string
}

export interface ExamSession {
  id: string
  session_code: string // 6-digit code
  exam_id: string
  teacher_id: string
  session_name: string
  class_level: ClassLevel
  max_students: number
  starts_at: string
  ends_at: string
  status: SessionStatus
  allow_late_join: boolean
  instructions?: string
  camera_monitoring_enabled?: boolean
  camera_access_required?: boolean
  show_results_after_submit?: boolean
  created_at: string
  updated_at: string
}

export interface Class {
  id: string
  name: string
  level: ClassLevel
  description?: string
  created_at: string
}

export interface Exam {
  id: string
  title: string
  description?: string
  class_level: ClassLevel
  duration_minutes: number
  total_questions: number
  passing_score: number
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  exam_id: string
  question_text: string
  question_type: QuestionType
  options?: Record<string, string>
  correct_answer: string
  points: number
  explanation?: string
  image_data?: string // Base64 encoded image data integrated into question
  created_at: string
}

export interface SessionParticipant {
  id: string
  session_id: string
  student_id: string
  joined_at: string
  is_active: boolean
}

export interface StudentExamAttempt {
  id: string
  session_id: string
  student_id: string
  exam_id: string
  status: ExamStatus
  started_at?: string
  completed_at?: string
  submitted_at?: string
  time_remaining?: number
  is_paused: boolean
  pause_reason?: string
  current_index?: number
  created_at: string
}

export interface StudentAnswer {
  id: string
  attempt_id: string
  question_id: string
  answer: string
  is_correct?: boolean
  points_earned: number
  answered_at: string
}

export interface ExamResult {
  id: string
  attempt_id: string
  student_id: string
  session_id: string
  exam_id: string
  total_questions: number
  correct_answers: number
  total_points: number
  points_earned: number
  percentage_score: number
  passed: boolean
  created_at: string
}

export interface CheatingLog {
  id: string
  attempt_id: string
  student_id: string
  session_id: string
  violation_type: string
  violation_details?: Record<string, unknown>
  detected_at: string
}

// Session join response
export interface SessionJoinResponse {
  success: boolean
  error?: string
  student_id?: string
  session_id?: string
  exam_id?: string
  participant_id?: string
}

// Current session context (what we store locally)
export interface SessionContext {
  student: Student
  session: ExamSession
  exam: Exam
  participant_id: string
}