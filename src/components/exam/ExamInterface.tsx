'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Exam, Question, UserExamAttempt } from '@/types/database'
import { CheckCircle } from 'lucide-react'
import PersistentExamTimer from './PersistentExamTimer'
import QuestionDisplay from './QuestionDisplay'
import ExamInstructions from './ExamInstructions'
import DemoExam from './DemoExam'
import StudentWarningDisplay from './StudentWarningDisplay'
import SubmitConfirmationModal from './SubmitConfirmationModal'
import { calculateAndSaveScore, validateAndMarkAnswers } from '@/lib/auto-scoring'
import { shuffleQuestionsForStudent } from '@/lib/question-shuffler'

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
  const [savingAnswer, setSavingAnswer] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [showInstructions, setShowInstructions] = useState(true)
  const [showDemo, setShowDemo] = useState(false)
  const [upcomingExams, setUpcomingExams] = useState<Array<{title: string, date: string, duration: number}>>([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [examStarted, setExamStarted] = useState(false)
  
  const [step, setStep] = useState<'none' | 'confirm' | 'submitting' | 'success'>('none')

  const warningShown = useRef(false)
  const tabSwitchCount = useRef(0)
  const rightClickCount = useRef(0)
  const copyAttempts = useRef(0)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  const logCheatingAttempt = useCallback(async (violationType: string, details: Record<string, unknown>) => {
    if (!attempt) return
    try {
      await supabase
        .from('cheating_logs')
        .insert([{ attempt_id: attempt.id, user_id: profile!.id, violation_type: violationType, violation_details: details }])
    } catch (error) {
      console.error('Error logging cheating attempt:', error)
    }
  }, [attempt, profile])

  const initializeExam = useCallback(async () => {
    if (!profile) return
    try {
      setLoading(true)
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single()
      if (examError) throw examError
      if (examData.class_level !== profile.class_level) {
        throw new Error('You are not authorized to take this exam')
      }
      setExam(examData)
      const { data: attemptData, error: attemptError } = await supabase
        .from('user_exam_attempts')
        .select('*')
        .eq('user_id', profile.id)
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
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at')
      if (questionsError) throw questionsError

      // Normalize options to undefined to satisfy type, and keep full Question objects
      const baseQuestions = (questionsData as unknown as Question[]).map(q => ({
        ...q,
        options: q.options ?? undefined,
      }))
      // Shuffle order deterministically using helper, but preserve full objects
      const shuffledIds = shuffleQuestionsForStudent(baseQuestions, profile.id, examId).map(q => q.id)
      const idToQuestion = new Map(baseQuestions.map(q => [q.id, q]))
      const shuffledQuestions = shuffledIds.map(id => idToQuestion.get(id)!).filter(Boolean) as Question[]
      setQuestions(shuffledQuestions)

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
    } catch (err: unknown) {
      console.error('Error initializing exam:', err)
      setError(err instanceof Error ? err.message : 'Failed to load exam')
    } finally {
      setLoading(false)
    }
  }, [profile, examId, router])

  useEffect(() => {
    if (profile) {
      initializeExam()
    }
  }, [profile, examId, initializeExam])

  const loadUpcomingExams = useCallback(async () => {
    if (!profile?.class_level) return
    try {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('exam_sessions')
        .select(`
          *,
          exam:exams (
            id,
            title,
            duration_minutes,
            total_questions,
            passing_score
          )
        `)
        .eq('class_level', profile.class_level)
        .eq('status', 'active')
        .gte('ends_at', now)
        .order('starts_at', { ascending: true })
        .limit(5)
      if (error) throw error
      const formattedExams = (data || []).map(exam => ({
        title: exam.exam.title,
        date: new Date(exam.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        duration: exam.exam.duration_minutes
      }))
      setUpcomingExams(formattedExams)
    } catch (error) {
      console.error('Error loading upcoming exams:', error)
    } finally {
      setLoadingUpcoming(false)
    }
  }, [profile?.class_level])

  useEffect(() => {
    if (profile?.class_level && showInstructions) {
      loadUpcomingExams()
    }
  }, [profile?.class_level, showInstructions, loadUpcomingExams])

  const saveAnswerToDatabase = useCallback(async (questionId: string, answer: string) => {
    if (!attempt) return
    try {
      setSavingAnswer(true)
      const { error } = await supabase
        .from('user_answers')
        .upsert([{ attempt_id: attempt.id, question_id: questionId, answer }], { onConflict: 'attempt_id,question_id' })
      if (error) throw error
    } catch (err) {
      console.error('Error saving answer:', err)
    } finally {
      setSavingAnswer(false)
    }
  }, [attempt])

  const saveAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveAnswerToDatabase(questionId, answer)
    }, 500)
  }, [saveAnswerToDatabase])

  async function startExam() {
    if (!exam || !profile) return
    try {
      const { data, error } = await supabase
        .from('user_exam_attempts')
        .insert([{ user_id: profile.id, exam_id: exam.id, status: 'in_progress', started_at: new Date().toISOString(), time_remaining: exam.duration_minutes * 60 }])
        .select()
        .single()
      if (error) throw error
      setAttempt(data)
      setExamStarted(true)
      setShowInstructions(false)
    } catch (err: unknown) {
      console.error('Error starting exam:', err)
      setError(err instanceof Error ? err.message : 'Failed to start exam')
    }
  }

  const submitExam = useCallback(async () => {
    if (!attempt || !exam) return
    try {
      const { error: updateError } = await supabase
        .from('user_exam_attempts')
        .update({ status: 'submitted', submitted_at: new Date().toISOString(), completed_at: new Date().toISOString() })
        .eq('id', attempt.id)
      if (updateError) throw updateError
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }))
      const validationResult = await validateAndMarkAnswers(attempt.id, answersArray)
      console.log('Answer validation result:', validationResult)
      const scoringResult = await calculateAndSaveScore(attempt.id)
      if (!scoringResult.success) {
        console.error('Failed to calculate exam score:', scoringResult.error)
      }
    } catch (err: unknown) {
      console.error('Error submitting exam:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit exam')
    }
  }, [attempt, exam, answers])

  const handleTimeUp = useCallback(async () => {
    if (step === 'submitting' || step === 'success') return
    setStep('submitting')
    await submitExam()
    setStep('success')
    setTimeout(() => {
      setStep('none')
      router.push('/dashboard')
    }, 1500)
  }, [submitExam, step, router])

  const handleSubmitClick = useCallback(() => {
    if (step === 'submitting' || step === 'success') return
    setStep('confirm')
  }, [step])

  const handleSubmitConfirm = useCallback(async () => {
    if (step === 'submitting' || step === 'success') return
    setStep('submitting')
    await submitExam()
    setStep('success')
    setTimeout(() => {
      setStep('none')
      router.push('/dashboard')
    }, 1500)
  }, [submitExam, step, router])

  const handleSubmitCancel = useCallback(() => {
    if (step === 'submitting') return
    setStep('none')
  }, [step])

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

  if (showDemo) {
    return (
      <DemoExam 
        onExit={() => {
          setShowDemo(false)
          setShowInstructions(true)
        }}
      />
    )
  }

  if (showInstructions && exam && profile) {
    return (
      <ExamInstructions 
        studentName={profile.full_name}
        examTitle={exam.title} 
        durationMinutes={exam.duration_minutes}
        instructions={exam.description}
        cameraRequired={false}
        onContinueToExam={() => {
          // Start exam first; internal function will toggle UI on success
          startExam()
        }}
        onStartDemo={() => {
          setShowDemo(true)
          setShowInstructions(false)
        }}
        upcomingExams={upcomingExams}
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

      {/* Submission Status */}
      {step === 'submitting' && (
        <div className="bg-blue-500 text-white text-center py-3">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <p>Submitting your exam... Please wait.</p>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="bg-green-500 text-white text-center py-3">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <p>Exam submitted successfully! Redirecting to dashboard...</p>
          </div>
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
                onClick={handleSubmitClick}
                disabled={step === 'submitting' || step === 'success'}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 'submitting' ? 'Submitting...' : step === 'success' ? 'Submitted!' : 'Submit Exam'}
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

      {/* Submit Confirmation Modal */}
      <SubmitConfirmationModal
        isOpen={step !== 'none'}
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