'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Exam, Question, UserExamAttempt, UserAnswer, ExamResult } from '@/types/database'
import Header from '@/components/layout/Header'
import Link from 'next/link'

interface ExamResultsProps {
  attemptId: string
}

interface QuestionWithAnswer extends Question {
  userAnswer?: UserAnswer
  isCorrect: boolean
}

export default function ExamResults({ attemptId }: ExamResultsProps) {
  const router = useRouter()
  const { profile } = useAuth()
  const [exam, setExam] = useState<Exam | null>(null)
  const [attempt, setAttempt] = useState<UserExamAttempt | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnswers, setShowAnswers] = useState(false)

  useEffect(() => {
    if (profile) {
      loadResults()
    }
  }, [profile, attemptId])

  const loadResults = async () => {
    try {
      setLoading(true)

      // Fetch attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from('user_exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .eq('user_id', profile!.id)
        .single()

      if (attemptError) throw attemptError
      setAttempt(attemptData)

      // Fetch exam
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', attemptData.exam_id)
        .single()

      if (examError) throw examError
      setExam(examData)

      // Check if results already exist
      const { data: existingResult, error: resultError } = await supabase
        .from('exam_results')
        .select('*')
        .eq('attempt_id', attemptId)
        .single()

      if (resultError && resultError.code !== 'PGRST116') {
        throw resultError
      }

      if (existingResult) {
        setResult(existingResult)
        await loadQuestionsWithAnswers(attemptData.exam_id, attemptId)
      } else {
        // Calculate and save results
        await calculateResults(attemptData, examData)
      }

    } catch (err: unknown) {
      console.error('Error loading results:', err)
      setError(err instanceof Error ? err.message : 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const loadQuestionsWithAnswers = async (examId: string, attemptId: string) => {
    try {
      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at')

      if (questionsError) throw questionsError

      // Fetch user answers
      const { data: answersData, error: answersError } = await supabase
        .from('user_answers')
        .select('*')
        .eq('attempt_id', attemptId)

      if (answersError) throw answersError

      // Combine questions with answers
      const questionsWithAnswers: QuestionWithAnswer[] = questionsData.map(question => {
        const userAnswer = answersData.find(answer => answer.question_id === question.id)
        const isCorrect = userAnswer ? userAnswer.answer === question.correct_answer : false

        return {
          ...question,
          userAnswer,
          isCorrect
        }
      })

      setQuestions(questionsWithAnswers)
    } catch (err) {
      console.error('Error loading questions with answers:', err)
    }
  }

  const calculateResults = async (attempt: UserExamAttempt, exam: Exam) => {
    try {
      // Fetch all questions and answers for this attempt
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', exam.id)

      if (questionsError) throw questionsError

      const { data: answersData, error: answersError } = await supabase
        .from('user_answers')
        .select('*')
        .eq('attempt_id', attempt.id)

      if (answersError) throw answersError

      // Calculate scores
      let correctAnswers = 0
      let totalPoints = 0
      let pointsEarned = 0

      const updatedAnswers = []

      for (const question of questionsData) {
        const userAnswer = answersData.find(answer => answer.question_id === question.id)
        totalPoints += question.points

        if (userAnswer) {
          const isCorrect = userAnswer.answer === question.correct_answer
          const points = isCorrect ? question.points : 0

          if (isCorrect) correctAnswers++
          pointsEarned += points

          // Update answer with correctness and points
          updatedAnswers.push({
            id: userAnswer.id,
            is_correct: isCorrect,
            points_earned: points
          })
        }
      }

      // Update user answers with correctness and points
      for (const answer of updatedAnswers) {
        await supabase
          .from('user_answers')
          .update({
            is_correct: answer.is_correct,
            points_earned: answer.points_earned
          })
          .eq('id', answer.id)
      }

      const percentageScore = totalPoints > 0 ? (pointsEarned / totalPoints) * 100 : 0
      const passed = percentageScore >= exam.passing_score

      // Save exam result
      const { data: resultData, error: resultError } = await supabase
        .from('exam_results')
        .insert([{
          attempt_id: attempt.id,
          user_id: profile!.id,
          exam_id: exam.id,
          total_questions: questionsData.length,
          correct_answers: correctAnswers,
          total_points: totalPoints,
          points_earned: pointsEarned,
          percentage_score: percentageScore,
          passed: passed
        }])
        .select()
        .single()

      if (resultError) throw resultError

      setResult(resultData)
      await loadQuestionsWithAnswers(exam.id, attempt.id)

    } catch (err: unknown) {
      console.error('Error calculating results:', err)
      setError(err instanceof Error ? err.message : 'Failed to calculate results')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">Calculating results...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
            <Link
              href="/"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!exam || !attempt || !result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-lg text-gray-600">No results available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Results Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="text-center">
            <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${
              result.passed ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {result.passed ? (
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              {result.passed ? 'Congratulations!' : 'Better Luck Next Time'}
            </h1>
            
            <p className="mt-2 text-lg text-gray-600">{exam.title}</p>
            
            <div className="mt-4 text-4xl font-bold">
              <span className={result.passed ? 'text-green-600' : 'text-red-600'}>
                {result.percentage_score.toFixed(1)}%
              </span>
            </div>
            
            <p className="mt-2 text-sm text-gray-500">
              {result.passed ? 'You passed!' : `You needed ${exam.passing_score}% to pass`}
            </p>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Score Breakdown</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{result.correct_answers}</div>
              <div className="text-sm text-gray-600">Correct Answers</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{result.total_questions}</div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{result.points_earned}</div>
              <div className="text-sm text-gray-600">Points Earned</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{result.total_points}</div>
              <div className="text-sm text-gray-600">Total Points</div>
            </div>
          </div>
        </div>

        {/* Exam Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Exam Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Started:</span>
              <span className="ml-2 text-gray-600">
                {new Date(attempt.started_at!).toLocaleString()}
              </span>
            </div>
            
            <div>
              <span className="font-medium text-gray-700">Completed:</span>
              <span className="ml-2 text-gray-600">
                {new Date(attempt.completed_at!).toLocaleString()}
              </span>
            </div>
            
            <div>
              <span className="font-medium text-gray-700">Duration:</span>
              <span className="ml-2 text-gray-600">{exam.duration_minutes} minutes</span>
            </div>
          </div>
        </div>

        {/* Show/Hide Answers Toggle */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Review Your Answers</h2>
            <button
              onClick={() => setShowAnswers(!showAnswers)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {showAnswers ? 'Hide Answers' : 'Show Answers'}
            </button>
          </div>
        </div>

        {/* Questions and Answers */}
        {showAnswers && questions.length > 0 && (
          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Question {index + 1}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      question.isCorrect 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {question.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {question.userAnswer?.points_earned || 0}/{question.points} pts
                    </span>
                  </div>
                </div>
                
                <p className="text-gray-700 mb-4">{question.question_text}</p>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Your Answer:</span>
                    <span className={`ml-2 ${question.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {question.userAnswer?.answer || 'Not answered'}
                    </span>
                  </div>
                  
                  {!question.isCorrect && (
                    <div>
                      <span className="font-medium text-gray-700">Correct Answer:</span>
                      <span className="ml-2 text-green-600">{question.correct_answer}</span>
                    </div>
                  )}
                  
                  {question.explanation && (
                    <div>
                      <span className="font-medium text-gray-700">Explanation:</span>
                      <span className="ml-2 text-gray-600">{question.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}