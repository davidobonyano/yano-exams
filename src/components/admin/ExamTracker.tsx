'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ExamSession } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Play, 
  Pause, 
  Users,
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  X,
  Activity,
  BarChart3,
  Zap,
  Timer,
  Trophy,
  Shield,
  User,
  Hash,
  School,
  MessageCircle,
  RefreshCw
} from 'lucide-react'
import SendWarningModal from './SendWarningModal'
import toast from 'react-hot-toast'

interface StudentAttempt {
  id: string
  student_id: string
  students?: {
    id: string
    student_id: string
    full_name: string
    class_level: string
    school_name: string
  }
  status: 'not_started' | 'in_progress' | 'completed' | 'submitted'
  started_at: string | null
  completed_at: string | null
  current_question_index: number
  last_activity_at: string
  time_remaining: number | null
  warning_count: number
  is_flagged: boolean
  browser_info: Record<string, unknown> | null
  ip_address: string | null
}

interface LiveStats {
  session_id: string
  total_participants: number
  active_participants: number
  completed_participants: number
  flagged_participants: number
  cheating_incidents: number
  average_completion_time: string | null
  last_updated: string
}

interface CheatingIncident {
  id: string
  student_id: string
  student_name: string
  violation_type: string
  violation_details: Record<string, unknown> | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  detected_at: string
  teacher_action: string | null
}

interface ExamTrackerProps {
  session: ExamSession
  onClose: () => void
}

export default function ExamTracker({ session, onClose }: ExamTrackerProps) {
  const [attempts, setAttempts] = useState<StudentAttempt[]>([])
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [cheatingIncidents, setCheatingIncidents] = useState<CheatingIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false) // Disabled by default
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [selectedAttemptForWarning, setSelectedAttemptForWarning] = useState<StudentAttempt | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchData()
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchData, 5000) // Refresh every 5 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [session.id, autoRefresh])

  const fetchData = async () => {
    try {
      // Fetch student attempts with student details
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('student_exam_attempts')
        .select(`
          *,
          students (
            id,
            student_id,
            full_name,
            class_level,
            school_name
          )
        `)
        .eq('session_id', session.id)
        .order('started_at', { ascending: false })

      if (attemptsError) throw attemptsError

      // Fetch live stats
      const { data: statsData, error: statsError } = await supabase
        .from('session_live_stats')
        .select('*')
        .eq('session_id', session.id)
        .single()

      if (statsError && statsError.code !== 'PGRST116') { // Ignore not found error
        console.error('Stats error:', statsError)
      }

      // Fetch recent cheating incidents
      const { data: cheatingData, error: cheatingError } = await supabase
        .from('cheating_logs')
        .select(`
          id,
          student_id,
          violation_type,
          violation_details,
          severity,
          detected_at,
          teacher_action,
          students (
            full_name
          )
        `)
        .eq('session_id', session.id)
        .order('detected_at', { ascending: false })
        .limit(20)

      if (cheatingError) {
        console.error('Cheating data error:', cheatingError)
      }

      setAttempts(attemptsData || [])
      setLiveStats(statsData)
      setCheatingIncidents(
        (cheatingData || []).map(incident => ({
          ...incident,
          student_name: (incident.students as unknown as { full_name: string } | null)?.full_name || 'Unknown Student'
        }))
      )
    } catch (error) {
      console.error('Error fetching tracking data:', error)
      if (loading) {
        toast.error('Failed to load exam tracking data')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStudentAction = async (attemptId: string, action: 'warn' | 'flag' | 'unflag') => {
    if (action === 'warn') {
      // Find the attempt to warn
      const attempt = attempts.find(a => a.id === attemptId)
      if (attempt) {
        setSelectedAttemptForWarning(attempt)
        setShowWarningModal(true)
      }
      return
    }

    try {
      const { error } = await supabase
        .from('student_exam_attempts')
        .update({
          is_flagged: action === 'flag' ? true : action === 'unflag' ? false : undefined
        })
        .eq('id', attemptId)

      if (error) throw error

      toast.success(`Student ${action}ged successfully`)
      fetchData()
    } catch (error) {
      console.error(`Error ${action}ging student:`, error)
      toast.error(`Failed to ${action} student`)
    }
  }

  const handleWarningModalClose = () => {
    setShowWarningModal(false)
    setSelectedAttemptForWarning(null)
  }

  const handleWarningSent = () => {
    fetchData() // Refresh data to show updated warning count
  }

  const formatTime = (seconds: number | null) => {
    if (!seconds) return '--'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started': return 'bg-gray-100 text-gray-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'submitted': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-yellow-100 text-yellow-800'
      case 'medium': return 'bg-orange-100 text-orange-800'
      case 'high': return 'bg-red-100 text-red-800'
      case 'critical': return 'bg-red-500 text-white'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActivityStatus = (lastActivity: string) => {
    const now = new Date()
    const activity = new Date(lastActivity)
    const diffMinutes = (now.getTime() - activity.getTime()) / (1000 * 60)
    
    if (diffMinutes < 1) return { status: 'active', color: 'text-green-500', text: 'Active now' }
    if (diffMinutes < 5) return { status: 'recent', color: 'text-blue-500', text: `${Math.floor(diffMinutes)}m ago` }
    if (diffMinutes < 15) return { status: 'idle', color: 'text-yellow-500', text: `${Math.floor(diffMinutes)}m ago` }
    return { status: 'inactive', color: 'text-red-500', text: `${Math.floor(diffMinutes)}m ago` }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading exam tracker...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-7xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 p-6 text-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Activity className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">{session.session_name}</h2>
                  <p className="opacity-90">Real-time Exam Monitoring</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`p-2 rounded-full transition-colors ${autoRefresh ? 'bg-white/20' : 'bg-white/10'}`}
                  title={autoRefresh ? 'Disable auto refresh' : 'Enable auto refresh'}
                >
                  <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={fetchData}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  title="Refresh now"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Live Stats */}
          <div className="p-6 border-b bg-gray-50 flex-shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="p-4">
                <div className="text-center">
                  <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <div className="font-bold text-xl">{liveStats?.total_participants || attempts.length}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <Play className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <div className="font-bold text-xl">{liveStats?.active_participants || attempts.filter(a => a.status === 'in_progress').length}</div>
                  <div className="text-sm text-gray-600">Active</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <CheckCircle className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <div className="font-bold text-xl">{liveStats?.completed_participants || attempts.filter(a => a.status === 'completed' || a.status === 'submitted').length}</div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <Shield className="w-6 h-6 mx-auto mb-2 text-red-500" />
                  <div className="font-bold text-xl">{liveStats?.flagged_participants || attempts.filter(a => a.is_flagged).length}</div>
                  <div className="text-sm text-gray-600">Flagged</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                  <div className="font-bold text-xl">{liveStats?.cheating_incidents || cheatingIncidents.length}</div>
                  <div className="text-sm text-gray-600">Incidents</div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="text-center">
                  <Timer className="w-6 h-6 mx-auto mb-2 text-cyan-500" />
                  <div className="font-bold text-xl">
                    {liveStats?.average_completion_time ? 
                      Math.floor(parseInt(liveStats.average_completion_time.split(':')[0]) * 60 + parseInt(liveStats.average_completion_time.split(':')[1])) + 'm' : 
                      '--'
                    }
                  </div>
                  <div className="text-sm text-gray-600">Avg Time</div>
                </div>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Student List */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      Student Progress ({attempts.length} students)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-96 overflow-y-auto">
                      {attempts.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No students have joined this session yet</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {attempts.map((attempt) => {
                            const activity = getActivityStatus(attempt.last_activity_at)
                            return (
                              <div key={attempt.id} className="p-4 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-3 h-3 rounded-full ${activity.status === 'active' ? 'bg-green-500 animate-pulse' : activity.status === 'recent' ? 'bg-blue-500' : activity.status === 'idle' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                    
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <span className="font-medium">{attempt.students?.full_name || 'Unknown Student'}</span>
                                        {attempt.is_flagged && (
                                          <Shield className="w-4 h-4 text-red-500" />
                                        )}
                                        {attempt.warning_count > 0 && (
                                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                            {attempt.warning_count} warnings
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-600 flex items-center space-x-4">
                                        <span className="flex items-center">
                                          <Hash className="w-3 h-3 mr-1" />
                                          {attempt.students?.student_id || 'N/A'}
                                        </span>
                                        <span className="flex items-center">
                                          <School className="w-3 h-3 mr-1" />
                                          {attempt.students?.class_level || 'N/A'}
                                        </span>
                                        <span className={activity.color}>
                                          {activity.text}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-3">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(attempt.status)}`}>
                                      {attempt.status.replace('_', ' ')}
                                    </span>
                                    
                                    {attempt.status === 'in_progress' && attempt.time_remaining && (
                                      <span className="text-sm font-mono text-blue-600">
                                        {formatTime(attempt.time_remaining)}
                                      </span>
                                    )}
                                    
                                    <div className="flex items-center space-x-1">
                                      {!attempt.is_flagged ? (
                                        <button
                                          onClick={() => handleStudentAction(attempt.id, 'flag')}
                                          className="p-1 text-red-600 hover:bg-red-100 rounded"
                                          title="Flag student"
                                        >
                                          <Shield className="w-4 h-4" />
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleStudentAction(attempt.id, 'unflag')}
                                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                                          title="Unflag student"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </button>
                                      )}
                                      
                                      <button
                                        onClick={() => handleStudentAction(attempt.id, 'warn')}
                                        className="p-1 text-orange-600 hover:bg-orange-100 rounded"
                                        title="Send warning"
                                      >
                                        <AlertTriangle className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                {attempt.current_question_index > 0 && (
                                  <div className="mt-2">
                                    <div className="bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ 
                                          width: `${(attempt.current_question_index / 20) * 100}%` 
                                        }}
                                      ></div>
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      Question {attempt.current_question_index} of 20
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cheating Incidents */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                      Recent Incidents ({cheatingIncidents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-96 overflow-y-auto">
                      {cheatingIncidents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Shield className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
                          <p>No incidents detected</p>
                          <p className="text-xs">All students are following exam rules</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {cheatingIncidents.slice(0, 15).map((incident) => (
                            <motion.div
                              key={incident.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="p-4 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${getSeverityColor(incident.severity)}`}>
                                      {incident.severity.toUpperCase()}
                                    </span>
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                      {new Date(incident.detected_at).toLocaleString()}
                                    </span>
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <User className="w-3 h-3 text-gray-400" />
                                      <span className="font-medium text-sm">{incident.student_name}</span>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      <AlertTriangle className="w-3 h-3 text-orange-500" />
                                      <span className="text-sm text-gray-700 capitalize">
                                        {incident.violation_type.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                    
                                    {incident.violation_details && (
                                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                        <div className="font-medium text-gray-700 mb-1">Details:</div>
                                        {(() => {
                                          try {
                                            const details = typeof incident.violation_details === 'string' 
                                              ? JSON.parse(incident.violation_details) 
                                              : incident.violation_details;
                                            
                                            return (
                                              <div className="space-y-1 text-gray-600">
                                                {details.count && (
                                                  <div>Attempt count: <span className="font-medium">{details.count}</span></div>
                                                )}
                                                {details.key && (
                                                  <div>Key pressed: <span className="font-mono bg-gray-200 px-1 rounded">{details.key}</span></div>
                                                )}
                                                {details.selectionLength && (
                                                  <div>Text selected: <span className="font-medium">{details.selectionLength} characters</span></div>
                                                )}
                                                {details.duration && (
                                                  <div>Duration: <span className="font-medium">{Math.round(details.duration / 1000)}s</span></div>
                                                )}
                                              </div>
                                            );
                                          } catch (e) {
                                            return <div className="text-gray-500">Raw data available</div>;
                                          }
                                        })()}
                                      </div>
                                    )}
                                    
                                    {incident.teacher_action && (
                                      <div className="mt-2 flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <span className="text-xs text-blue-600 font-medium">
                                          Action: {incident.teacher_action}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="ml-3">
                                  {incident.severity === 'critical' && (
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                  )}
                                  {incident.severity === 'high' && (
                                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                  )}
                                  {incident.severity === 'medium' && (
                                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                  )}
                                  {incident.severity === 'low' && (
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Warning Modal */}
      {selectedAttemptForWarning && (
        <SendWarningModal
          isOpen={showWarningModal}
          onClose={handleWarningModalClose}
          onSent={handleWarningSent}
          attempt={selectedAttemptForWarning}
          sessionId={session.id}
          teacherId={session.teacher_id}
        />
      )}
    </div>
  )
}