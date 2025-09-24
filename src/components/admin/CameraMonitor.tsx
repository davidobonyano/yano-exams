'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ExamSession } from '@/types/database-v2'
import { TeacherWebRTC } from '@/lib/webrtc'
import { TeacherWebRTCNew } from '@/lib/webrtc-streaming'
import { CameraFrameReceiver } from '@/lib/camera-streaming'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MagneticButton } from '@/components/ui/magnetic-button'
import TeacherVideoDisplay from './TeacherVideoDisplay'
import TeacherStudentModal from './TeacherStudentModal'
import SendWarningModal from './SendWarningModal'
import Image from 'next/image'
import { 
  X, 
  Camera, 
  Users, 
  Eye,
  AlertTriangle,
  Monitor,
  Volume2,
  VolumeX,
  AlertTriangle as WarningIcon
} from 'lucide-react'

interface CameraMonitorProps {
  session: ExamSession
  onClose: () => void
}

interface StudentCameraFeed {
  id: string
  student_id: string
  student_name_id?: string
  full_name: string
  camera_enabled: boolean
  last_seen: string
  violations: string[]
  stream?: MediaStream
}

export default function CameraMonitor({ session, onClose }: CameraMonitorProps) {
  const [students, setStudents] = useState<StudentCameraFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [viewMode, setViewMode] = useState<'snapshots' | 'webrtc'>('snapshots')
  const [warningStudent, setWarningStudent] = useState<string | null>(null)
  const webrtcRef = useRef<TeacherWebRTC | null>(null)
  const webrtcStreamingRef = useRef<TeacherWebRTCNew | null>(null)
  const frameReceiverRef = useRef<CameraFrameReceiver | null>(null)
  const [studentFrames, setStudentFrames] = useState<Map<string, string>>(new Map())
 
  const setupWebRTCStreaming = useCallback(async () => {
    try {
      console.log('🚀 Initializing new WebRTC streaming system...')
      const webrtcStreaming = new TeacherWebRTCNew(session.id, session.teacher_id)
      webrtcStreaming.onStudentStreamReceived = (studentId: string, stream: MediaStream) => {
        setStudents(prev => prev.map(student => 
          student.student_id === studentId 
            ? { ...student, stream }
            : student
        ))
      }
      webrtcStreaming.onConnectionStateChange = (studentId: string, state: string) => {
        console.log(`📡 Student ${studentId} WebRTC state:`, state)
      }
      webrtcStreamingRef.current = webrtcStreaming
      console.log('✅ New WebRTC streaming system initialized')
    } catch (error) {
      console.error('❌ WebRTC streaming initialization failed:', error)
    }
  }, [session.id, session.teacher_id])

  const fetchStudentFeeds = useCallback(async () => {
    try {
      setLoading(true)
      const { data: studentsData, error } = await supabase
        .from('student_exam_attempts')
        .select(`
          *,
          students!inner(
            student_id,
            full_name
          )
        `)
        .eq('session_id', session.id)
        .in('status', ['in_progress', 'not_started'])

      if (error) throw error

      const studentFeeds: StudentCameraFeed[] = studentsData?.map(student => ({
        id: student.id,
        student_id: student.student_id,
        student_name_id: student.students.student_id,
        full_name: student.students.full_name,
        camera_enabled: student.camera_enabled || false,
        last_seen: student.last_activity_at || student.updated_at,
        violations: []
      })) || []

      setStudents(studentFeeds)

    } catch (error) {
      console.error('Error fetching student camera feeds:', error)
    } finally {
      setLoading(false)
    }
  }, [session.id])

  useEffect(() => {
    fetchStudentFeeds()
    setupWebRTCStreaming()

    const frameReceiver = new CameraFrameReceiver(session.id)
    frameReceiver.startReceiving((studentId, frameData) => {
      setStudentFrames(prev => {
        const next = new Map(prev)
        next.set(studentId, frameData)
        return next
      })
    })
    frameReceiverRef.current = frameReceiver
    
    const subscription = supabase
      .channel(`camera_monitoring_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_exam_attempts',
          filter: `session_id=eq.${session.id}`
        },
        () => {
          fetchStudentFeeds()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      const webrtc = webrtcRef.current
      const webrtcStreaming = webrtcStreamingRef.current
      const frameReceiverLocal = frameReceiverRef.current
      if (webrtc) webrtc.destroy()
      if (webrtcStreaming) webrtcStreaming.destroy()
      if (frameReceiverLocal) frameReceiverLocal.stopReceiving()
    }
  }, [session.id, fetchStudentFeeds, setupWebRTCStreaming])

  const toggleFullscreen = (studentId: string) => {
    setSelectedStudent(selectedStudent === studentId ? null : studentId)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-blue-900/30 to-purple-900/30 backdrop-blur-sm" />
        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md w-full max-w-md">
            <CardContent className="p-8 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-gray-600">Loading camera feeds...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] overflow-y-auto"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gradient-to-br from-black/40 via-blue-900/30 to-purple-900/30 backdrop-blur-sm"
          onClick={selectedStudent ? () => setSelectedStudent(null) : onClose}
        />

        {/* Modal Container */}
        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className={`relative w-full overflow-hidden ${
              selectedStudent ? 'max-w-4xl' : 'max-w-7xl max-h-[90vh]'
            }`}
          >
            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md">
              {/* Header */}
              <div className="h-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500" />
              
              <CardHeader className="relative">
                {/* X Close Button - Higher z-index and better positioning */}
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={selectedStudent ? () => setSelectedStudent(null) : onClose}
                  className="absolute right-2 top-2 z-50 p-3 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-200/50 backdrop-blur-sm transition-colors shadow-lg"
                >
                  <X className="w-5 h-5 text-red-600" />
                </motion.button>
                
                <div className="flex items-center justify-between pr-16">
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-3">
                      <Monitor className="w-8 h-8 text-blue-600" />
                      Camera Monitoring
                    </CardTitle>
                    <p className="text-muted-foreground mt-1">
                      {session.session_name} - {students.length} students online
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <MagneticButton
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      variant="outline"
                      className={`px-4 py-2 rounded-lg ${
                        soundEnabled ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300'
                      }`}
                    >
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 mr-2 text-green-600" />
                      ) : (
                        <VolumeX className="w-4 h-4 mr-2 text-gray-600" />
                      )}
                      {soundEnabled ? 'Sound On' : 'Sound Off'}
                    </MagneticButton>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => setViewMode('snapshots')}
                        className={`px-3 py-2 rounded-md text-sm border ${viewMode === 'snapshots' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                      >Snapshots</button>
                      <button
                        onClick={() => setViewMode('webrtc')}
                        className={`px-3 py-2 rounded-md text-sm border ${viewMode === 'webrtc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                      >Live (WebRTC)</button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 max-h-[80vh] overflow-y-auto">
                {/* Grid view of all students */}
                  <div className="space-y-6">
                    {/* Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-700">Total Students</p>
                            <p className="text-2xl font-bold text-blue-900">{students.length}</p>
                          </div>
                          <Users className="w-8 h-8 text-blue-600" />
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-700">Cameras On</p>
                            <p className="text-2xl font-bold text-green-900">
                              {viewMode === 'webrtc' ? students.filter(s => !!s.stream).length : students.filter(s => !!studentFrames.get(s.student_id)).length}
                            </p>
                          </div>
                          <Camera className="w-8 h-8 text-green-600" />
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-700">Violations</p>
                            <p className="text-2xl font-bold text-red-900">
                              {students.reduce((acc, s) => acc + s.violations.length, 0)}
                            </p>
                          </div>
                          <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                      </div>
                    </div>

                    {/* Student Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
                      {students.map((student, index) => (
                        <motion.div
                          key={student.student_id || `student-${index}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                          onClick={() => toggleFullscreen(student.id)}
                        >
                        <div className="relative">
                          {viewMode === 'webrtc' ? (
                            student.stream ? (
                              <TeacherVideoDisplay
                                stream={student.stream}
                                studentId={student.student_id}
                                className="w-full h-48 object-cover"
                                soundEnabled={soundEnabled}
                              />
                            ) : (
                              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                                <div className="text-center">
                                  <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                  <p className="text-xs text-gray-500">Waiting for live video…</p>
                                </div>
                              </div>
                            )
                          ) : (
                            studentFrames.get(student.student_id) ? (
                              <Image src={studentFrames.get(student.student_id)!} alt={`${student.full_name} frame`} width={640} height={360} className="w-full h-48 object-cover rounded-lg" />
                            ) : (
                              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                                <div className="text-center">
                                  <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                  <p className="text-xs text-gray-500">Waiting for snapshot…</p>
                                </div>
                              </div>
                            )
                          )}
                          
                          {/* Warning Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setWarningStudent(student.id)
                            }}
                            className="absolute top-2 right-2 p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg transition-colors"
                            title="Send Warning"
                          >
                            <WarningIcon className="w-4 h-4" />
                          </button>
                          
                        {student.violations.length > 0 && (
                        <div className="absolute top-2 left-2">
                        <div className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                            {student.violations.length}
                            </div>
                            </div>
                            )}
                          </div>
                        
                           <div className="p-3">
                            <h4 className="font-medium text-gray-900 truncate">{student.full_name}</h4>
                            <p className="text-xs text-gray-500">ID: {student.student_id}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              viewMode === 'webrtc'
                                ? (student.stream ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800')
                                : (studentFrames.get(student.student_id) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800')
                              }`}>
                              {viewMode === 'webrtc' ? (student.stream ? 'Camera On' : 'Camera Off') : (studentFrames.get(student.student_id) ? 'Camera On' : 'Camera Off')}
                              </span>
                              <Eye className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {students.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                          <Monitor className="w-12 h-12 mx-auto" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Online</h3>
                        <p className="text-gray-500">Students will appear here when they join the exam session.</p>
                      </div>
                    )}
                    
                    {students.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Camera className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <h4 className="font-medium text-blue-900">Camera Monitoring Active</h4>
                              <p className="text-sm text-blue-700 mt-1">
                                Camera status is being tracked in real-time. Students with active cameras 
                                are being monitored for exam integrity.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Monitor className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <h4 className="font-medium text-blue-900">Live Video Streaming</h4>
                              <p className="text-sm text-blue-700 mt-1">
                                {webrtcRef.current 
                                  ? "WebRTC peer-to-peer connection established. Live video feeds will appear when students enable their cameras and establish connections."
                                  : "Attempting to establish WebRTC connections. Camera status monitoring is active."
                                }
                              </p>
                              <div className="mt-2 text-xs text-blue-600">
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                  <span>Real-time camera monitoring active</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
      {/* Simple WebRTC Student Modal */}
      {selectedStudent && (() => {
        const student = students.find(s => s.id === selectedStudent)
        return student ? (
          <TeacherStudentModal
            studentId={student.student_id}
            studentName={student.full_name}
            open={true}
            onClose={() => setSelectedStudent(null)}
          />
        ) : null
      })()}
      
      {/* Warning Modal */}
      {warningStudent && (() => {
        const student = students.find(s => s.id === warningStudent)
        return student ? (
          <SendWarningModal
            attempt={{
              id: student.id,
              student_id: student.student_id,
              students: {
                id: student.student_id,
                student_id: student.student_name_id || student.student_id,
                full_name: student.full_name,
                class_level: 'Unknown'
              }
            }}
            sessionId={session.id}
            teacherId={session.teacher_id}
            isOpen={true}
            onClose={() => setWarningStudent(null)}
            onSent={() => setWarningStudent(null)}
          />
        ) : null
      })()}
    </AnimatePresence>
  )
}