export type ClassLevel = 'JSS1' | 'JSS2' | 'JSS3' | 'SS1' | 'SS2' | 'SS3'
export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_gap' | 'subjective'
export type ExamStatus = 'not_started' | 'in_progress' | 'completed' | 'submitted'

export interface User {
  id: string
  full_name: string
  class_level: ClassLevel
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
  created_at: string
}

export interface UserExamAttempt {
  id: string
  user_id: string
  exam_id: string
  status: ExamStatus
  started_at?: string
  completed_at?: string
  submitted_at?: string
  time_remaining?: number
  is_paused: boolean
  pause_reason?: string
  created_at: string
}

export interface UserAnswer {
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
  user_id: string
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
  user_id: string
  violation_type: string
  violation_details?: Record<string, unknown>
  detected_at: string
}