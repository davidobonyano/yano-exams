'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '@/context/SimpleSessionContext'
import { supabase } from '@/lib/supabase'
import { Question, StudentExamAttempt, Exam } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

import { calculateAndSaveScore, validateAndMarkAnswers } from '@/lib/auto-scoring'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { VideoStream } from '@/components/ui/video-stream'
import { AlertTriangle, Wifi, WifiOff, CheckCircle, Circle, ArrowLeft, ArrowRight, Send, Timer, Target, Zap, Camera, CameraOff, BarChart3, Flag } from 'lucide-react'
import { useCheatingDetection } from '@/hooks/useCheatingDetection'
import { useServerAnchoredTimer } from '@/hooks/useServerAnchoredTimer'
import SessionQuestionDisplay from './SessionQuestionDisplay'
import ExamInstructions from './ExamInstructions'
import DemoExam from './DemoExam'

import SubmitConfirmationModal from './SubmitConfirmationModal'
import StudentWarningDisplay from './StudentWarningDisplay'
import { StudentWebRTC as OldStudentWebRTC } from '@/lib/webrtc'
import { shuffleQuestionsForStudent } from '@/lib/question-shuffler'
import { CameraFrameStreaming } from '@/lib/camera-streaming'
import toast from 'react-hot-toast'
function ServerAnchoredTimerUI({ attemptId, onTimeUp }: { attemptId: string; onTimeUp: () => void }) {
  const { remainingSeconds, serverSynced } = useServerAnchoredTimer({ attemptId, onTimeUp })

  const format = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`
  }

  return (
    <div className="text-center p-4 border rounded-lg bg-red-50">
      <Timer className="w-4 h-4 mx-auto text-red-500 mb-1" />
      <div className="text-lg font-semibold text-red-700">
        {remainingSeconds === null ? (serverSynced ? '—' : 'Syncing…') : format(remainingSeconds)}
      </div>
      <div className="text-xs text-red-600">Server-anchored</div>
    </div>
  )
}

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
  const [attempt, setAttempt] = useState<StudentExamAttempt | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingAnswer, setSavingAnswer] = useState(false)
  const [error, setError] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [showInstructions, setShowInstructions] = useState(true)
  const [showDemo, setShowDemo] = useState(false)
  const [upcomingExams, setUpcomingExams] = useState<Array<{title: string, date: string, duration: number}>>([])
  const [examStarted, setExamStarted] = useState(false)
  const [cameraAccessRequired, setCameraAccessRequired] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [_webrtcInitialized, setWebrtcInitialized] = useState(false)

  const [webrtcConnection, _setWebrtcConnection] = useState<OldStudentWebRTC | null>(null)

  const [frameStreaming, setFrameStreaming] = useState<CameraFrameStreaming | null>(null)
  const [step, setStep] = useState<'none' | 'confirm' | 'submitting' | 'success'>('none')
  const [examCompleted, setExamCompleted] = useState(false)
  const [examInitialized, setExamInitialized] = useState(false)
  const [cameraAccessDisabled, setCameraAccessDisabled] = useState(false)
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([0]))

  const warningShown = useRef(false)
  const cameraPromptShown = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Store refs for cleanup to avoid dependency issues
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const webrtcConnectionRef = useRef<OldStudentWebRTC | null>(null)
  const webrtcCleanupRef = useRef<(() => void) | null>(null)
  const frameStreamingRef = useRef<CameraFrameStreaming | null>(null)
  
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

  // Step-scoped camera handling for confirmation flow
  const confirmStepCameraStartedRef = useRef(false)
  const confirmStepStreamRef = useRef<MediaStream | null>(null)

  // Camera access handlers
  const handleCameraGranted = async (stream: MediaStream) => {
    console.log('🎥 Camera granted, setting up...')
    console.log('🔍 STREAM DEBUG:', {
      id: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    })
    
    // Check each video track
    stream.getVideoTracks().forEach((track, index) => {
      console.log(`📹 Video track ${index}:`, {
        enabled: track.enabled,
        readyState: track.readyState,
        settings: track.getSettings(),
        constraints: track.getConstraints()
      })
    })
    
    setCameraStream(stream)
    cameraPromptShown.current = false
    
    // Start snapshot streaming every 3s (fallback to frames)
    try {
      if (session && session.session && session.student) {
        const videoEl = document.createElement('video')
        videoEl.autoplay = true
        videoEl.muted = true
        videoEl.playsInline = true
        videoEl.srcObject = stream
        // Keep offscreen; no DOM append required
        await videoEl.play().catch(() => {})

        const streamer = new CameraFrameStreaming(session.session.id, session.student.id, videoEl)
        streamer.startStreaming()
        setFrameStreaming(streamer)
        frameStreamingRef.current = streamer
        console.log('📸 Snapshot streaming started')
      }
    } catch (e) {
      console.warn('Could not start snapshot streaming:', e)
    }

    // Update camera status in database for teacher monitoring
    if (session) {
      try {
        // If we have an attempt with valid ID, update it
        if (attempt && attempt.id) {
          console.log('Updating camera status for attempt:', attempt.id)
          const { error: updateError } = await supabase
            .from('student_exam_attempts')
            .update({ 
              camera_enabled: true,
              last_activity_at: new Date().toISOString()
            })
            .eq('id', attempt.id)
          
          if (updateError) {
            console.error('Failed to update camera status:', updateError)
          } else {
            console.log('Camera status updated successfully')
          }
        } else {
          // If no attempt yet, we'll update it later when exam starts
          console.log('Camera granted, but no valid attempt ID yet. Will update when exam starts.')
          console.log('Current attempt:', attempt)
        }

        // Set up periodic camera status updates to keep database in sync
        const statusUpdateInterval = setInterval(async () => {
          if (attempt?.id && stream && stream.active) {
            const videoTracks = stream.getVideoTracks()
            const isReallyOn = videoTracks.length > 0 && videoTracks[0].enabled && videoTracks[0].readyState === 'live'
            
            console.log('📹 Periodic camera status check:', { isReallyOn, tracks: videoTracks.length })
            
            const { error } = await supabase
              .from('student_exam_attempts')
              .update({ 
                camera_enabled: isReallyOn,
                last_activity_at: new Date().toISOString()
              })
              .eq('id', attempt.id)
              
            if (error) {
              console.error('Failed to update camera status:', error)
            }
          }
        }, 3000) // Update every 3 seconds

        // Store interval ref for cleanup
        return () => clearInterval(statusUpdateInterval)

        // WebRTC will be handled by the StudentWebRTC component below
        console.log('📹 Camera enabled - WebRTC component will handle streaming')
      } catch (error) {
        console.error('Error updating camera status:', error)
        toast.error('Camera enabled, but status update failed')
      }
    }
    
    // Force exam initialization after camera setup
    console.log('Camera setup complete, initializing exam...')
    setTimeout(() => {
      if (session) {
        initializeExam()
      }
    }, 100)
  }

  // Camera declined handler removed (unused)

  // Validate session context
  useEffect(() => {
    console.log('=== SESSION VALIDATION ===')
    console.log('Session exists:', !!session)
    console.log('Session ID:', sessionId)
    console.log('Exam ID:', examId)
    console.log('Full session:', session)
    console.log('PropExamId:', propExamId)
    console.log('Session exam id:', session?.exam?.id)
    console.log('Session session id:', session?.session?.id)
    
    if (!session || !sessionId || !examId) {
      console.log('Missing session data details:')
      console.log('- Session missing:', !session)
      console.log('- SessionId missing:', !sessionId)
      console.log('- ExamId missing:', !examId)
      console.log('Waiting for complete session data...')
      return
    }
    
    console.log('Session validation passed, initializing exam...')

    // Initialize exam only once
    if (!examInitialized) {
      console.log('About to call initializeExam')
      initializeExam()
    }
    
    // Handle camera after exam is initialized
    const cameraRequired = session.session.camera_monitoring_enabled === true
    console.log('Camera required:', cameraRequired, 'Camera stream:', !!cameraStream, 'Prompt shown:', cameraPromptShown.current)
    
    if (cameraRequired && !cameraStream && !cameraPromptShown.current && !examCompleted && examInitialized && !cameraAccessDisabled) {
      console.log('Camera required but handled by instructions page')
      setCameraAccessRequired(true)
      cameraPromptShown.current = true
    }
  }, [session, sessionId, examId, cameraStream, examCompleted, examInitialized, cameraAccessDisabled, propExamId])

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

  // Cleanup camera when user leaves page or closes tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('Page unloading - stopping camera')
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (webrtcConnectionRef.current) {
        try {
          webrtcConnectionRef.current.destroy()
        } catch (error) {
          console.log('Page unload WebRTC cleanup error:', error)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, []) // No dependencies needed since we use refs

  // Update refs when state changes
  useEffect(() => {
    cameraStreamRef.current = cameraStream
  }, [cameraStream])

  useEffect(() => {
    webrtcConnectionRef.current = webrtcConnection
  }, [webrtcConnection])

  useEffect(() => {
    frameStreamingRef.current = frameStreaming
  }, [frameStreaming])

  // Auto re-initialize camera on reload when exam is in progress
  useEffect(() => {
    const requiresCamera = session?.session?.camera_monitoring_enabled === true

    const shouldAutoStartCamera =
      !!session &&
      !!attempt &&
      attempt.status === 'in_progress' &&
      !cameraStream &&
      !examCompleted &&
      !cameraAccessDisabled &&
      requiresCamera
    
    if (!shouldAutoStartCamera) return
    
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
          audio: false,
        })
        if (cancelled) return
        await handleCameraGranted(stream)
      } catch (e) {
        console.warn('Auto camera init failed:', e)
      }
    })()
    
    return () => {
      cancelled = true
    }
  }, [session, attempt, cameraStream, examCompleted, cameraAccessDisabled, handleCameraGranted])

  // Load upcoming exams when session is available
  useEffect(() => {
    if (session?.student?.class_level && showInstructions) {
      loadUpcomingExams()
    }
  }, [session?.student?.class_level, showInstructions, loadUpcomingExams])

  // Cleanup camera and WebRTC on component unmount only
  useEffect(() => {
    return () => {
      console.log('Component unmounting - cleaning up camera and WebRTC')
      
      // Stop camera stream
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log('Unmount: Stopped track:', track.kind)
        })
      }
      
      // Cleanup WebRTC connection
      if (webrtcConnectionRef.current) {
        try {
          webrtcConnectionRef.current.destroy()
          console.log('Unmount: Disconnected WebRTC')
        } catch (error) {
          console.log('Unmount: WebRTC cleanup error (non-critical):', error)
        }
      }
      
      // Cleanup frame streaming
      if (frameStreamingRef.current) {
        console.log('Unmount: Stopping frame streaming')
        frameStreamingRef.current.stopStreaming()
      }
    }
  }, []) // No dependencies - only run on mount/unmount

  // Cheating logging is now handled by the useCheatingDetection hook

  async function initializeExam() {
    console.log('=== INITIALIZE EXAM CALLED ===')
    console.log('Session in initializeExam:', session)
    console.log('examId:', examId)
    console.log('sessionId:', sessionId)
    
    if (!session) {
      console.log('No session in initializeExam, returning')
      return
    }

    if (!examId) {
      console.error('No examId available for initialization')
      setError('Exam ID not found')
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
          // Exam is already completed, let StudentPortal handle showing completed state
          return
        }
        setAttempt(attemptData)
        setExamStarted(true)
        setShowInstructions(false)
      }

      // Fetch questions and deterministically shuffle per student once
      console.log('Fetching questions for exam ID:', examId)
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at')

      console.log('Questions query result:', { questionsData, questionsError })

      if (questionsError) {
        console.error('Questions fetch error:', questionsError)
        throw questionsError
      }

      if (!questionsData || questionsData.length === 0) {
        console.error('No questions found for exam ID:', examId)
        throw new Error('No questions found for this exam')
      }

      console.log(`Loaded ${questionsData.length} questions for exam`)

      // Deterministic shuffle: consistent per (student, exam), stable across reloads
      const shuffled = shuffleQuestionsForStudent((questionsData as unknown) as Question[], session.student.id, examId)
      // Use shuffled items directly; they are compatible with Question
      setQuestions(shuffled)
      
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

        // Restore current question index if available
        if (typeof attemptData.current_index === 'number' && !isNaN(attemptData.current_index)) {
          const safeIndex = Math.min(Math.max(0, attemptData.current_index), (questionsData?.length || 1) - 1)
          setCurrentQuestionIndex(safeIndex)
        }
      }

    } catch (err: unknown) {
      console.error('Error initializing exam:', err)
      setError(err instanceof Error ? err.message : 'Failed to load exam')
    } finally {
      setLoading(false)
      setExamInitialized(true)
    }
  }

  const startExam = async () => {
    if (!session) return

    try {
      console.log('=== STARTING EXAM ===')
      console.log('Session ID:', session.session.id)
      console.log('Student ID:', session.student.id)
      console.log('Exam ID:', session.exam.id)

      // 1) Persist end_time in exam_sessions once (server time anchor)
      const { data: sessionRow, error: sessionFetchErr } = await supabase
        .from('exam_sessions')
        .select('ends_at')
        .eq('id', session.session.id)
        .single()

      if (sessionFetchErr) throw sessionFetchErr

      if (!sessionRow?.ends_at) {
        // If no ends_at (should exist from creation), set it now from server now() + duration
        const { data: endsAtRow, error: endsErr } = await supabase
          .rpc('set_session_end_time_once', {
            p_session_id: session.session.id,
            p_duration_minutes: session.exam.duration_minutes
          })
        if (endsErr) throw endsErr
        console.log('Server set session end_time:', endsAtRow)
      }

      // 2) Create/Upsert attempt (no question_order management)

      // 3) Create attempt
      const { data, error } = await supabase
        .from('student_exam_attempts')
        .upsert([{
          session_id: session.session.id,
          student_id: session.student.id,
          exam_id: session.exam.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          camera_enabled: !!cameraStream // Set camera status based on current stream
        }], {
          onConflict: 'session_id,student_id,exam_id'
        })
        .select()
        .single()

      console.log('Start exam result:', data)
      console.log('Start exam error:', error)
      
      if (error) {
        console.error('Detailed error:', JSON.stringify(error, null, 2))
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        throw error
      }

      setAttempt(data)
      setExamStarted(true)
      setShowInstructions(false)
      console.log('Exam started successfully')
    } catch (err: unknown) {
      console.error('Error starting exam:', err)
      console.error('Error type:', typeof err)
      console.error('Error details:', JSON.stringify(err, null, 2))
      if (err && typeof err === 'object' && 'constructor' in err) {
        // Narrow without using any
        console.error('Error constructor:', (err as { constructor?: { name?: string } }).constructor?.name)
      }
      setError(err instanceof Error ? err.message : 'Failed to start exam')
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

  async function loadUpcomingExams() {
    if (!session?.student?.class_level) return
    
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
        .eq('class_level', session.student.class_level)
        .eq('status', 'active')
        .gte('ends_at', now)
        .order('starts_at', { ascending: true })
        .limit(5)

      if (error) throw error

      const formattedExams = (data || []).map(exam => ({
        title: exam.exam.title,
        date: new Date(exam.starts_at).toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        duration: exam.exam.duration_minutes
      }))
      
      setUpcomingExams(formattedExams)
    } catch (error) {
      console.error('Error loading upcoming exams:', error)
    }
  }

  const submitExam = async () => {
    if (!attempt || !session) return

    try {
      console.log('Exam submission started - cleaning up camera...')
      
      // Use the comprehensive cleanup function
      await forceKillAllMedia()

      // Update attempt status
      if (!attempt?.id) {
        throw new Error('Cannot submit exam - no valid attempt ID')
      }
      
      console.log('Updating attempt status to submitted for attempt:', attempt.id)
      const { error: updateError } = await supabase
        .from('student_exam_attempts')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', attempt.id)

      if (updateError) {
        console.error('Failed to update attempt status:', updateError)
        throw updateError
      }

      // First validate and mark all answers as correct/incorrect
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }))
      
      console.log('Validating answers for attempt:', attempt.id, answersArray)
      
      const validationResult = await validateAndMarkAnswers(attempt.id, answersArray)
      
      console.log('Answer validation result:', validationResult)

      // Then calculate and save the exam score
      console.log('Calculating exam score for attempt:', attempt.id)
      const scoringResult = await calculateAndSaveScore(attempt.id)
      
      if (scoringResult.success) {
        console.log('Exam score calculated successfully:', scoringResult)
      } else {
        console.error('Failed to calculate exam score:', scoringResult.error)
      }

      // Set exam completed state and clean up camera access
      setExamCompleted(true)
      setExamInitialized(false) // Reset initialization flag
      setCameraAccessDisabled(true) // Permanently disable camera access
      
      // Navigation handled by caller to better control modal lifecycle
    } catch (err: unknown) {
      console.error('Error submitting exam:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit exam')
      throw err // Re-throw to let modal handle the error state
    }
  }

  const handleSubmitClick = useCallback(() => {
    if (step === 'submitting' || step === 'success') return
    setStep('confirm')
  }, [step, session?.session?.camera_monitoring_enabled])

  // Step-scoped camera handling for confirmation flow
  useEffect(() => {
    let cancelled = false
    let confirmStream: MediaStream | null = null

    const startConfirmCamera = async () => {
      if (confirmStepCameraStartedRef.current) return
      // Only start confirm-step camera if camera monitoring is enabled for this session
      const requiresCamera = session?.session?.camera_monitoring_enabled === true
      if (!requiresCamera) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        confirmStream = stream
        confirmStepStreamRef.current = stream
        confirmStepCameraStartedRef.current = true
      } catch (e) {
        console.warn('Confirm-step camera start failed:', e)
      }
    }

    const stopConfirmCamera = () => {
      // Stop the confirm step camera
      if (confirmStepStreamRef.current) {
        confirmStepStreamRef.current.getTracks().forEach(track => track.stop())
        confirmStepStreamRef.current = null
      }
      // Also stop the local confirmStream reference
      if (confirmStream) {
        confirmStream.getTracks().forEach(track => track.stop())
        confirmStream = null
      }
      confirmStepCameraStartedRef.current = false
    }

    if (step === 'confirm') {
      startConfirmCamera()
    } else {
      stopConfirmCamera()
    }

    return () => {
      cancelled = true
      stopConfirmCamera()
    }
  }, [step])

  const forceKillAllMedia = async () => {
    try {
      console.log('🔴 FORCE KILL: Starting comprehensive media cleanup...')

      // Stop local camera stream
      if (cameraStreamRef.current) {
        console.log('🔴 FORCE KILL: Stopping main camera stream')
        cameraStreamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log('🛑 FORCE KILL: Stopped main track:', track.kind, track.readyState)
        })
        setCameraStream(null)
      }

      // Stop confirm step camera
      if (confirmStepStreamRef.current) {
        console.log('🔴 FORCE KILL: Stopping confirm step camera')
        confirmStepStreamRef.current.getTracks().forEach(track => {
          track.stop()
          console.log('🛑 FORCE KILL: Stopped confirm track:', track.kind, track.readyState)
        })
        confirmStepStreamRef.current = null
        confirmStepCameraStartedRef.current = false
      }

      // Stop frame streaming
      if (frameStreamingRef.current) {
        console.log('🔴 FORCE KILL: Stopping frame streaming')
        frameStreamingRef.current.stopStreaming()
        setFrameStreaming(null)
      }

      // Stop WebRTC cleanup
      if (webrtcCleanupRef.current) {
        console.log('🔴 FORCE KILL: WebRTC cleanup')
        webrtcCleanupRef.current()
        webrtcCleanupRef.current = null
        setWebrtcInitialized(false)
      }

      // Destroy any video elements' streams
      const videos = document.querySelectorAll('video')
      videos.forEach((v, index) => {
        const video = v as HTMLVideoElement
        console.log(`🔴 FORCE KILL: Processing video element ${index}`)
        try { 
          video.pause() 
          video.currentTime = 0
        } catch {}
        if (video.srcObject) {
          console.log('🔴 FORCE KILL: Stopping video element stream')
          const stream = video.srcObject as MediaStream
          stream.getTracks().forEach(track => {
            track.stop()
            console.log('🛑 FORCE KILL: Stopped video track:', track.kind, track.readyState)
          })
          video.srcObject = null
        }
        video.removeAttribute('src')
        try { video.load() } catch {}
      })

      // Force stop any remaining getUserMedia streams by trying to get a dummy stream and immediately stopping it
      try {
        console.log('🔴 FORCE KILL: Attempting to clear any remaining media devices...')
        const dummyStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: false })
        dummyStream.getTracks().forEach(track => track.stop())
        console.log('🔴 FORCE KILL: Cleared dummy stream')
      } catch (e) {
        console.log('🔴 FORCE KILL: Dummy stream clear failed (expected):', e)
      }

      // Persist camera status
      if (attempt?.id) {
        await supabase
          .from('student_exam_attempts')
          .update({ camera_enabled: false, last_activity_at: new Date().toISOString() })
          .eq('id', attempt.id)
      }

      console.log('🔴 FORCE KILL: Media cleanup complete')
    } catch (e) {
      console.warn('Force media kill error:', e)
    }
  }

  const handleSubmitConfirm = useCallback(async () => {
    if (step === 'submitting' || step === 'success') return
    console.log('🔴 SUBMIT: Starting submit flow, killing media first...')
    setStep('submitting')
    await forceKillAllMedia()
    console.log('🔴 SUBMIT: Media killed, now submitting exam...')
    await submitExam()
    setStep('success')
    setTimeout(() => {
      console.log('🔴 SUBMIT: Success timeout, killing media again...')
      forceKillAllMedia()
      setStep('none')
      const showResults = session?.session?.show_results_after_submit || false
      if (showResults) {
        router.push(`/results/${attempt!.id}`)
      } else {
        router.push('/dashboard?examSubmitted=true')
      }
    }, 1500)
  }, [step, submitExam, router, session, attempt, forceKillAllMedia])

  const handleSubmitCancel = useCallback(() => {
    if (step === 'submitting') return
    setStep('none')
  }, [step])

  const handleTimeUp = useCallback(async () => {
    if (step === 'submitting' || step === 'success') return
    console.log('🔴 TIME UP: Starting time-up flow, killing media first...')
    setStep('submitting')
    await forceKillAllMedia()
    console.log('🔴 TIME UP: Media killed, now submitting exam...')
    await submitExam()
    setStep('success')
    setTimeout(() => {
      console.log('🔴 TIME UP: Success timeout, killing media again...')
      forceKillAllMedia()
      setStep('none')
      const showResults = session?.session?.show_results_after_submit || false
      if (showResults) {
        router.push(`/results/${attempt!.id}`)
      } else {
        router.push('/dashboard?examSubmitted=true')
      }
    }, 1500)
  }, [attempt, session, step, router, forceKillAllMedia, submitExam])

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

  // Force cleanup when exam completes (backup safety net)
  useEffect(() => {
    if (examCompleted) {
      console.log('🚫 Exam completed - forcing camera/audio cleanup')
      
      // Use the comprehensive cleanup function
      forceKillAllMedia()
    }
  }, [examCompleted, forceKillAllMedia])

  // Show exam completion success state
  if (examCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full"
        >
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-lg">
            <div className="h-3 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />
            
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto w-24 h-24 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-6"
              >
                <CheckCircle className="w-12 h-12 text-green-600" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                  Exam Submitted Successfully!
                </h2>
                <p className="text-gray-600 mb-6">
                  Your exam has been submitted and your camera has been turned off automatically.
                </p>
                
                {/* Manual Camera Off Button */}
                <div className="mb-6">
                  <Button
                    onClick={async () => {
                      try {
                        // Use the comprehensive cleanup function
                        await forceKillAllMedia()
                        toast.success('Camera turned off manually!')
                      } catch (error) {
                        console.error('Error turning off camera:', error)
                        toast.error('Failed to turn off camera')
                      }
                    }}
                    variant="outline"
                    className="border-orange-200 text-orange-700 hover:bg-orange-50"
                  >
                    <CameraOff className="w-4 h-4 mr-2" />
                    Turn Off Camera Manually
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    If your camera light is still on, click this button to turn it off manually.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"
              >
                <h3 className="font-semibold text-green-900 mb-2 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  What happened?
                </h3>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Your answers have been saved successfully</li>
                  <li>• Camera monitoring has ended automatically</li>
                  <li>• Results will be available when your teacher releases them</li>
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-sm text-gray-500"
              >
                Redirecting to dashboard in a moment...
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </div>
    )
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

  if (showInstructions && session) {
    return (
      <ExamInstructions 
        studentName={session.student.full_name}
        examTitle={session.exam.title} 
        durationMinutes={session.exam.duration_minutes}
        instructions={(session.exam as Exam).description || 'Please read all questions carefully and answer to the best of your ability.'}
        cameraRequired={session.session.camera_monitoring_enabled}
        onCameraGranted={handleCameraGranted}
        onContinueToExam={() => {
          setShowInstructions(false)
          setExamStarted(true)
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
                console.log('Force initialization clicked')
                console.log('Current examId:', examId)
                console.log('Current sessionId:', sessionId)
                console.log('Current session:', session)
                if (session) {
                  initializeExam()
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded mb-2 mr-2"
            >
              Force Initialize
            </button>
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
        <Card className="mx-auto max-w-7xl p-4 bg-white/80 backdrop-blur">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              
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

            {/* Timer and Camera Status */}
            <div className="flex items-center space-x-4">
              {/* Camera Indicator (WebRTC disabled) */}
              {cameraStream && (
                <div className="text-center p-4 border rounded-lg bg-green-50">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <Camera className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-green-700">Camera On</span>
                  </div>
                </div>
              )}
              
              {/* WebRTC live streaming disabled */}
              
              <ServerAnchoredTimerUI attemptId={attempt.id} onTimeUp={handleTimeUp} />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {Object.keys(answers).length} of {questions.length} answered
              </span>
              <span>
                {Math.round(progressPercentage)}% complete
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-2"
            />
          </div>
        </Card>
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
                <Card className="h-full bg-white/80 backdrop-blur">
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
                        <Button
                          onClick={() => {
                                                      const newIndex = Math.max(0, currentQuestionIndex - 1)
                              setCurrentQuestionIndex(newIndex)
                              setVisitedQuestions(prev => new Set(prev).add(newIndex))
                              if (attempt?.id) {
                                supabase.from('student_exam_attempts').update({ current_index: newIndex }).eq('id', attempt.id)
                              }
                          }}
                          disabled={currentQuestionIndex === 0}
                          variant="outline"
                          size="lg"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Previous
                        </Button>

                        <div className="text-center space-y-2">
                          <div className="w-12 h-12 border-2 border-blue-500 rounded-full flex items-center justify-center bg-blue-50">
                            <span className="text-xs font-medium">
                              {currentQuestionIndex + 1}/{questions.length}
                            </span>
                          </div>
                        </div>

                        {currentQuestionIndex === questions.length - 1 ? (
                          <Button
                            onClick={handleSubmitClick}
                            size="lg"
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Submit Exam
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              const newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1)
                              setCurrentQuestionIndex(newIndex)
                              setVisitedQuestions(prev => new Set(prev).add(newIndex))
                              if (attempt?.id) {
                                supabase.from('student_exam_attempts').update({ current_index: newIndex }).eq('id', attempt.id)
                              }
                            }}
                            size="lg"
                          >
                            Next
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </motion.div>
                    </div>
                </Card>
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
              <Card className="bg-white/80 backdrop-blur">
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="font-bold mb-2 flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
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
                            if (attempt?.id) {
                              supabase.from('student_exam_attempts').update({ current_index: index }).eq('id', attempt.id)
                            }
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
                        <div className="w-20 h-20 border-4 border-blue-500 rounded-full flex items-center justify-center bg-blue-50 mx-auto">
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600">
                              {Math.round(progressPercentage)}%
                            </div>
                            <div className="text-xs text-gray-500">Complete</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
                          <Zap className="w-5 h-5 text-green-600 mx-auto mb-1" />
                          <div className="text-xl font-bold text-green-600">
                            {Object.keys(answers).length}
                          </div>
                          <div className="text-xs text-green-600">Answered</div>
                        </div>
                        
                        <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-red-100 rounded-xl border border-orange-200">
                          <Timer className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                          <div className="text-xl font-bold text-orange-600">
                            {questions.length - Object.keys(answers).length}
                          </div>
                          <div className="text-xs text-orange-600">Remaining</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

              {/* Quick Actions */}
              <Card className="bg-white/80 backdrop-blur">
                <div className="p-6">
                  <h3 className="font-bold mb-4 flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-purple-500" />
                    <span>Quick Actions</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                    const unanswered = questions.findIndex((q, i) => !answers[q.id] && i > currentQuestionIndex)
                    if (unanswered !== -1) {
                    setCurrentQuestionIndex(unanswered)
                    setVisitedQuestions(prev => new Set(prev).add(unanswered))
                    if (attempt?.id) {
                      supabase.from('student_exam_attempts').update({ current_index: unanswered }).eq('id', attempt.id)
                    }
                    }
                    }}
                    className="text-xs flex items-center gap-1"
                    >
                    <Target className="w-3 h-3" />
                      Next Unanswered
                    </Button>
                    
                    <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                    setCurrentQuestionIndex(questions.length - 1)
                      setVisitedQuestions(prev => new Set(prev).add(questions.length - 1))
                      if (attempt?.id) {
                        supabase.from('student_exam_attempts').update({ current_index: questions.length - 1 }).eq('id', attempt.id)
                      }
                    }}
                      className="text-xs flex items-center gap-1"
                    >
                      <Flag className="w-3 h-3" />
                       Go to Last
                     </Button>
                  </div>
                </div>
              </Card>


            </motion.div>
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