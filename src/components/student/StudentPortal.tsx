'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SimpleSessionProvider, useSession } from '@/context/SimpleSessionContext'
import { supabase } from '@/lib/supabase'
import SimpleStudentLogin from '@/components/auth/SimpleStudentLogin'
import StudentDashboard from '@/components/student/StudentDashboard'
import DemoExam from '@/components/exam/DemoExam'
import ExamInstructions from '@/components/exam/ExamInstructions'
import SessionExamInterface from '@/components/exam/SessionExamInterface'

interface SessionData {
  student_name: string
  student_class_level?: string
  session_id: string
  session_code?: string
  exam_id: string
  exam_title: string
  duration_minutes: number
  instructions?: string
  participant_id: string
  student_id: string
  teacher_id?: string
  camera_monitoring_enabled?: boolean
  can_resume?: boolean
  attempt_id?: string
  time_remaining?: number
}

type PortalStage = 'login' | 'dashboard' | 'demo' | 'instructions' | 'exam' | 'completed'

function StudentPortalContent() {
  const router = useRouter()
  const [stage, setStage] = useState<PortalStage>('login')
  const [redirecting, setRedirecting] = useState(false)
  const [studentInfo, setStudentInfo] = useState<any>(null)
  const { session, loading, setSessionData, clearSession } = useSession()

  // Determine stage based on restored session data
  useEffect(() => {
    if (!loading) {
      if (session) {
        // Check if there's an active exam attempt
        checkExamStatus()
      } else {
        setStage('login')
      }
    }
  }, [session, loading])

  const checkExamStatus = async () => {
    if (!session?.participant_id) {
      // Set student info from session if available
      if (session?.student) {
        setStudentInfo({
          full_name: session.student.full_name,
          student_id: session.student.student_id,
          class_level: session.student.class_level,
          school_name: undefined
        })
      }
      setStage('dashboard')
      return
    }

    try {
      // Check if there's an active exam attempt
      const { data: attempts, error } = await supabase
        .from('student_exam_attempts')
        .select('*')
        .eq('student_id', session.student.id)
        .eq('session_id', session.session.id)
        .in('status', ['in_progress', 'completed', 'submitted'])
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error checking exam status:', error)
        setStage('instructions')
        return
      }

      if (attempts && attempts.length > 0) {
        const latestAttempt = attempts[0]
        
        if (latestAttempt.status === 'completed' || latestAttempt.status === 'submitted') {
          // Exam is completed, show completed stage with option to go to dashboard
          setStage('completed')
          return
        } else if (latestAttempt.status === 'in_progress') {
          // Exam is in progress, continue to exam
          setStage('exam')
          return
        }
      }
      
      // No active attempt, show dashboard  
      setStage('dashboard')
    } catch (error) {
      console.error('Error checking exam status:', error)
      setStage('dashboard')
    }
  }

  const handleLoginSuccess = (data: SessionData) => {
    setSessionData(data)
    setStudentInfo({
      full_name: data.student_name,
      student_id: data.student_id,
      class_level: data.student_class_level || 'JSS1',
      school_name: undefined
    })
    
    // If student can resume an existing attempt, go straight to exam
    if (data.can_resume && data.attempt_id) {
      setStage('exam')
    } else {
      // Show dashboard first to let students see upcoming exams or take demo
      setStage('dashboard')
    }
  }

  const handleContinueToExam = () => {
    setStage('exam')
  }

  const handleExamComplete = () => {
    clearSession()
    setStage('login')
  }

  const handleJoinSession = async (sessionCode: string) => {
    // If user wants to join a different session, go to instructions
    // This assumes they're entering a different session code than current
    setStage('instructions')
  }

  const handleStartDemo = () => {
    setStage('demo')
  }

  const handleDemoExit = () => {
    setStage('dashboard')
  }

  const handleLogout = () => {
    clearSession()
    setStudentInfo(null)
    setStage('login')
  }

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-lg font-medium text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  switch (stage) {
    case 'login':
      return <SimpleStudentLogin onLoginSuccess={handleLoginSuccess} />
    
    case 'dashboard':
      return studentInfo ? (
        <StudentDashboard
          studentInfo={studentInfo}
          onJoinSession={handleJoinSession}
          onStartDemo={handleStartDemo}
          onLogout={handleLogout}
        />
      ) : null
    
    case 'demo':
      return <DemoExam onExit={handleDemoExit} />
    
    case 'instructions':
      return (
        <ExamInstructionsWrapper 
          onContinueToExam={handleContinueToExam}
        />
      )
    
    case 'exam':
      return <SessionExamInterface />
    
    case 'completed':
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Exam Completed!</h1>
            <p className="text-gray-600 mb-6">You have successfully completed your exam.</p>
            
            <div className="space-y-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  clearSession()
                  setStage('login')
                }}
                className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Start New Session
              </button>
            </div>
          </div>
        </div>
      )
    
    default:
      return null
  }
}

function ExamInstructionsWrapper({ onContinueToExam }: { onContinueToExam: () => void }) {
  const { session } = useSession()
  
  if (!session) return null
  
  return (
    <ExamInstructions
      studentName={session.student.full_name}
      examTitle={session.exam.title}
      durationMinutes={session.exam.duration_minutes}
      instructions=""
      onContinueToExam={onContinueToExam}
    />
  )
}

export default function StudentPortal() {
  return (
    <SimpleSessionProvider>
      <StudentPortalContent />
    </SimpleSessionProvider>
  )
}