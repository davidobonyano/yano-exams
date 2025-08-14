'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Exam, Question, UserExamAttempt, UserAnswer } from '@/types/database'
import PersistentExamTimer from './PersistentExamTimer'
import QuestionDisplay from './QuestionDisplay'
import ExamInstructions from './ExamInstructions'
import StudentWarningDisplay from './StudentWarningDisplay'
import { calculateAndSaveScore, validateAndMarkAnswers } from '@/lib/auto-scoring'

interface ExamInterfaceProps {
  examId: string
}

export default function ExamInterface({ examId }: ExamInterfaceProps) {
  const router = useRouter()
  const { profile } = useAuth()
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempt, setAttempt] = useState<UserExamAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingAnswer, setSavingAnswer] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [showInstructions, setShowInstructions] = useState(true)
  const [examStarted, setExamStarted] = useState(false)

  const warningShown = useRef(false)
  const tabSwitchCount = useRef(0)
  const rightClickCount = useRef(0)
  const copyAttempts = useRef(0)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Anti-cheating: Monitor tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && examStarted && attempt?.status === 'in_progress') {
        tabSwitchCount.current += 1
        logCheatingAttempt('tab_switch', {
          count: tabSwitchCount.current,
          timestamp: new Date().toISOString()
        })
        
        if (tabSwitchCount.current >= 3) {
          setWarnings(prev => [...prev, 'Multiple tab switches detected. This may result in exam termination.'])
        } else {
          setWarnings(prev => [...prev, `Tab switch detected (${tabSwitchCount.current}/3). Please stay on the exam page.`])
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [examStarted, attempt])

  // Anti-cheating: Disable right-click and copy/paste
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (examStarted) {
        e.preventDefault()
        rightClickCount.current += 1
        logCheatingAttempt('right_click', {
          count: rightClickCount.current,
          timestamp: new Date().toISOString()
        })
        setWarnings(prev => [...prev, 'Right-click is disabled during the exam.'])
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (examStarted) {
        // Disable common copy/paste shortcuts
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 's'].includes(e.key.toLowerCase())) {
          e.preventDefault()
          copyAttempts.current += 1
          logCheatingAttempt('copy_paste_attempt', {
            key: e.key,
            count: copyAttempts.current,
            timestamp: new Date().toISOString()
          })
          setWarnings(prev => [...prev, 'Copy/paste operations are disabled during the exam.'])
        }
        
        // Disable F12, F5, Ctrl+Shift+I, etc.
        if (e.key === 'F12' || e.key === 'F5' || 
            (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
            (e.ctrlKey && e.key === 'U')) {
          e.preventDefault()
          logCheatingAttempt('dev_tools_attempt', {
            key: e.key,
            timestamp: new Date().toISOString()
          })
          setWarnings(prev => [...prev, 'Developer tools and page refresh are disabled during the exam.'])
        }
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [examStarted])

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const logCheatingAttempt = async (violationType: string, details: any) => {
    if (!attempt) return

    try {
      await supabase
        .from('cheating_logs')
        .insert([{
          attempt_id: attempt.id,
          user_id: profile!.id,
          violation_type: violationType,
          violation_details: details
        }])
    } catch (error) {
      console.error('Error logging cheating attempt:', error)
    }
  }

  useEffect(() => {
    if (profile) {
      initializeExam()
    }
  }, [profile, examId])

  const initializeExam = async () => {
    try {
      setLoading(true)

      // Fetch exam details
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single()

      if (examError) throw examError
      
      // Check if user's class matches exam class
      if (examData.class_level !== profile!.class_level) {
        throw new Error('You are not authorized to take this exam')
      }

      setExam(examData)

      // Check for existing attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from('user_exam_attempts')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('exam_id', examId)
        .single()

      if (attemptError && attemptError.code !== 'PGRST116') {
        throw attemptError
      }

      if (attemptData) {
        if (attemptData.status === 'submitted' || attemptData.status === 'completed') {
          router.push(`/results/${attemptData.id}`)
          return
        }
        setAttempt(attemptData)
        setExamStarted(true)
        setShowInstructions(false)
      }

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at')

      if (questionsError) throw questionsError

      // Randomize question order for anti-cheating
      const shuffledQuestions = [...questionsData].sort(() => Math.random() - 0.5)
      setQuestions(shuffledQuestions)

      // Load existing answers if resuming
      if (attemptData && attemptData.status === 'in_progress') {
        const { data: answersData, error: answersError } = await supabase
          .from('user_answers')
          .select('*')
          .eq('attempt_id', attemptData.id)

        if (answersError) throw answersError

        const answersMap: Record<string, string> = {}
        answersData.forEach(answer => {
          answersMap[answer.question_id] = answer.answer
        })
        setAnswers(answersMap)
      }

    } catch (err: any) {
      console.error('Error initializing exam:', err)
      setError(err.message || 'Failed to load exam')
    } finally {
      setLoading(false)
    }
  }

  const startExam = async () => {
    if (!exam || !profile) return

    try {
      const { data, error } = await supabase
        .from('user_exam_attempts')
        .insert([{
          user_id: profile.id,
          exam_id: exam.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          time_remaining: exam.duration_minutes * 60
        }])
        .select()
        .single()

      if (error) throw error

      setAttempt(data)
      setExamStarted(true)
      setShowInstructions(false)
    } catch (err: any) {
      console.error('Error starting exam:', err)
      setError(err.message || 'Failed to start exam')
    }
  }

  const saveAnswerToDatabase = async (questionId: string, answer: string) => {
    if (!attempt) return

    try {
      setSavingAnswer(true)
      
      const { error } = await supabase
        .from('user_answers')
        .upsert([{
          attempt_id: attempt.id,
          question_id: questionId,
          answer: answer
        }], {
          onConflict: 'attempt_id,question_id'
        })

      if (error) throw error
    } catch (err) {
      console.error('Error saving answer:', err)
    } finally {
      setSavingAnswer(false)
    }
  }

  const saveAnswer = (questionId: string, answer: string) => {
    // Immediately update local state for responsiveness
    setAnswers(prev => ({ ...prev, [questionId]: answer }))

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce database save by 500ms
    saveTimeoutRef.current = setTimeout(() => {
      saveAnswerToDatabase(questionId, answer)
    }, 500)
  }

  const submitExam = async () => {
    if (!attempt || !exam) return

    try {
      setSubmitting(true)

      // Update attempt status
      const { error: updateError } = await supabase
        .from('user_exam_attempts')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', attempt.id)

      if (updateError) throw updateError

      // First validate and mark all answers as correct/incorrect
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }))
      
      console.log('Validating answers for attempt:', attempt.id, answersArray)
      const validationResult = await validateAndMarkAnswers(attempt.id, answersArray)
      console.log('Answer validation result:', validationResult)

      // Calculate and save the exam score
      console.log('Calculating exam score for attempt:', attempt.id)
      const scoringResult = await calculateAndSaveScore(attempt.id)
      
      if (scoringResult.success) {
        console.log('Exam score calculated successfully:', scoringResult)
      } else {
        console.error('Failed to calculate exam score:', scoringResult.error)
      }

      // Redirect to dashboard instead of results (results are now teacher-controlled)
      router.push('/dashboard?examSubmitted=true')
    } catch (err: any) {
      console.error('Error submitting exam:', err)
      setError(err.message || 'Failed to submit exam')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTimeUp = useCallback(async () => {
    await submitExam()
  }, [attempt, exam])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading exam...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-md bg-red-50 p-4 max-w-md">
          <div className="text-sm text-red-800">{error}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (showInstructions && exam && profile) {
    return (
      <ExamInstructions 
        studentName={profile.full_name}
        examTitle={exam.title} 
        durationMinutes={exam.duration_minutes}
        instructions={exam.description}
        onContinueToExam={() => {
          setShowInstructions(false)
          setExamStarted(true)
          startExam()
        }} 
      />
    )
  }

  if (!exam || !attempt || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-gray-600">No exam data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ userSelect: 'none' }}>
      {/* Student Warning Display */}
      {attempt && profile && (
        <StudentWarningDisplay
          sessionId="standalone"
          studentId={profile.id}
          attemptId={attempt.id}
        />
      )}

      {/* Network Status */}
      {!isOnline && (
        <div className="bg-red-500 text-white text-center py-2">
          <p>You are offline. Timer is paused. Please check your internet connection.</p>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-500 text-white text-center py-2">
          <p>{warnings[warnings.length - 1]}</p>
          <button
            onClick={() => setWarnings([])}
            className="ml-2 text-yellow-100 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header with Timer */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{exam.title}</h1>
              <p className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <PersistentExamTimer
              attemptId={attempt.id}
              initialTimeRemaining={attempt.time_remaining || exam.duration_minutes * 60}
              onTimeUp={handleTimeUp}
              tableName="user_exam_attempts"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <QuestionDisplay
            question={questions[currentQuestionIndex]}
            answer={answers[questions[currentQuestionIndex]?.id] || ''}
            onAnswerChange={(answer) => saveAnswer(questions[currentQuestionIndex].id, answer)}
          />

          {/* Navigation */}
          <div className="mt-8 flex justify-between items-center">
            <button
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <span className="text-sm text-gray-600">
              {Object.keys(answers).length} of {questions.length} answered
            </span>

            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={submitExam}
                disabled={submitting}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Next
              </button>
            )}
          </div>
        </div>

        {/* Question Overview */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Question Overview</h3>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-8 h-8 text-xs rounded ${
                  index === currentQuestionIndex
                    ? 'bg-indigo-600 text-white'
                    : answers[question.id]
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}