'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { motion } from 'framer-motion'
import { 
  Copy,
  Check,
  Mail
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Teacher, Exam, ExamSession } from '@/types/database-v2'
import CreateExamModal from './CreateExamModal'
import CreateSessionModal from './CreateSessionModal'
import EndSessionModal from './EndSessionModal'
import DeleteSessionModal from './DeleteSessionModal'
import QuestionManager from './QuestionManager'
import StudentManagement from './StudentManagement'
import ExamTracker from './ExamTracker'
import RealTimeStudentProgress from './RealTimeStudentProgress'
import SessionResults from './SessionResults'
import CameraMonitor from './CameraMonitor'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { TextReveal, GradientText } from '@/components/ui/text-effects'
import { AnimatedCard } from '@/components/ui/animated-cards'
import { AnimatedCounter } from '@/components/ui/progress-rings'
import toast from 'react-hot-toast'

interface AdminDashboardProps {
  user: User
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateExam, setShowCreateExam] = useState(false)
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [showQuestionManager, setShowQuestionManager] = useState(false)
  const [showStudentManagement, setShowStudentManagement] = useState(false)
  const [showExamTracker, setShowExamTracker] = useState(false)
  const [showRealTimeProgress, setShowRealTimeProgress] = useState(false)
  const [showSessionResults, setShowSessionResults] = useState(false)
  const [showCameraMonitor, setShowCameraMonitor] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null)
  const [copiedSessions, setCopiedSessions] = useState<Set<string>>(new Set())
  const [endSessionModal, setEndSessionModal] = useState<{isOpen: boolean, sessionId: string, sessionName: string}>({isOpen: false, sessionId: '', sessionName: ''})
  const [deleteSessionModal, setDeleteSessionModal] = useState<{isOpen: boolean, sessionId: string, sessionName: string}>({isOpen: false, sessionId: '', sessionName: ''})
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    fetchTeacherData()
  }, [user])

  // No automatic refreshes - all updates are manual or action-driven

  const fetchTeacherDataSilently = async () => {
    try {
      // Silent refresh - no loading state changes
      console.log('Silently refreshing teacher data for user:', user.id)

      // Fetch teacher profile
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', user.id)
        .single()

      if (teacherError && teacherError.code !== 'PGRST116') {
        console.error('Error fetching teacher:', teacherError)
        return
      }

      if (teacherData) {
        setTeacher(teacherData)
      }

      // Fetch teacher's exams
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      if (examsError) {
        console.error('Error fetching exams:', examsError)
      } else {
        setExams(examsData || [])
      }

      // Fetch teacher's sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError)
      } else {
        setSessions(sessionsData || [])
      }

    } catch (error) {
      console.error('Error during silent refresh:', error)
    }
  }

  const fetchTeacherData = async () => {
    try {
      setLoading(true)
      console.log('Fetching teacher data for user:', user.id)

      // Fetch teacher profile
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', user.id)
        .single()

      console.log('Teacher query result:', { teacherData, teacherError })

      if (teacherError && teacherError.code === 'PGRST116') {
        // Teacher profile doesn't exist, create it
        console.log('Creating new teacher profile')
        const { data: newTeacher, error: createError } = await supabase
          .from('teachers')
          .insert([{
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Teacher',
            email: user.email!,
            school_name: ''
          }])
          .select()
          .single()

        console.log('Create teacher result:', { newTeacher, createError })
        if (createError) throw createError
        setTeacher(newTeacher)
      } else if (teacherError) {
        throw teacherError
      } else {
        setTeacher(teacherData)
      }

      // Fetch teacher's exams
      console.log('Fetching exams for teacher:', user.id)
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      console.log('Exams query result:', { examsData, examsError })
      if (examsError) throw examsError
      setExams(examsData || [])

      // Fetch teacher's sessions
      console.log('Fetching sessions for teacher:', user.id)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })

      console.log('Sessions query result:', { sessionsData, sessionsError })
      if (sessionsError) throw sessionsError
      setSessions(sessionsData || [])

      console.log('Successfully loaded teacher dashboard data')
    } catch (error) {
      console.error('Error fetching teacher data:', error)
      // Don't let the loading state persist on error
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const handleCreateSession = (exam: Exam) => {
    setSelectedExam(exam)
    setShowCreateSession(true)
  }

  const handleManageQuestions = (exam: Exam) => {
    setSelectedExam(exam)
    setShowQuestionManager(true)
  }

  const handleTrackSession = (session: ExamSession) => {
    setSelectedSession(session)
    setShowRealTimeProgress(true)
  }

  const handleViewResults = (session: ExamSession) => {
    setSelectedSession(session)
    setShowSessionResults(true)
  }

  const handleMonitorCameras = (session: ExamSession) => {
    setSelectedSession(session)
    setShowCameraMonitor(true)
  }

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this exam? This action cannot be undone.')) return

    try {
      const { data, error } = await supabase.rpc('delete_ended_exam', {
        p_exam_id: examId,
        p_teacher_id: user.id
      })

      if (error) throw error

      const result = data
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Exam deleted successfully!')
      fetchTeacherDataSilently()
    } catch (error) {
      console.error('Error deleting exam:', error)
      toast.error('Failed to delete exam')
    }
  }

  const handleCreateDemoExam = async () => {
    try {
      const { data, error } = await supabase.rpc('create_demo_exam', {
        p_teacher_id: user.id,
        p_class_level: 'JSS1' // Default to JSS1
      })

      if (error) throw error

      const result = data
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      fetchTeacherDataSilently()
    } catch (error) {
      console.error('Error creating demo exam:', error)
      toast.error('Failed to create demo exam')
    }
  }

  // Function to determine actual session status based on time and database status
  const getActualSessionStatus = (session: ExamSession) => {
    const now = new Date()
    const startTime = new Date(session.starts_at)
    const endTime = new Date(session.ends_at)

    // If session is manually ended or cancelled, respect that status
    if (session.status === 'ended' || session.status === 'cancelled') {
      return session.status
    }

    // Check time-based status
    if (now < startTime) {
      return 'scheduled'
    } else if (now >= startTime && now <= endTime && session.status === 'active') {
      return 'active'
    } else if (now > endTime) {
      return 'expired'
    } else {
      return session.status
    }
  }

  // Function to delete a session
  const handleDeleteSession = async (sessionId: string, sessionName: string) => {
    setDeleteSessionModal({isOpen: true, sessionId, sessionName})
  }

  const confirmDeleteSession = async () => {
    setModalLoading(true)
    try {
      const { error } = await supabase
        .from('exam_sessions')
        .delete()
        .eq('id', deleteSessionModal.sessionId)
        .eq('teacher_id', user.id) // Ensure teacher can only delete their own sessions

      if (error) throw error

      toast.success('Session deleted successfully!')
      fetchTeacherDataSilently()
      setDeleteSessionModal({isOpen: false, sessionId: '', sessionName: ''})
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('Failed to delete session')
    } finally {
      setModalLoading(false)
    }
  }

  // Function to end a session manually
  const handleEndSession = async (sessionId: string, sessionName: string) => {
    setEndSessionModal({isOpen: true, sessionId, sessionName})
  }

  const confirmEndSession = async () => {
    setModalLoading(true)
    try {
      const { error } = await supabase
        .from('exam_sessions')
        .update({ 
          status: 'ended',
          updated_at: new Date().toISOString()
        })
        .eq('id', endSessionModal.sessionId)
        .eq('teacher_id', user.id)

      if (error) throw error

      toast.success('Session ended successfully!')
      fetchTeacherDataSilently()
      setEndSessionModal({isOpen: false, sessionId: '', sessionName: ''})
    } catch (error) {
      console.error('Error ending session:', error)
      toast.error('Failed to end session')
    } finally {
      setModalLoading(false)
    }
  }

  const copySessionCode = async (sessionCode: string, sessionId: string) => {
    try {
      await navigator.clipboard.writeText(sessionCode)
      setCopiedSessions(prev => new Set(prev).add(sessionId))
      toast.success(`Session code ${sessionCode} copied to clipboard!`)
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedSessions(prev => {
          const newSet = new Set(prev)
          newSet.delete(sessionId)
          return newSet
        })
      }, 2000)
    } catch (error) {
      toast.error('Failed to copy session code')
    }
  }

  const toggleShowResults = async (sessionId: string, currentValue: boolean, sessionName: string) => {
    try {
      const { error } = await supabase
        .from('exam_sessions')
        .update({ 
          show_results_after_submit: !currentValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('teacher_id', user.id)

      if (error) throw error

      const action = !currentValue ? 'enabled' : 'disabled'
      toast.success(`Result visibility ${action} for "${sessionName}"`)
      fetchTeacherDataSilently()
    } catch (error) {
      console.error('Error updating result visibility:', error)
      toast.error('Failed to update result visibility')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        <AnimatedBackground />
        <motion.div 
          className="text-center relative z-10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div 
            className="rounded-full h-32 w-32 border-4 border-indigo-200 border-t-indigo-600 mx-auto backdrop-blur-sm bg-white/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <motion.p 
            className="mt-6 text-lg font-medium text-gray-700 backdrop-blur-sm bg-white/20 px-6 py-2 rounded-full inline-block"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Loading your dashboard...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Welcome, {teacher?.full_name || 'Teacher'}
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">Exam Management Dashboard</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {teacher?.school_name && (
                <div className="hidden md:flex items-center px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></div>
                  <span className="text-sm font-medium text-indigo-700">{teacher.school_name}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {teacher?.full_name?.charAt(0)?.toUpperCase() || 'T'}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-slate-500 hover:text-slate-700 font-medium hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="group relative bg-gradient-to-br from-white to-blue-50/50 border border-slate-200/60 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Exams</p>
                    <p className="text-3xl font-bold text-slate-900">{exams.length}</p>
                  </div>
                </div>
                <div className="text-2xl">📚</div>
              </div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-white to-green-50/50 border border-slate-200/60 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Active Sessions</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {sessions.filter(s => s.status === 'active').length}
                    </p>
                  </div>
                </div>
                <div className="text-2xl">🎯</div>
              </div>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-white to-purple-50/50 border border-slate-200/60 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Sessions</p>
                    <p className="text-3xl font-bold text-slate-900">{sessions.length}</p>
                  </div>
                </div>
                <div className="text-2xl">📊</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setShowCreateExam(true)}
              className="group relative bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Create New Exam</h3>
                  <p className="text-xs text-white/80 mt-1">Build a custom exam</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleCreateDemoExam()}
              className="group relative bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Create Demo Exam</h3>
                  <p className="text-xs text-white/80 mt-1">Quick test setup</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setShowStudentManagement(true)}
              className="group relative bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Manage Students</h3>
                  <p className="text-xs text-white/80 mt-1">Student registration</p>
                </div>
              </div>
            </button>

          </div>
        </div>

        {/* Exams Section */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Your Exams</h2>
          {exams.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No exams</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first exam.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {exams.map((exam) => (
                <div key={exam.id} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{exam.title}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        exam.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {exam.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {exam.description && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{exam.description}</p>
                    )}
                    
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-500">
                      <div>Class: {exam.class_level}</div>
                      <div>Duration: {exam.duration_minutes}m</div>
                      <div>Questions: {exam.total_questions}</div>
                      <div>Pass: {exam.passing_score}%</div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <button
                        onClick={() => handleManageQuestions(exam)}
                        className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Manage Questions
                      </button>
                      <button
                        onClick={() => handleCreateSession(exam)}
                        className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mb-1"
                      >
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Session
                      </button>
                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Exam
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Active Sessions</h2>
          {sessions.filter(s => {
            const actualStatus = getActualSessionStatus(s)
            return actualStatus === 'active' || actualStatus === 'scheduled'
          }).length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">No active sessions.</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {sessions
                  .filter(session => {
                    const actualStatus = getActualSessionStatus(session)
                    return actualStatus === 'active' || actualStatus === 'scheduled'
                  })
                  .slice(0, 5)
                  .map((session) => {
                    const actualStatus = getActualSessionStatus(session)
                    return (
                  <li key={session.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-indigo-600 truncate">
                            {session.session_name}
                          </p>
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {session.class_level}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            actualStatus === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : actualStatus === 'scheduled'
                              ? 'bg-blue-100 text-blue-800'
                              : actualStatus === 'expired'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {actualStatus}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg font-mono font-semibold text-gray-900">
                              {session.session_code}
                            </span>
                            <button
                              onClick={() => copySessionCode(session.session_code, session.id)}
                              className="inline-flex items-center p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Copy session code"
                            >
                              {copiedSessions.has(session.id) ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          {actualStatus === 'active' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleTrackSession(session)}
                                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-colors shadow-sm"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Live Progress
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedSession(session)
                                  setShowExamTracker(true)
                                }}
                                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 rounded-lg transition-colors shadow-sm"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                Security Monitor
                              </button>
                              {session.camera_monitoring_enabled && (
                                <button
                                  onClick={() => handleMonitorCameras(session)}
                                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition-colors shadow-sm"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Camera Feed
                                </button>
                              )}
                              <button
                                onClick={() => handleEndSession(session.id, session.session_name)}
                                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg transition-colors shadow-sm"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                </svg>
                                End Session
                              </button>
                            </div>
                          )}
                          {actualStatus === 'scheduled' && (
                            <div className="flex gap-2">
                              <span className="inline-flex items-center px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg">
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Starts: {new Date(session.starts_at).toLocaleString()}
                              </span>
                              <button
                                onClick={() => handleDeleteSession(session.id, session.session_name)}
                                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          )}
                          {session.status === 'ended' && (
                            <button
                              onClick={() => handleViewResults(session)}
                              className="inline-flex items-center px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-100 hover:bg-emerald-200 rounded transition-colors"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Results
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex sm:justify-between">
                          <p className="flex items-center text-sm text-gray-500">
                            <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(session.starts_at).toLocaleString()} - {new Date(session.ends_at).toLocaleString()}
                          </p>
                          <div className="mt-2 sm:mt-0 flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">Show Results:</span>
                              <button
                                onClick={() => toggleShowResults(session.id, session.show_results_after_submit || false, session.session_name)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                  session.show_results_after_submit ? 'bg-indigo-600' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                    session.show_results_after_submit ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                              <span className={`text-xs ${session.show_results_after_submit ? 'text-indigo-600' : 'text-gray-400'}`}>
                                {session.show_results_after_submit ? 'ON' : 'OFF'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                    )
                  })}
              </ul>
            </div>
          )}
        </div>

        {/* Completed/Ended Sessions */}
        {sessions.filter(s => {
          const actualStatus = getActualSessionStatus(s)
          return actualStatus === 'expired' || s.status === 'ended'
        }).length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Completed Sessions</h2>
              <span className="text-sm text-gray-500">
                {sessions.filter(s => {
                  const actualStatus = getActualSessionStatus(s)
                  return actualStatus === 'expired' || s.status === 'ended'
                }).length} completed
              </span>
            </div>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {sessions
                  .filter(session => {
                    const actualStatus = getActualSessionStatus(session)
                    return actualStatus === 'expired' || session.status === 'ended'
                  })
                  .slice(0, 5)
                  .map((session) => {
                    const actualStatus = getActualSessionStatus(session)
                    return (
                  <li key={session.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-600 truncate">
                            {session.session_name}
                          </p>
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {session.class_level}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            actualStatus === 'expired' 
                              ? 'bg-red-100 text-red-800' 
                              : session.status === 'ended'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {actualStatus === 'expired' ? 'Expired' : session.status === 'ended' ? 'Ended' : actualStatus}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-mono text-gray-500">
                              {session.session_code}
                            </span>
                            <button
                              onClick={() => copySessionCode(session.session_code, session.id)}
                              className="inline-flex items-center p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Copy session code"
                            >
                              {copiedSessions.has(session.id) ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            {(session.status === 'ended' || actualStatus === 'expired') && (
                              <button
                                onClick={() => handleViewResults(session)}
                                className="inline-flex items-center px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Results
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSession(session.id, session.session_name)}
                              className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Completed: {new Date(session.ends_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                    )
                  })}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateExam && (
        <CreateExamModal
          onClose={() => setShowCreateExam(false)}
          onCreated={fetchTeacherDataSilently}
        />
      )}

      {showCreateSession && selectedExam && (
        <CreateSessionModal
          exam={selectedExam}
          onClose={() => {
            setShowCreateSession(false)
            setSelectedExam(null)
          }}
          onCreated={fetchTeacherDataSilently}
        />
      )}

      {showQuestionManager && selectedExam && (
        <QuestionManager
          examId={selectedExam.id}
          examTitle={selectedExam.title}
          totalQuestions={selectedExam.total_questions}
          onClose={() => {
            setShowQuestionManager(false)
            setSelectedExam(null)
          }}
        />
      )}

      {showStudentManagement && (
        <StudentManagement
          teacherId={user.id}
          onClose={() => setShowStudentManagement(false)}
        />
      )}

      {showRealTimeProgress && selectedSession && (
        <RealTimeStudentProgress
          session={selectedSession}
          onClose={() => {
            setShowRealTimeProgress(false)
            setSelectedSession(null)
          }}
        />
      )}

      {showExamTracker && selectedSession && (
        <ExamTracker
          session={selectedSession}
          onClose={() => {
            setShowExamTracker(false)
            setSelectedSession(null)
          }}
        />
      )}

      {showSessionResults && selectedSession && (
        <SessionResults
          session={selectedSession}
          onClose={() => {
            setShowSessionResults(false)
            setSelectedSession(null)
          }}
        />
      )}

      {showCameraMonitor && selectedSession && (
        <CameraMonitor
          session={selectedSession}
          onClose={() => {
            setShowCameraMonitor(false)
            setSelectedSession(null)
          }}
        />
      )}

      <EndSessionModal
        isOpen={endSessionModal.isOpen}
        sessionName={endSessionModal.sessionName}
        onConfirm={confirmEndSession}
        onCancel={() => setEndSessionModal({isOpen: false, sessionId: '', sessionName: ''})}
        loading={modalLoading}
      />

      <DeleteSessionModal
        isOpen={deleteSessionModal.isOpen}
        sessionName={deleteSessionModal.sessionName}
        onConfirm={confirmDeleteSession}
        onCancel={() => setDeleteSessionModal({isOpen: false, sessionId: '', sessionName: ''})}
        loading={modalLoading}
      />
    </div>
  )
}