// Automatic Scoring System
// Calculates and updates student scores when exams are completed

import { supabase } from '@/lib/supabase'

export interface ScoringResult {
  success: boolean
  attemptId?: string
  totalQuestions: number
  correctAnswers: number
  totalPoints: number
  pointsEarned: number
  percentageScore: number
  passed: boolean
  error?: string
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

export interface DetailedAnswer {
  question_number: number
  question_id: string
  question_text: string
  question_type: string
  question_points: number
  options?: Record<string, string>
  correct_answer_key: string
  correct_answer_text: string
  student_answer_key: string
  student_answer_text: string
  is_correct: boolean
  points_earned: number
  answered_at?: string
  explanation?: string
}

export interface DetailedStudentResult {
  success: boolean
  attempt_info: {
    attempt_id: string
    student_id: string
    student_name: string
    student_email: string
    student_class: string
    student_school_id: string
    exam_id: string
    exam_title: string
    session_id: string
    session_name: string
    session_code: string
    status: string
    started_at: string
    completed_at?: string
    submitted_at?: string
    total_questions: number
    correct_answers: number
    total_points: number
    points_earned: number
    percentage_score: number
    passed: boolean
    passing_score: number
  }
  detailed_answers: DetailedAnswer[]
  error?: string
}

export interface SessionDetailedResults {
  success: boolean
  session_info: {
    session_id: string
    session_name: string
    exam_id: string
    exam_title: string
    exam_description?: string
    total_questions: number
    passing_score: number
    duration_minutes?: number
    created_at: string
    status: string
    total_participants: number
    completed_participants: number
  }
  students_results: Array<{
    attempt_id: string
    student_id: string
    student_name: string
    student_email: string
    status: string
    started_at: string
    completed_at?: string
    submitted_at?: string
    total_questions: number
    correct_answers: number
    total_points: number
    points_earned: number
    percentage_score: number
    passed: boolean
    completion_time_minutes?: number
  }>
  error?: string
}

/**
 * Automatically calculates and saves exam score when student completes exam
 */
export async function calculateAndSaveScore(attemptId: string): Promise<ScoringResult> {
  try {
    // First, let's check if there are any student answers for this attempt
    const { data: answersCheck, error: answersError } = await supabase
      .from('student_answers')
      .select('*')
      .eq('attempt_id', attemptId)
    
    console.log('Student answers for attempt:', attemptId, answersCheck)
    
    if (answersError) {
      console.error('Error checking student answers:', answersError)
    }

    // Now call the scoring function
    const { data, error } = await supabase.rpc('calculate_exam_score', {
      p_attempt_id: attemptId
    })

    console.log('Database scoring result:', { data, error })

    if (error) throw error

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failed to calculate score',
        totalQuestions: 0,
        correctAnswers: 0,
        totalPoints: 0,
        pointsEarned: 0,
        percentageScore: 0,
        passed: false
      }
    }

    return {
      success: true,
      attemptId,
      totalQuestions: data.total_questions,
      correctAnswers: data.correct_answers,
      totalPoints: data.total_points,
      pointsEarned: data.points_earned,
      percentageScore: parseFloat(data.percentage_score),
      passed: data.passed
    }
  } catch (error) {
    console.error('Error calculating score:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)
    return {
      success: false,
      error: error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Unknown error'),
      totalQuestions: 0,
      correctAnswers: 0,
      totalPoints: 0,
      pointsEarned: 0,
      percentageScore: 0,
      passed: false
    }
  }
}

/**
 * Validates student answers and marks them as correct/incorrect
 */
export async function validateAndMarkAnswers(
  attemptId: string,
  answers: Array<{
    questionId: string
    answer: string
    timeSpent?: number
  }>
): Promise<{ success: boolean; validatedCount: number; error?: string }> {
  try {
    console.log('Starting validation for attempt:', attemptId, 'with answers:', answers)
    let validatedCount = 0

    for (const answer of answers) {
      console.log('Processing answer for question:', answer.questionId, 'answer:', answer.answer)
      
      // Get question details
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', answer.questionId)
        .single()

      console.log('Question data:', question, 'Error:', questionError)

      if (questionError) {
        console.error('Error fetching question:', answer.questionId, questionError)
        continue
      }

      if (!question) {
        console.error('Question not found:', answer.questionId)
        continue
      }

      // Determine if answer is correct
      let isCorrect = false
      let pointsEarned = 0

      console.log('Question type:', question.question_type, 'Correct answer:', question.correct_answer, 'Student answer:', answer.answer)

      if (question.question_type === 'multiple_choice') {
        isCorrect = answer.answer.toUpperCase() === question.correct_answer.toUpperCase()
      } else if (question.question_type === 'true_false') {
        // Handle both A: True, B: False format and direct true/false format
        if (question.options && Object.keys(question.options).length > 0) {
          // Format: A: True, B: False - check if student selected the correct option
          isCorrect = answer.answer.toUpperCase() === question.correct_answer.toUpperCase()
        } else {
          // Direct true/false format
          isCorrect = answer.answer.toLowerCase() === question.correct_answer.toLowerCase()
        }
      } else if (question.question_type === 'short_answer') {
        // Simple text comparison - could be enhanced with fuzzy matching
        const studentAnswer = answer.answer.toLowerCase().trim()
        const correctAnswer = question.correct_answer.toLowerCase().trim()
        isCorrect = studentAnswer === correctAnswer
      } else if (question.question_type === 'fill_in_gap') {
        // For fill-in-the-gap, do case-insensitive comparison
        const studentAnswer = answer.answer.toLowerCase().trim()
        const correctAnswer = question.correct_answer.toLowerCase().trim()
        isCorrect = studentAnswer === correctAnswer
      } else if (question.question_type === 'subjective') {
        // For subjective questions, we can't auto-score - mark as needs manual review
        // For now, we'll give partial credit if they write something substantial
        const studentAnswer = answer.answer.trim()
        isCorrect = studentAnswer.length > 10 // Give credit for substantial answers
        pointsEarned = isCorrect ? Math.min(question.points || 1, 1) : 0 // Max 1 point for auto-scoring
      }

      if (isCorrect) {
        pointsEarned = question.points || 1
      }

      console.log('Answer validation result:', {
        questionId: answer.questionId,
        studentAnswer: answer.answer,
        correctAnswer: question.correct_answer,
        isCorrect,
        pointsEarned
      })

      // Insert or update student answer
      const answerData = {
        attempt_id: attemptId,
        question_id: answer.questionId,
        answer: answer.answer,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        answered_at: new Date().toISOString()
      }

      console.log('Saving answer data:', answerData)

      const { error: answerError } = await supabase
        .from('student_answers')
        .upsert(answerData, {
          onConflict: 'attempt_id,question_id'
        })

      if (answerError) {
        console.error('Error saving answer for question', answer.questionId, ':', answerError)
        continue
      }

      console.log('Successfully saved answer for question:', answer.questionId)
      validatedCount++
    }

    return {
      success: true,
      validatedCount
    }
  } catch (error) {
    console.error('Error validating answers:', error)
    return {
      success: false,
      validatedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Gets exam results for a student
 */
export async function getExamResults(
  studentId: string,
  sessionId: string
): Promise<ExamResult | null> {
  try {
    const { data, error } = await supabase
      .from('exam_results')
      .select('*')
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // No result found
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching exam results:', error)
    return null
  }
}

/**
 * Gets all results for a session
 */
export async function getSessionResults(sessionId: string): Promise<ExamResult[]> {
  try {
    const { data, error } = await supabase
      .from('exam_results')
      .select(`
        *,
        students!inner (
          student_id,
          full_name,
          class_level
        )
      `)
      .eq('session_id', sessionId)
      .order('percentage_score', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching session results:', error)
    return []
  }
}

/**
 * Updates student table with their latest exam performance
 * This can be used to track overall student performance
 */
export async function updateStudentPerformance(
  studentId: string,
  examResult: ExamResult
): Promise<boolean> {
  try {
    // This is optional - you might want to track student overall performance
    // For now, we'll just log the performance data
    console.log('Student performance update:', {
      studentId,
      examScore: examResult.percentage_score,
      passed: examResult.passed,
      examDate: examResult.created_at
    })

    // You could add additional logic here to:
    // - Update student's overall GPA
    // - Track improvement over time
    // - Flag students who need help
    // - Generate performance reports

    return true
  } catch (error) {
    console.error('Error updating student performance:', error)
    return false
  }
}

/**
 * Generate performance analytics for a session
 */
export async function generateSessionAnalytics(sessionId: string) {
  try {
    const results = await getSessionResults(sessionId)

    if (results.length === 0) {
      return {
        totalStudents: 0,
        averageScore: 0,
        passRate: 0,
        highestScore: 0,
        lowestScore: 0,
        distribution: {}
      }
    }

    const scores = results.map(r => r.percentage_score)
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const passCount = results.filter(r => r.passed).length
    const passRate = (passCount / results.length) * 100

    // Score distribution (A: 90-100, B: 80-89, C: 70-79, D: 60-69, F: <60)
    const distribution = {
      A: results.filter(r => r.percentage_score >= 90).length,
      B: results.filter(r => r.percentage_score >= 80 && r.percentage_score < 90).length,
      C: results.filter(r => r.percentage_score >= 70 && r.percentage_score < 80).length,
      D: results.filter(r => r.percentage_score >= 60 && r.percentage_score < 70).length,
      F: results.filter(r => r.percentage_score < 60).length
    }

    return {
      totalStudents: results.length,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      distribution,
      results: results.map(r => ({
        studentName: (r as { students?: { full_name?: string } }).students?.full_name || 'Unknown',
        studentId: (r as { students?: { student_id?: string } }).students?.student_id || 'N/A',
        score: r.percentage_score,
        passed: r.passed,
        correctAnswers: r.correct_answers,
        totalQuestions: r.total_questions
      }))
    }
  } catch (error) {
    console.error('Error generating session analytics:', error)
    return null
  }
}

/**
 * Auto-score system that runs when student submits exam
 */
export async function processExamSubmission(
  attemptId: string,
  answers: Array<{
    questionId: string
    answer: string
    timeSpent?: number
  }>
): Promise<ScoringResult> {
  try {
    // Step 1: Validate and mark all answers
    const validationResult = await validateAndMarkAnswers(attemptId, answers)
    
    if (!validationResult.success) {
      throw new Error(validationResult.error || 'Failed to validate answers')
    }

    // Step 2: Calculate final score
    const scoringResult = await calculateAndSaveScore(attemptId)
    
    if (!scoringResult.success) {
      throw new Error(scoringResult.error || 'Failed to calculate score')
    }

    // Step 3: Update student performance (optional)
    if (scoringResult.attemptId) {
      const examResult = await getExamResults(
        scoringResult.attemptId.split('-')[0], // This would need proper student ID extraction
        scoringResult.attemptId.split('-')[1]  // This would need proper session ID extraction
      )
      
      if (examResult) {
        await updateStudentPerformance(examResult.student_id, examResult)
      }
    }

    return scoringResult
  } catch (error) {
    console.error('Error processing exam submission:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalQuestions: 0,
      correctAnswers: 0,
      totalPoints: 0,
      pointsEarned: 0,
      percentageScore: 0,
      passed: false
    }
  }
}

/**
 * Gets detailed exam results for a specific student attempt
 */
export async function getDetailedStudentResults(attemptId: string): Promise<DetailedStudentResult | null> {
  try {
    const { data, error } = await supabase.rpc('get_detailed_student_results', {
      p_attempt_id: attemptId
    })

    if (error) {
      console.error('Error fetching detailed student results:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error calling detailed student results function:', error)
    return null
  }
}

/**
 * Gets detailed results for all students in a session
 */
export async function getSessionDetailedResults(sessionId: string): Promise<SessionDetailedResults | null> {
  try {
    const { data, error } = await supabase.rpc('get_session_detailed_results', {
      p_session_id: sessionId
    })

    if (error) {
      console.error('Error fetching session detailed results:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error calling session detailed results function:', error)
    return null
  }
}

/**
 * Export results to CSV format
 */
export function exportResultsToCSV(results: ExamResult[], sessionName: string): string {
  const headers = [
    'Student ID',
    'Student Name',
    'Class Level',
    'Total Questions',
    'Correct Answers',
    'Total Points',
    'Points Earned',
    'Percentage Score',
    'Grade',
    'Status',
    'Completion Date'
  ]

  const rows = results.map(result => [
    (result as { students?: { student_id?: string } }).students?.student_id || 'N/A',
    (result as { students?: { full_name?: string } }).students?.full_name || 'Unknown',
    (result as { students?: { class_level?: string } }).students?.class_level || 'N/A',
    result.total_questions.toString(),
    result.correct_answers.toString(),
    result.total_points.toString(),
    result.points_earned.toString(),
    result.percentage_score.toFixed(2),
    getLetterGrade(result.percentage_score),
    result.passed ? 'PASSED' : 'FAILED',
    new Date(result.created_at).toLocaleString()
  ])

  const csvContent = [
    `Exam Results - ${sessionName}`,
    `Generated on ${new Date().toLocaleString()}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

/**
 * Convert percentage to letter grade
 */
function getLetterGrade(percentage: number): string {
  if (percentage >= 90) return 'A'
  if (percentage >= 80) return 'B'
  if (percentage >= 70) return 'C'
  if (percentage >= 60) return 'D'
  return 'F'
}