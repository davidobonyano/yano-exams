'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Users, 
  Clock, 
  CheckCircle, 
  PlayCircle, 
  AlertTriangle,
  Trophy,
  Eye,
  RefreshCw,
  User,
  Hash,
  School,
  Target
} from 'lucide-react'
import { ExamSession } from '@/types/database-v2'
import toast from 'react-hot-toast'

interface StudentProgress {
  id: string
  student_id: string
  full_name: string
  class_level: string
  status: 'not_started' | 'in_progress' | 'completed' | 'submitted'
  started_at?: string
  completed_at?: string
  time_remaining?: number
  current_question_index?: number
  total_questions: number
  score?: number
  percentage_score?: number
  passed?: boolean
  warning_count?: number
  is_flagged?: boolean
  last_activity_at?: string
}

interface RealTimeStudentProgressProps {
  session: ExamSession
  onClose: () => void
}

export default function RealTimeStudentProgress({ session, onClose }: RealTimeStudentProgressProps) {
  const [students, setStudents] = useState<StudentProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true) // Enabled by default for real-time monitoring

  useEffect(() => {
    fetchStudentProgress()
    
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchStudentProgress(false) // Silent refresh to avoid loading flashes
      }, 5000) // Refresh every 5 seconds for real-time updates
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [session.id, autoRefresh])

  const fetchStudentProgress = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      // Get all participants and their progress
      const { data: progressData, error } = await supabase
        .from('student_exam_attempts')
        .select(`
          *,
          students:student_id (
            student_id,
            full_name,
            class_level
          ),
          exam_results (
            total_questions,
            correct_answers,
            percentage_score,
            passed
          )
        `)
        .eq('session_id', session.id)

      if (error) throw error

      // Also get students who joined but haven't started
      const { data: participantData, error: participantError } = await supabase
        .from('session_participants')
        .select(`
          *,
          students (
            student_id,
            full_name,
            class_level
          )
        `)
        .eq('session_id', session.id)

      if (participantError) throw participantError

      // Combine and format data
      const progressMap = new Map()
      
      // Add participants who haven't started
      participantData?.forEach(participant => {
        if (participant.students) {
          progressMap.set(participant.student_id, {
            id: participant.student_id,
            student_id: participant.students.student_id,
            full_name: participant.students.full_name,
            class_level: participant.students.class_level,
            status: 'not_started' as const,
            total_questions: 0,
            warning_count: 0,
            is_flagged: false
          })
        }
      })

      // Update with actual progress data
      progressData?.forEach(attempt => {
        if (attempt.students) {
          const result = attempt.exam_results?.[0]
          progressMap.set(attempt.student_id, {
            id: attempt.student_id,
            student_id: attempt.students.student_id,
            full_name: attempt.students.full_name,
            class_level: attempt.students.class_level,
            status: attempt.status,
            started_at: attempt.started_at,
            completed_at: attempt.completed_at,
            time_remaining: attempt.time_remaining,
            current_question_index: attempt.current_question_index || 0,
            total_questions: result?.total_questions || 0,
            score: result?.correct_answers || 0,
            percentage_score: result?.percentage_score || 0,
            passed: result?.passed || false,
            warning_count: attempt.warning_count || 0,
            is_flagged: attempt.is_flagged || false,
            last_activity_at: attempt.last_activity_at
          })
        }
      })

      setStudents(Array.from(progressMap.values()))
    } catch (error) {
      console.error('Error fetching student progress:', error)
      if (showLoading) {
        toast.error('Failed to fetch student progress')
      }
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [session.id])

  // Memoize statistics calculations
  const stats = useMemo(() => {
    const notStarted = students.filter(s => s.status === 'not_started').length
    const inProgress = students.filter(s => s.status === 'in_progress').length
    const completed = students.filter(s => s.status === 'completed' || s.status === 'submitted').length
    const flagged = students.filter(s => s.is_flagged).length
    
    return { notStarted, inProgress, completed, flagged, total: students.length }
  }, [students])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Clock className="w-5 h-5 text-gray-500" />
      case 'in_progress':
        return <PlayCircle className="w-5 h-5 text-blue-500" />
      case 'completed':
      case 'submitted':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
      case 'submitted':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'Not Started'
      case 'in_progress':
        return 'In Progress'
      case 'completed':
      case 'submitted':
        return 'Completed'
      default:
        return 'Unknown'
    }
  }

  const formatTime = (seconds?: number) => {
    if (!seconds) return '--:--'
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = (current: number, total: number) => {
    if (!total) return 0
    return Math.round((current / total) * 100)
  }

  // Using memoized stats from above

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Users className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">Student Progress Monitor</h2>
                  <p className="opacity-90">{session.session_name} - Real-time tracking</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => fetchStudentProgress(true)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors bg-white/10 hover:bg-white/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-sm">Refresh Now</span>
                </button>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    autoRefresh ? 'bg-white/20' : 'bg-white/10'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  <span className="text-sm">Auto Refresh (5s)</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-50 p-4 border-b">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="p-3">
                <div className="text-center">
                  <Users className="w-6 h-6 mx-auto mb-1 text-gray-500" />
                  <div className="font-bold text-lg">{stats.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <Clock className="w-6 h-6 mx-auto mb-1 text-gray-500" />
                  <div className="font-bold text-lg">{stats.notStarted}</div>
                  <div className="text-sm text-gray-600">Not Started</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <PlayCircle className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                  <div className="font-bold text-lg">{stats.inProgress}</div>
                  <div className="text-sm text-gray-600">In Progress</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-500" />
                  <div className="font-bold text-lg">{stats.completed}</div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-red-500" />
                  <div className="font-bold text-lg">{stats.flagged}</div>
                  <div className="text-sm text-gray-600">Flagged</div>
                </div>
              </Card>
            </div>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Loading student progress...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No students have joined this session yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence>
                  {students.map((student) => (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                        {/* Student Info */}
                        <div className="md:col-span-2">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {getStatusIcon(student.status)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{student.full_name}</h3>
                              <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <Hash className="w-3 h-3" />
                                <span className="font-mono">{student.student_id}</span>
                                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">
                                  {student.class_level}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}>
                            {getStatusText(student.status)}
                          </span>
                          {student.is_flagged && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Flagged
                            </span>
                          )}
                        </div>

                        {/* Progress */}
                        <div>
                          {student.status === 'in_progress' ? (
                            <div>
                              <div className="text-sm text-gray-600 mb-1">
                                Question {student.current_question_index} of {student.total_questions}
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${getProgressPercentage(student.current_question_index, student.total_questions)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : student.status === 'completed' || student.status === 'submitted' ? (
                            <div>
                              <div className="text-sm text-gray-600">Complete</div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full w-full"></div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">Not started</div>
                          )}
                        </div>

                        {/* Time */}
                        <div className="text-center">
                          {student.status === 'in_progress' && student.time_remaining ? (
                            <div>
                              <div className="text-sm text-gray-600">Time Left</div>
                              <div className="font-mono font-bold text-blue-600">
                                {formatTime(student.time_remaining)}
                              </div>
                            </div>
                          ) : student.completed_at ? (
                            <div>
                              <div className="text-sm text-gray-600">Completed</div>
                              <div className="text-xs text-gray-500">
                                {new Date(student.completed_at).toLocaleTimeString()}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">--:--</div>
                          )}
                        </div>

                        {/* Score */}
                        <div className="text-center">
                          {(student.status === 'completed' || student.status === 'submitted') && student.percentage_score !== undefined ? (
                            <div>
                              <div className="flex items-center justify-center space-x-1">
                                <Trophy className={`w-4 h-4 ${student.passed ? 'text-green-500' : 'text-red-500'}`} />
                                <span className={`font-bold ${student.passed ? 'text-green-600' : 'text-red-600'}`}>
                                  {student.percentage_score.toFixed(1)}%
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {student.score}/{student.total_questions}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">--</div>
                          )}
                        </div>
                      </div>

                      {/* Warning Count and Activity Status */}
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        {student.warning_count && student.warning_count > 0 && (
                          <div className="flex items-center space-x-2 text-sm text-orange-600">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{student.warning_count} warning{student.warning_count > 1 ? 's' : ''}</span>
                            {student.is_flagged && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs ml-2">
                                FLAGGED
                              </span>
                            )}
                          </div>
                        )}
                        {student.last_activity_at && (
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <div className={`w-2 h-2 rounded-full ${
                              new Date().getTime() - new Date(student.last_activity_at).getTime() < 60000 
                                ? 'bg-green-500 animate-pulse' 
                                : new Date().getTime() - new Date(student.last_activity_at).getTime() < 300000
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`} />
                            <span>Last activity: {new Date(student.last_activity_at).toLocaleTimeString()}</span>
                          </div>
                        )}
                        {student.is_flagged && !student.warning_count && (
                          <div className="flex items-center space-x-2 text-sm text-red-600">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                              FLAGGED FOR REVIEW
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}