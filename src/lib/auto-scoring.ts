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

/**
 * Automatically calculates and saves exam score when student completes exam
 */
export async function calculateAndSaveScore(attemptId: string): Promise<ScoringResult> {
  try {
    const { data, error } = await supabase.rpc('calculate_exam_score', {
      p_attempt_id: attemptId
    })

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
    let validatedCount = 0

    for (const answer of answers) {
      // Get question details
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', answer.questionId)
        .single()

      if (questionError) {
        console.error('Error fetching question:', questionError)
        continue
      }

      // Determine if answer is correct
      let isCorrect = false
      let pointsEarned = 0

      if (question.question_type === 'multiple_choice') {
        isCorrect = answer.answer.toUpperCase() === question.correct_answer.toUpperCase()
      } else if (question.question_type === 'true_false') {
        isCorrect = answer.answer.toUpperCase() === question.correct_answer.toUpperCase()
      } else if (question.question_type === 'short_answer') {
        // Simple text comparison - could be enhanced with fuzzy matching
        const studentAnswer = answer.answer.toLowerCase().trim()
        const correctAnswer = question.correct_answer.toLowerCase().trim()
        isCorrect = studentAnswer === correctAnswer
      }

      if (isCorrect) {
        pointsEarned = question.points
      }

      // Insert or update student answer
      const { error: answerError } = await supabase
        .from('student_answers')
        .upsert({
          attempt_id: attemptId,
          question_id: answer.questionId,
          answer: answer.answer,
          is_correct: isCorrect,
          points_earned: pointsEarned,
          answered_at: new Date().toISOString()
        })

      if (answerError) {
        console.error('Error saving answer:', answerError)
        continue
      }

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
        studentName: r.students?.full_name || 'Unknown',
        studentId: r.students?.student_id || 'N/A',
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
    result.students?.student_id || 'N/A',
    result.students?.full_name || 'Unknown',
    result.students?.class_level || 'N/A',
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