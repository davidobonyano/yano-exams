'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '@/context/SimpleSessionContext'
import { supabase } from '@/lib/supabase'
import { Question, StudentExamAttempt, StudentAnswer } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AnimatedCard, GlassCard, FloatingCard } from '@/components/ui/animated-cards'
import { CircularProgress, AnimatedCounter, ProgressBar } from '@/components/ui/progress-rings'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { VideoStream } from '@/components/ui/video-stream'
import { Clock, AlertTriangle, Wifi, WifiOff, BookOpen, CheckCircle, Circle, ArrowLeft, ArrowRight, Send, Eye, EyeOff, Timer, Target, Zap } from 'lucide-react'
import { useCheatingDetection } from '@/hooks/useCheatingDetection'
import PersistentExamTimer from './PersistentExamTimer'
import SessionQuestionDisplay from './SessionQuestionDisplay'
import ExamInstructions from './ExamInstructions'
import CameraAccess from './CameraAccess'
import SubmitConfirmationModal from './SubmitConfirmationModal'
import StudentWarningDisplay from './StudentWarningDisplay'
import { StudentWebRTC } from '@/lib/webrtc'
import toast from 'react-hot-toast'

interface SessionExamInterfaceProps {
  examId?: string // Make optional since we'll get it from context
}

export default function SessionExamInterface({ examId: propExamId }: SessionExamInterfaceProps) {
  const router = useRouter()
  const { session } = useSession()
  
  // Get examId from session context if not provided as prop
  const examId = propExamId || session?.exam.id || ''
  const sessionId = session?.session.id
  
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionsMap, setQuestionsMap] = useState<Record<string, Question>>({})
  const [attempt, setAttempt] = useState<StudentExamAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingAnswer, setSavingAnswer] = useState(false)
  const [error, setError] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [showInstructions, setShowInstructions] = useState(true)
  const [examStarted, setExamStarted] = useState(false)
  const [cameraAccessRequired, setCameraAccessRequired] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [showCameraAccess, setShowCameraAccess] = useState(false)
  const [webrtcConnection, setWebrtcConnection] = useState<StudentWebRTC | null>(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([0]))

  const warningShown = useRef(false)
  const cameraPromptShown = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Enhanced cheating detection
  const cheatingDetection = useCheatingDetection({
    attemptId: attempt?.id || '',
    studentId: session?.student.id || '',
    sessionId: sessionId || '',
    onViolationDetected: (violationType, details) => {
      console.log('Violation detected:', violationType, details)
      toast.error(`Security warning: ${violationType.replace('_', ' ')}`)
    }
  })

  // Camera access handlers
  const handleCameraGranted = async (stream: MediaStream) => {
    setCameraStream(stream)
    setShowCameraAccess(false)
    cameraPromptShown.current = false
    
    // Update camera status in database for teacher monitoring
    if (session) {
      try {
        // If we have an attempt, update it
        if (attempt) {
          await supabase
            .from('student_exam_attempts')
            .update({ 
              camera_enabled: true,
              last_activity_at: new Date().toISOString()
            })
            .eq('id', attempt.id)
        } else {
          // If no attempt yet, we'll update it later when exam starts
          console.log('Camera granted, will update attempt status when exam starts')
        }

        // Start WebRTC streaming if camera monitoring is enabled
        if (session.session.camera_monitoring_enabled) {
          try {
            const webrtc = new StudentWebRTC(
              session.session.id,
              session.student.id,
              session.session.teacher_id
            )
            await webrtc.startStreaming(stream)
            setWebrtcConnection(webrtc)
            toast.success('Camera streaming ready')
          } catch (webrtcError) {
            console.error('WebRTC error:', webrtcError)
            toast.error('Camera enabled, but live streaming unavailable (check database setup)')
          }
        }
      } catch (error) {
        console.error('Error updating camera status:', error)
        toast.error('Camera enabled, but status update failed')
      }
    }
    
    if (session) {
      initializeExam()
    }
  }

  const handleCameraDeclined = () => {
    cameraPromptShown.current = false // Reset the ref
    if (cameraAccessRequired) {
      // If camera is required, redirect back
      toast.error('Camera access is required for this exam')
      router.push('/')
    } else {
      // If optional, continue without camera
      setShowCameraAccess(false)
      if (session) {
        initializeExam()
      }
    }
  }

  // Validate session context
  useEffect(() => {
    console.log('=== SESSION VALIDATION ===')
    console.log('Session exists:', !!session)
    console.log('Session ID:', sessionId)
    console.log('Exam ID:', examId)
    console.log('Full session:', session)
    
    if (!session || !sessionId || !examId) {
      console.log('Missing session data, waiting...')
      return
    }
    
    console.log('Session validation passed, initializing exam...')

    // Check if camera is required for this session
    const cameraRequired = session.session.camera_monitoring_enabled === true
    
    if (cameraRequired && !cameraStream && !cameraPromptShown.current) {
      setCameraAccessRequired(true)
      setShowCameraAccess(true)
      cameraPromptShown.current = true
      return
    }
    
    if (cameraRequired && !cameraStream && cameraPromptShown.current) {
      return
    }

    initializeExam()
  }, [session, sessionId, examId, cameraStream])

  // Enhanced cheating detection is now handled by the useCheatingDetection hook
  // Additional activity tracking when exam is active
  useEffect(() => {
    if (examStarted && attempt?.status === 'in_progress') {
      const interval = setInterval(() => {
        cheatingDetection.updateActivity()
      }, 120000) // Update activity every 2 minutes instead of 30 seconds

      return () => clearInterval(interval)
    }
  }, [examStarted, attempt, cheatingDetection])

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

  // Cheating logging is now handled by the useCheatingDetection hook

  const initializeExam = async () => {
    console.log('=== INITIALIZE EXAM CALLED ===')
    console.log('Session in initializeExam:', session)
    
    if (!session) {
      console.log('No session in initializeExam, returning')
      return
    }

    try {
      console.log('Setting loading to true')
      setLoading(true)

      // Check for existing attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from('student_exam_attempts')
        .select('*')
        .eq('session_id', session.session.id)
        .eq('student_id', session.student.id)
        .eq('exam_id', examId)
        .maybeSingle()

      if (attemptError) {
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

      if (questionsError) {
        throw questionsError
      }

      if (!questionsData || questionsData.length === 0) {
        throw new Error('No questions found for this exam')
      }

      // Randomize question order for anti-cheating
      const shuffledQuestions = [...questionsData].sort(() => Math.random() - 0.5)
      setQuestions(shuffledQuestions)
      
      // Create questions map for fast lookup
      const qMap: Record<string, Question> = {}
      shuffledQuestions.forEach(question => {
        qMap[question.id] = question
      })
      setQuestionsMap(qMap)

      // Load existing answers if resuming
      if (attemptData && attemptData.status === 'in_progress') {
        const { data: answersData, error: answersError } = await supabase
          .from('student_answers')
          .select('*')
          .eq('attempt_id', attemptData.id)

        if (answersError) {
          throw answersError
        }

        const answersMap: Record<string, string> = {}
        answersData?.forEach(answer => {
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
    if (!session) return

    try {
      console.log('=== STARTING EXAM ===')
      console.log('Session ID:', session.session.id)
      console.log('Student ID:', session.student.id)
      console.log('Exam ID:', session.exam.id)

      // Use upsert to handle existing attempts
      const { data, error } = await supabase
        .from('student_exam_attempts')
        .upsert([{
          session_id: session.session.id,
          student_id: session.student.id,
          exam_id: session.exam.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          time_remaining: session.exam.duration_minutes * 60,
          camera_enabled: !!cameraStream // Set camera status based on current stream
        }], {
          onConflict: 'session_id,student_id,exam_id'
        })
        .select()
        .single()

      console.log('Start exam result:', data)
      console.log('Start exam error:', error)

      if (error) throw error

      setAttempt(data)
      setExamStarted(true)
      setShowInstructions(false)
      console.log('Exam started successfully')
    } catch (err: any) {
      console.error('Error starting exam:', err)
      setError(err.message || 'Failed to start exam')
    }
  }

  const saveAnswerToDatabase = async (questionId: string, answer: string) => {
    if (!attempt) return

    try {
      setSavingAnswer(true)
      
      // Save answer without real-time scoring (scoring will be done at submission)
      const { error } = await supabase
        .from('student_answers')
        .upsert([{
          attempt_id: attempt.id,
          question_id: questionId,
          answer: answer,
          answered_at: new Date().toISOString()
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
    if (!attempt || !session) return

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

      // Redirect to dashboard instead of results (results are now teacher-controlled)
      router.push('/dashboard?examSubmitted=true')
    } catch (err: any) {
      console.error('Error submitting exam:', err)
      setError(err.message || 'Failed to submit exam')
      throw err // Re-throw to let modal handle the error state
    }
  }

  const handleSubmitClick = () => {
    setShowSubmitModal(true)
  }

  const handleSubmitConfirm = async () => {
    await submitExam()
    setShowSubmitModal(false)
  }

  const handleSubmitCancel = () => {
    setShowSubmitModal(false)
  }

  const handleTimeUp = useCallback(async () => {
    await submitExam()
  }, [attempt, session])

  // Cleanup WebRTC connection and save timeout on component unmount
  useEffect(() => {
    return () => {
      if (webrtcConnection) {
        webrtcConnection.destroy()
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [webrtcConnection])

  if (loading && !showCameraAccess) {
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
            className="mx-auto w-16 h-16 border-4 border-primary border-t-transparent rounded-full mb-6"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg font-medium text-muted-foreground"
          >
            Loading exam...
          </motion.p>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-4 h-1 bg-primary/20 rounded-full overflow-hidden max-w-xs mx-auto"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="h-full w-1/3 bg-primary rounded-full"
            />
          </motion.div>
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
          <Card className="border-destructive/20 bg-white/80 backdrop-blur">
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2"
              >
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </motion.div>
              <CardTitle className="text-destructive">Exam Loading Error</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                onClick={() => router.push('/')}
                className="w-full"
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (showInstructions && session) {
    return (
      <ExamInstructions 
        studentName={session.student.full_name}
        examTitle={session.exam.title} 
        durationMinutes={session.exam.duration_minutes}
        instructions={session.exam.instructions}
        onContinueToExam={() => {
          setShowInstructions(false)
          setExamStarted(true)
          startExam()
        }} 
      />
    )
  }

  if (!session || !attempt || questions.length === 0) {
    console.log('=== RENDERING NO EXAM DATA ===')
    console.log('Session missing:', !session)
    console.log('Attempt missing:', !attempt)
    console.log('Questions missing:', questions.length === 0)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-gray-600">No exam data available</p>
          <div className="mt-4 text-sm text-gray-500">
            <p>Session: {session ? '✓' : '✗'}</p>
            <p>Attempt: {attempt ? '✓' : '✗'}</p>
            <p>Questions: {questions.length}</p>
            <p>Loading: {loading ? '✓' : '✗'}</p>
            <p>Show Instructions: {showInstructions ? '✓' : '✗'}</p>
            <p>Exam Started: {examStarted ? '✓' : '✗'}</p>
          </div>
          
          {/* Debug button to reinitialize */}
          <div className="mt-4">
            <button
              onClick={() => {
                console.log('=== MANUAL REINITIALIZE ===')
                setLoading(true)
                setError('')
                initializeExam()
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
            >
              Try Again
            </button>
            
            <button
              onClick={() => {
                console.log('=== CURRENT STATE DEBUG ===')
                console.log('Session:', session)
                console.log('Attempt:', attempt)
                console.log('Questions:', questions)
                console.log('Loading:', loading)
                console.log('Error:', error)
                console.log('Show Instructions:', showInstructions)
                console.log('Exam Started:', examStarted)
              }}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Debug State
            </button>
          </div>
        </div>
      </div>
    )
  }

  const progressPercentage = (Object.keys(answers).length / questions.length) * 100
  const timeRemaining = Math.max(0, (attempt?.time_remaining || 0))
  const totalTime = session.exam.duration_minutes * 60
  const timeProgress = ((totalTime - timeRemaining) / totalTime) * 100

  // Debug render state (removed for cleaner logs)

  // Show camera access prompt if needed
  if (showCameraAccess && session) {
    return (
      <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/80">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">📹 Camera Access Required</h2>
            <p className="mb-4">This exam session requires camera monitoring for academic integrity.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
              <p><strong>Why we need camera access:</strong></p>
              <ul className="list-disc list-inside mt-1 text-gray-700">
                <li>Monitor exam environment</li>
                <li>Ensure academic integrity</li>
                <li>Prevent cheating attempts</li>
              </ul>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                      video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                      },
                      audio: false
                    })
                    handleCameraGranted(stream)
                  } catch (err) {
                    alert('Camera access denied. Please allow camera access to continue with the exam.')
                  }
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium"
              >
                Allow Camera
              </button>
              
              <button
                onClick={handleCameraDeclined}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ userSelect: 'none' }}>
      <AnimatedBackground />
      
      {/* Student Camera Preview */}
      {cameraStream && (
        <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-lg p-2">
          <div className="relative">
            <VideoStream
              stream={cameraStream}
              className="w-32 h-24 rounded-lg object-cover"
            />
            <div className="absolute top-1 left-1 bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
            <div className="text-xs text-gray-600 text-center mt-1">Your Camera</div>
          </div>
        </div>
      )}
      
      {/* Status Bars */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="bg-destructive text-destructive-foreground text-center py-3 shadow-lg z-50 relative"
          >
            <div className="flex items-center justify-center space-x-2">
              <WifiOff className="w-4 h-4" />
              <p className="font-medium">You are offline. Timer continues running. Please reconnect to save your progress.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 p-4"
      >
        <GlassCard className="mx-auto max-w-7xl p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <FloatingCard delay={0} amplitude={5}>
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="w-12 h-12 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Target className="w-6 h-6 text-white" />
                </motion.div>
              </FloatingCard>
              
              <div>
                <h1 className="text-xl font-bold text-foreground">{session.exam.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                  <Badge variant="outline" className="bg-white/50">
                    Session: {session.session.session_code}
                  </Badge>
                  <div className="flex items-center space-x-1">
                    {isOnline ? (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Wifi className="w-3 h-3 text-green-500" />
                      </motion.div>
                    ) : (
                      <WifiOff className="w-3 h-3 text-red-500" />
                    )}
                    <span className={isOnline ? "text-green-600" : "text-red-600"}>
                      {isOnline ? "Connected" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timer with Progress Ring */}
            <div className="flex items-center space-x-4">
              <CircularProgress
                progress={100 - timeProgress}
                size={80}
                strokeWidth={6}
                color="#ef4444"
                backgroundColor="#fef2f2"
              >
                <div className="text-center">
                  <Timer className="w-4 h-4 mx-auto text-red-500 mb-1" />
                  <PersistentExamTimer
                    attemptId={attempt.id}
                    initialTimeRemaining={attempt.time_remaining || session.exam.duration_minutes * 60}
                    onTimeUp={handleTimeUp}
                  />
                </div>
              </CircularProgress>
            </div>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                <AnimatedCounter value={Object.keys(answers).length} /> of {questions.length} answered
              </span>
              <span>
                <AnimatedCounter value={Math.round(progressPercentage)} suffix="%" />% complete
              </span>
            </div>
            <ProgressBar 
              progress={progressPercentage} 
              height={6}
              color="linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)"
              className="rounded-full"
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Question Content */}
          <div className="xl:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.95 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              >
                <AnimatedCard 
                  className="h-full"
                  hoverScale={1.01}
                  glowColor="rgba(59, 130, 246, 0.2)"
                >
                  <GlassCard className="h-full">
                    <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-t-2xl" />
                    
                    <div className="p-8">
                      {/* Question Header */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center justify-between mb-6"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                            {currentQuestionIndex + 1}
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold">Question {currentQuestionIndex + 1}</h2>
                            <p className="text-sm text-muted-foreground">
                              {questions[currentQuestionIndex]?.points} points
                            </p>
                          </div>
                        </div>
                        
                        <Badge 
                          variant={answers[questions[currentQuestionIndex]?.id] ? "default" : "outline"}
                          className="flex items-center space-x-1"
                        >
                          {answers[questions[currentQuestionIndex]?.id] ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                          <span>{answers[questions[currentQuestionIndex]?.id] ? "Answered" : "Unanswered"}</span>
                        </Badge>
                      </motion.div>

                      <SessionQuestionDisplay
                        question={questions[currentQuestionIndex]}
                        answer={answers[questions[currentQuestionIndex]?.id] || ''}
                        onAnswerChange={(answer) => saveAnswer(questions[currentQuestionIndex].id, answer)}
                        isSaving={savingAnswer}
                      />

                      {/* Enhanced Navigation */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-8 flex justify-between items-center"
                      >
                        <MagneticButton
                          onClick={() => {
                            const newIndex = Math.max(0, currentQuestionIndex - 1)
                            setCurrentQuestionIndex(newIndex)
                            setVisitedQuestions(prev => new Set(prev).add(newIndex))
                          }}
                          disabled={currentQuestionIndex === 0}
                          variant="outline"
                          size="lg"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Previous
                        </MagneticButton>

                        <div className="text-center space-y-2">
                          <CircularProgress
                            progress={((currentQuestionIndex + 1) / questions.length) * 100}
                            size={60}
                            strokeWidth={4}
                            color="#3b82f6"
                          >
                            <span className="text-xs font-medium">
                              {currentQuestionIndex + 1}/{questions.length}
                            </span>
                          </CircularProgress>
                        </div>

                        {currentQuestionIndex === questions.length - 1 ? (
                          <MagneticButton
                            onClick={handleSubmitClick}
                            variant="primary"
                            size="lg"
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Submit Exam
                          </MagneticButton>
                        ) : (
                          <MagneticButton
                            onClick={() => {
                              const newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1)
                              setCurrentQuestionIndex(newIndex)
                              setVisitedQuestions(prev => new Set(prev).add(newIndex))
                            }}
                            variant="primary"
                            size="lg"
                          >
                            Next
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </MagneticButton>
                        )}
                      </motion.div>
                    </div>
                  </GlassCard>
                </AnimatedCard>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Enhanced Sidebar */}
          <div className="xl:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="sticky top-32 space-y-6"
            >
              {/* Question Grid */}
              <AnimatedCard hoverScale={1.02}>
                <GlassCard>
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="font-bold mb-2 flex items-center space-x-2">
                        <Eye className="w-5 h-5 text-blue-500" />
                        <span>Question Navigator</span>
                      </h3>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded"></div>
                          <span>Answered</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-gradient-to-r from-red-400 to-red-500 rounded"></div>
                          <span>Visited, not answered</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-white border border-gray-200 rounded"></div>
                          <span>Not visited</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-5 gap-2 mb-6">
                      {questions.map((question, index) => (
                        <motion.button
                          key={question.id}
                          whileHover={{ scale: 1.1, rotateZ: 5 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setCurrentQuestionIndex(index)
                            setVisitedQuestions(prev => new Set(prev).add(index))
                          }}
                          className={`w-10 h-10 text-xs font-medium rounded-xl transition-all duration-300 ${
                            index === currentQuestionIndex
                              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                              : answers[question.id]
                              ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md'
                              : visitedQuestions.has(index)
                              ? 'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-md hover:from-red-500 hover:to-red-600'
                              : 'bg-white/50 text-gray-600 hover:bg-white/80 border border-gray-200'
                          }`}
                        >
                          {answers[question.id] ? (
                            <CheckCircle className="w-4 h-4 mx-auto" />
                          ) : (
                            index + 1
                          )}
                        </motion.button>
                      ))}
                    </div>

                    {/* Progress Stats */}
                    <div className="space-y-4">
                      <div className="text-center">
                        <CircularProgress
                          progress={progressPercentage}
                          size={100}
                          strokeWidth={8}
                          color="#3b82f6"
                        >
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              <AnimatedCounter value={Math.round(progressPercentage)} suffix="%" />
                            </div>
                            <div className="text-xs text-gray-500">Complete</div>
                          </div>
                        </CircularProgress>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FloatingCard delay={0.2} amplitude={3}>
                          <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
                            <Zap className="w-5 h-5 text-green-600 mx-auto mb-1" />
                            <div className="text-xl font-bold text-green-600">
                              <AnimatedCounter value={Object.keys(answers).length} />
                            </div>
                            <div className="text-xs text-green-600">Answered</div>
                          </div>
                        </FloatingCard>
                        
                        <FloatingCard delay={0.4} amplitude={3}>
                          <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-red-100 rounded-xl border border-orange-200">
                            <Timer className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                            <div className="text-xl font-bold text-orange-600">
                              <AnimatedCounter value={questions.length - Object.keys(answers).length} />
                            </div>
                            <div className="text-xs text-orange-600">Remaining</div>
                          </div>
                        </FloatingCard>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </AnimatedCard>

              {/* Quick Actions */}
              <AnimatedCard hoverScale={1.02}>
                <GlassCard>
                  <div className="p-6">
                    <h3 className="font-bold mb-4 flex items-center space-x-2">
                      <Zap className="w-5 h-5 text-purple-500" />
                      <span>Quick Actions</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <MagneticButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const unanswered = questions.findIndex((q, i) => !answers[q.id] && i > currentQuestionIndex)
                          if (unanswered !== -1) {
                            setCurrentQuestionIndex(unanswered)
                            setVisitedQuestions(prev => new Set(prev).add(unanswered))
                          }
                        }}
                        className="text-xs"
                      >
                        Next Unanswered
                      </MagneticButton>
                      
                      <MagneticButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentQuestionIndex(questions.length - 1)
                          setVisitedQuestions(prev => new Set(prev).add(questions.length - 1))
                        }}
                        className="text-xs"
                      >
                        Go to Last
                      </MagneticButton>
                    </div>
                  </div>
                </GlassCard>
              </AnimatedCard>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      <SubmitConfirmationModal
        isOpen={showSubmitModal}
        onClose={handleSubmitCancel}
        onConfirm={handleSubmitConfirm}
        questionsAnswered={Object.keys(answers).length}
        totalQuestions={questions.length}
        timeRemaining={timeRemaining}
      />

      {/* Student Warning Display */}
      {session && attempt && (
        <StudentWarningDisplay
          sessionId={session.session.id}
          studentId={session.student.id}
          attemptId={attempt.id}
        />
      )}
    </div>
  )
}