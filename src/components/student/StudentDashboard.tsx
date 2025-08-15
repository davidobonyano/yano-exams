'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FloatingInput } from '@/components/ui/floating-input'
import { ModernBackground } from '@/components/ui/modern-background'
import { TextReveal, GradientText } from '@/components/ui/text-effects'
import { 
  Clock, 
  Calendar, 
  Users, 
  BookOpen, 
  Play, 
  TrendingUp, 
  Award, 
  AlertCircle,
  ChevronRight,
  Timer,
  Target,
  Zap,
  CheckCircle,
  User,
  School,
  LogOut
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ExamSession {
  id: string
  session_code: string
  session_name: string
  class_level: string
  starts_at: string
  ends_at: string
  status: string
  max_students: number
  instructions?: string
  exam: {
    id: string
    title: string
    duration_minutes: number
    total_questions: number
    passing_score: number
  }
}

interface StudentInfo {
  full_name: string
  student_id: string
  class_level: string
  school_name?: string
}

interface StudentDashboardProps {
  studentInfo: StudentInfo
  onJoinSession: (sessionCode: string) => void
  onStartDemo: () => void
  onLogout: () => void
}

export default function StudentDashboard({ 
  studentInfo, 
  onJoinSession, 
  onStartDemo, 
  onLogout 
}: StudentDashboardProps) {
  const router = useRouter()
  const [upcomingExams, setUpcomingExams] = useState<ExamSession[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionCode, setSessionCode] = useState('')
  const [joiningSession, setJoiningSession] = useState(false)


  useEffect(() => {
    loadUpcomingExams()
  }, [])

  const loadUpcomingExams = async () => {
    try {
      // Get upcoming exam sessions for the student's class level
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
        .eq('class_level', studentInfo.class_level)
        .eq('status', 'active')
        .gte('ends_at', now) // Only future or current sessions
        .order('starts_at', { ascending: true })
        .limit(10)

      if (error) throw error

      setUpcomingExams(data || [])
    } catch (error) {
      console.error('Error loading upcoming exams:', error)
      toast.error('Failed to load upcoming exams')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinSession = async () => {
    if (!sessionCode.trim()) {
      toast.error('Please enter a session code')
      return
    }

    setJoiningSession(true)
    try {
      // Validate session code exists and is active
      const { data: session, error } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('session_code', sessionCode.toUpperCase())
        .eq('status', 'active')
        .single()

      if (error || !session) {
        toast.error('Invalid session code or session not active')
        return
      }

      // Check if session is for the correct class level
      if (session.class_level !== studentInfo.class_level) {
        toast.error(`This session is for ${session.class_level} students`)
        return
      }

      // Check if session has started or allows late join
      const now = new Date()
      const startsAt = new Date(session.starts_at)
      const endsAt = new Date(session.ends_at)

      if (now > endsAt) {
        toast.error('This session has already ended')
        return
      }

      if (now < startsAt && !session.allow_late_join) {
        toast.error('This session has not started yet')
        return
      }

      onJoinSession(sessionCode.toUpperCase())
    } catch (error) {
      console.error('Error joining session:', error)
      toast.error('Failed to join session')
    } finally {
      setJoiningSession(false)
    }
  }

  const handleQuickJoin = (session: ExamSession) => {
    onJoinSession(session.session_code)
  }

  const getSessionStatus = (session: ExamSession) => {
    const now = new Date()
    const startsAt = new Date(session.starts_at)
    const endsAt = new Date(session.ends_at)

    if (now < startsAt) {
      return { status: 'upcoming', color: 'blue', text: 'Upcoming' }
    } else if (now >= startsAt && now <= endsAt) {
      return { status: 'active', color: 'green', text: 'Active Now' }
    } else {
      return { status: 'ended', color: 'gray', text: 'Ended' }
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  return (
    <ModernBackground variant="default">
      <div className="min-h-screen p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-start mb-8"
          >
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl font-bold mb-2"
              >
                Welcome back, <GradientText 
                  text={studentInfo.full_name.split(' ')[0]}
                  gradient="from-blue-600 via-purple-600 to-cyan-600"
                />!
              </motion.h1>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center space-x-4 text-gray-600"
              >
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{studentInfo.student_id}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <School className="w-4 h-4" />
                  <span>{studentInfo.class_level}</span>
                </div>
                {studentInfo.school_name && (
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-4 h-4" />
                    <span>{studentInfo.school_name}</span>
                  </div>
                )}
              </motion.div>
            </div>
            
            <motion.button
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              onClick={onLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </motion.button>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-md">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="w-6 h-6" />
                      <span>Quick Actions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex justify-center">
                      {/* Join Session */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-800">Join Exam Session</h3>
                        <div className="flex space-x-2">
                          <FloatingInput
                            label="Session Code"
                            value={sessionCode}
                            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                            placeholder="Enter 6-digit code"
                            maxLength={6}
                            className="flex-1"
                          />
                          <Button
                            onClick={handleJoinSession}
                            disabled={joiningSession || sessionCode.length !== 6}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {joiningSession ? 'Joining...' : 'Join'}
                          </Button>
                        </div>
                      </div>


                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Upcoming Exams */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
              >
                <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-md">
                  <CardHeader className="bg-gradient-to-r from-green-500 to-cyan-500 text-white">
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="w-6 h-6" />
                      <span>Upcoming Exam Sessions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>Loading upcoming exams...</p>
                      </div>
                    ) : upcomingExams.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No upcoming exam sessions for your class level.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {upcomingExams.map((session, index) => {
                          const status = getSessionStatus(session)
                          const startTime = formatDateTime(session.starts_at)
                          const endTime = formatDateTime(session.ends_at)

                          return (
                            <motion.div
                              key={session.id}
                              initial={{ opacity: 0, x: -30 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 1.2 + index * 0.1 }}
                              className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h3 className="font-semibold text-gray-900">
                                      {session.session_name}
                                    </h3>
                                    <Badge 
                                      variant={status.status === 'active' ? 'default' : 'secondary'}
                                      className={`
                                        ${status.color === 'green' ? 'bg-green-100 text-green-800' : ''}
                                        ${status.color === 'blue' ? 'bg-blue-100 text-blue-800' : ''}
                                        ${status.color === 'gray' ? 'bg-gray-100 text-gray-800' : ''}
                                      `}
                                    >
                                      {status.text}
                                    </Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                                    <div className="flex items-center space-x-1">
                                      <BookOpen className="w-4 h-4" />
                                      <span>{session.exam.title}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Timer className="w-4 h-4" />
                                      <span>{session.exam.duration_minutes} min</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Target className="w-4 h-4" />
                                      <span>{session.exam.total_questions} questions</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Award className="w-4 h-4" />
                                      <span>{session.exam.passing_score}% to pass</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    <div className="flex items-center space-x-1">
                                      <Clock className="w-4 h-4" />
                                      <span>
                                        {startTime.date} {startTime.time} - {endTime.time}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Users className="w-4 h-4" />
                                      <span>Max {session.max_students} students</span>
                                    </div>
                                  </div>

                                  {session.instructions && (
                                    <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                                      <AlertCircle className="w-4 h-4 inline mr-1" />
                                      {session.instructions}
                                    </div>
                                  )}
                                </div>

                                <div className="ml-4">
                                  {status.status === 'active' && (
                                    <Button
                                      onClick={() => handleQuickJoin(session)}
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      Join Now
                                      <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                  )}
                                  {status.status === 'upcoming' && (
                                    <div className="text-center">
                                      <div className="text-lg font-mono font-bold text-blue-600">
                                        {session.session_code}
                                      </div>
                                      <div className="text-xs text-gray-500">Session Code</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Tips Card */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 }}
              >
                <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-md">
                  <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="w-6 h-6" />
                      <span>Exam Tips</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4 text-sm">

                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <div className="font-medium">Stable Internet</div>
                          <div className="text-gray-600">Ensure you have a reliable internet connection.</div>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <div className="font-medium">Quiet Environment</div>
                          <div className="text-gray-600">Find a quiet place where you won&apos;t be interrupted.</div>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                        <div>
                          <div className="font-medium">Read Carefully</div>
                          <div className="text-gray-600">Read each question thoroughly before answering.</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>


    </ModernBackground>
  )
}