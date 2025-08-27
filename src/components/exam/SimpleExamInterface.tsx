'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Question, StudentExamAttempt, StudentAnswer } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import PersistentExamTimer from './PersistentExamTimer'
import SessionQuestionDisplay from './SessionQuestionDisplay'
import SubmitConfirmationModal from './SubmitConfirmationModal'
import StudentWarningDisplay from './StudentWarningDisplay'
import { Clock, AlertTriangle, CheckCircle, Circle, ArrowLeft, ArrowRight, Send, Timer, Target } from 'lucide-react'
import toast from 'react-hot-toast'

interface SessionData {
  student_name: string
  session_id: string
  exam_id: string
  exam_title: string
  duration_minutes: number
  instructions?: string
  participant_id: string
  student_id: string
  can_resume?: boolean
  attempt_id?: string
  time_remaining?: number
}

interface SimpleExamInterfaceProps {
  sessionData: SessionData
  onExamComplete: () => void
}

export default function SimpleExamInterface({ sessionData, onExamComplete }: SimpleExamInterfaceProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<StudentExamAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [examStarted, setExamStarted] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [step, setStep] = useState<'none' | 'confirm' | 'submitting' | 'success'>('none')
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([0]))

  useEffect(() => {
    initializeExam()
  }, [])

  const initializeExam = async () => {
    try {
      setLoading(true)

      // Check for existing attempt first
      if (sessionData.can_resume && sessionData.attempt_id) {
        const { data: attemptData, error: attemptError } = await supabase
          .from('student_exam_attempts')
          .select('*')
          .eq('id', sessionData.attempt_id)
          .single()

        if (attemptError) {
          console.error('Error fetching existing attempt:', attemptError)
        } else if (attemptData) {
          if (attemptData.status === 'submitted' || attemptData.status === 'completed') {
            // Redirect to results if already completed
            window.location.href = `/results/${attemptData.id}`
            return
          }
          setAttempt(attemptData)
          setExamStarted(true)
        }
      }

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', sessionData.exam_id)
        .order('created_at')

      if (questionsError) {
        throw questionsError
      }

      if (!questionsData || questionsData.length === 0) {
        throw new Error('No questions found for this exam')
      }

      // Randomize question order
      const shuffledQuestions = [...questionsData].sort(() => Math.random() - 0.5)
      setQuestions(shuffledQuestions)

      // Load existing answers if resuming
      if (sessionData.can_resume && sessionData.attempt_id) {
        const { data: answersData, error: answersError } = await supabase
          .from('student_answers')
          .select('*')
          .eq('attempt_id', sessionData.attempt_id)

        if (answersError) {
          console.error('Error loading existing answers:', answersError)
        } else if (answersData) {
          const answersMap: Record<string, string> = {}
          answersData.forEach(answer => {
            answersMap[answer.question_id] = answer.answer
          })
          setAnswers(answersMap)
        }
      }

    } catch (err: unknown) {
      console.error('Error initializing exam:', err)
      setError(err instanceof Error ? err.message : 'Failed to load exam')
    } finally {
      setLoading(false)
    }
  }

  const startExam = async () => {
    try {
      console.log('Starting exam...')
      
      // Use the start_exam_attempt function
      const { data, error } = await supabase.rpc('start_exam_attempt', {
        p_session_id: sessionData.session_id,
        p_student_id: sessionData.student_id,
        p_browser_info: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform
        },
        p_ip_address: null // Could get from a service if needed
      })

      if (error) throw error

      const result = data
      if (!result.success) {
        throw new Error(result.error)
      }

      // Create attempt object
      const newAttempt: StudentExamAttempt = {
        id: result.attempt_id,
        session_id: sessionData.session_id,
        student_id: sessionData.student_id,
        exam_id: sessionData.exam_id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        time_remaining: result.time_remaining,
        is_paused: false,
        created_at: new Date().toISOString()
      }

      setAttempt(newAttempt)
      setExamStarted(true)
      
      toast.success('Exam started successfully!')
    } catch (err: unknown) {
      console.error('Error starting exam:', err)
      setError(err instanceof Error ? err.message : 'Failed to start exam')
    }
  }

  const saveAnswer = async (questionId: string, answer: string) => {
    if (!attempt) return

    try {
      // Get question details to check if answer is correct
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single()

      if (questionError) {
        console.error('Error fetching question:', questionError)
        return
      }

      // Determine if answer is correct
      let isCorrect = false
      let pointsEarned = 0

      if (question.question_type === 'multiple_choice') {
        isCorrect = answer.toUpperCase() === question.correct_answer.toUpperCase()
      } else if (question.question_type === 'true_false') {
        // Handle both A: True, B: False format and direct true/false format
        if (question.options && Object.keys(question.options).length > 0) {
          // Format: A: True, B: False - check if student selected the correct option
          isCorrect = answer.toUpperCase() === question.correct_answer.toUpperCase()
        } else {
          // Direct true/false format
          isCorrect = answer.toLowerCase() === question.correct_answer.toLowerCase()
        }
      } else if (question.question_type === 'short_answer') {
        const studentAnswer = answer.toLowerCase().trim()
        const correctAnswer = question.correct_answer.toLowerCase().trim()
        isCorrect = studentAnswer === correctAnswer
      } else if (question.question_type === 'fill_in_gap') {
        // For fill-in-the-gap, do case-insensitive comparison
        const studentAnswer = answer.toLowerCase().trim()
        const correctAnswer = question.correct_answer.toLowerCase().trim()
        isCorrect = studentAnswer === correctAnswer
      } else if (question.question_type === 'subjective') {
        // For subjective questions, we can't auto-score - mark as needs manual review
        // For now, we'll give partial credit if they write something substantial
        const studentAnswer = answer.trim()
        isCorrect = studentAnswer.length > 10 // Give credit for substantial answers
        pointsEarned = isCorrect ? Math.min(question.points || 1, 1) : 0 // Max 1 point for auto-scoring
      }

      if (isCorrect) {
        pointsEarned = question.points
      }

      // Save answer with scoring information
      const { error } = await supabase
        .from('student_answers')
        .upsert([{
          attempt_id: attempt.id,
          question_id: questionId,
          answer: answer,
          is_correct: isCorrect,
          points_earned: pointsEarned,
          answered_at: new Date().toISOString()
        }], {
          onConflict: 'attempt_id,question_id'
        })

      if (error) throw error

      setAnswers(prev => ({ ...prev, [questionId]: answer }))
    } catch (err) {
      console.error('Error saving answer:', err)
      toast.error('Failed to save answer')
    }
  }

  const submitExam = async () => {
    if (!attempt) return

    try {
      // Update attempt status
      const { error: updateError } = await supabase
        .from('student_exam_attempts')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', attempt.id)

      if (updateError) throw updateError

      // Calculate and save results
      const { data: scoreData, error: scoreError } = await supabase.rpc('calculate_exam_score', {
        p_attempt_id: attempt.id
      })

      if (scoreError) {
        console.error('Error calculating score:', scoreError)
      }

      toast.success('Exam submitted successfully!')
      
      // Navigate to results page
      window.location.href = `/results/${attempt.id}`
    } catch (err: unknown) {
      console.error('Error submitting exam:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit exam')
      throw err
    }
  }

  const handleTimeUp = useCallback(async () => {
    await submitExam()
  }, [attempt])

  const handleSubmitClick = () => {
    setShowSubmitModal(true)
    setStep('confirm')
  }

  const handleSubmitConfirm = async () => {
    setStep('submitting')
    await submitExam()
    setShowSubmitModal(false)
    setStep('success')
    setTimeout(() => {
      setStep('none')
    }, 1500)
  }

  const handleSubmitCancel = () => {
    setShowSubmitModal(false)
    if (step !== 'submitting') setStep('none')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mb-6"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg font-medium text-gray-600"
          >
            Loading exam...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <Card className="border-red-200 bg-white">
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2"
              >
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </motion.div>
              <CardTitle className="text-red-600">Exam Loading Error</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-gray-600">{error}</p>
              <Button
                onClick={() => window.location.href = '/'}
                className="w-full"
                variant="outline"
              >
                Return to Login
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-cyan-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="bg-white shadow-xl">
            <CardHeader className="text-center bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4"
              >
                <Target className="w-8 h-8" />
              </motion.div>
              <CardTitle className="text-xl">Ready to Begin?</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">{sessionData.exam_title}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <Timer className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                      <div className="font-medium">{sessionData.duration_minutes} minutes</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <Target className="w-5 h-5 text-green-500 mx-auto mb-1" />
                      <div className="font-medium">{questions.length} questions</div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> Once you start, the timer will run continuously. 
                    You can resume if disconnected, but the timer keeps running.
                  </p>
                </div>

                <Button
                  onClick={startExam}
                  className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Start Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (!attempt || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-gray-600">Exam data not available</p>
          <Button
            onClick={() => window.location.href = '/'}
            className="mt-4"
            variant="outline"
          >
            Return to Login
          </Button>
        </div>
      </div>
    )
  }

  const progressPercentage = (Object.keys(answers).length / questions.length) * 100
  const currentQuestion = questions[currentQuestionIndex]

  return (
    <div className="min-h-screen bg-gray-50" style={{ userSelect: 'none' }}>
      {/* Student Warning Display */}
      {attempt && (
        <StudentWarningDisplay
          sessionId={sessionData.session_id}
          studentId={sessionData.student_id}
          attemptId={attempt.id}
        />
      )}

      {/* Persistent Timer */}
      {attempt && (
        <PersistentExamTimer
          attemptId={attempt.id}
          initialTimeRemaining={attempt.time_remaining || sessionData.duration_minutes * 60}
          onTimeUp={handleTimeUp}
        />
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{sessionData.exam_title}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                <Badge variant="outline">Session: {sessionData.session_id}</Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Progress</div>
              <div className="text-lg font-bold text-blue-600">
                {Math.round(progressPercentage)}%
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Question Content */}
          <div className="lg:col-span-3">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {currentQuestionIndex + 1}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Question {currentQuestionIndex + 1}</h2>
                      <p className="text-sm text-gray-600">{currentQuestion?.points} points</p>
                    </div>
                  </div>
                  
                  <Badge 
                    variant={answers[currentQuestion?.id] ? "default" : "outline"}
                    className="flex items-center space-x-1"
                  >
                    {answers[currentQuestion?.id] ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                    <span>{answers[currentQuestion?.id] ? "Answered" : "Unanswered"}</span>
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <SessionQuestionDisplay
                  question={currentQuestion}
                  answer={answers[currentQuestion?.id] || ''}
                  onAnswerChange={(answer) => saveAnswer(currentQuestion.id, answer)}
                />

                {/* Navigation */}
                <div className="mt-8 flex justify-between items-center">
                  <Button
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                    variant="outline"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>

                  <span className="text-sm text-gray-600">
                    {currentQuestionIndex + 1} of {questions.length}
                  </span>

                  {currentQuestionIndex === questions.length - 1 ? (
                    <Button
                      onClick={handleSubmitClick}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit Exam
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                    >
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Navigator Sidebar */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Question Navigator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {questions.map((question, index) => (
                    <button
                      key={question.id}
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={`w-8 h-8 text-xs font-medium rounded transition-all ${
                        index === currentQuestionIndex
                          ? 'bg-blue-500 text-white'
                          : answers[question.id]
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {answers[question.id] ? (
                        <CheckCircle className="w-3 h-3 mx-auto" />
                      ) : (
                        index + 1
                      )}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Answered:</span>
                    <span className="font-bold text-green-600">{Object.keys(answers).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Remaining:</span>
                    <span className="font-bold text-orange-600">{questions.length - Object.keys(answers).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Progress:</span>
                    <span className="font-bold text-blue-600">{Math.round(progressPercentage)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      <SubmitConfirmationModal
        isOpen={showSubmitModal}
        step={step === 'confirm' ? 'confirm' : step === 'submitting' ? 'submitting' : step === 'success' ? 'success' : 'confirm'}
        onClose={handleSubmitCancel}
        onConfirm={handleSubmitConfirm}
        questionsAnswered={Object.keys(answers).length}
        totalQuestions={questions.length}
        timeRemaining={attempt?.time_remaining || 0}
      />
    </div>
  )
}