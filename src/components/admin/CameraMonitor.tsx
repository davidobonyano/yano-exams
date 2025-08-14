'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ExamSession } from '@/types/database-v2'
import { TeacherWebRTC } from '@/lib/webrtc'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { VideoStream } from '@/components/ui/video-stream'
import TeacherVideoDisplay from './TeacherVideoDisplay'
import { 
  X, 
  Camera, 
  CameraOff, 
  Users, 
  Eye,
  AlertTriangle,
  CheckCircle,
  Monitor,
  Maximize2,
  Volume2,
  VolumeX
} from 'lucide-react'

interface CameraMonitorProps {
  session: ExamSession
  onClose: () => void
}

interface StudentCameraFeed {
  id: string
  student_id: string
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
  const webrtcRef = useRef<TeacherWebRTC | null>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  useEffect(() => {
    fetchStudentFeeds()
    initializeWebRTC()
    
    // Set up real-time subscription for camera status updates
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
      if (webrtcRef.current) {
        webrtcRef.current.destroy()
      }
    }
  }, [session.id])

  const initializeWebRTC = async () => {
    try {
      // Always try to initialize WebRTC for live video capability
      console.log('Initializing WebRTC for live video streaming...')
      
      // Get current teacher ID from session or auth
      const teacherId = session.teacher_id
      
      const webrtc = new TeacherWebRTC(session.id, teacherId)
      
      // Handle incoming student streams
      webrtc.onStudentStreamReceived = (studentId: string, stream: MediaStream) => {
        console.log('🎥 RECEIVED STREAM from student:', studentId)
        console.log('Stream details:', {
          id: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        })
        
        // Check stream tracks
        stream.getVideoTracks().forEach((track, index) => {
          console.log(`Video track ${index}:`, {
            enabled: track.enabled,
            readyState: track.readyState,
            settings: track.getSettings()
          })
        })
        
        // Update student list with stream
        setStudents(prev => {
          const updated = prev.map(student => 
            student.student_id === studentId 
              ? { ...student, stream }
              : student
          )
          console.log('Updated students with stream:', updated.find(s => s.student_id === studentId))
          return updated
        })
      }
      
      // Handle connection status
      (webrtc as any).onConnectionStateChange = (studentId: string, state: string) => {
        console.log(`Student ${studentId} connection state:`, state)
        if (state === 'connected') {
          console.log(`Live video established with student ${studentId}`)
        }
      }
      
      webrtcRef.current = webrtc
      console.log('WebRTC initialized successfully - live video streaming enabled')
    } catch (error) {
      console.error('WebRTC initialization failed:', error)
      console.log('Continuing with camera status monitoring only')
    }
  }

  const fetchStudentFeeds = async () => {
    try {
      setLoading(true)

      // Fetch students who have joined this session
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

      console.log('Camera monitor students data:', studentsData)

      const studentFeeds: StudentCameraFeed[] = studentsData?.map(student => ({
        id: student.id,
        student_id: student.students.student_id,
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
  }

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
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {selectedStudent ? (
                  // Full-screen view of selected student
                  <div className="space-y-4">
                    {(() => {
                      const student = students.find(s => s.id === selectedStudent)
                      if (!student) return null
                      
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-semibold">{student.full_name}</h3>
                              <p className="text-gray-500">ID: {student.student_id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {student.camera_enabled ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Camera On
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                  <CameraOff className="w-4 h-4 mr-1" />
                                  Camera Off
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative">
                          {student.camera_enabled ? (
                          <div className="text-white text-center">
                          <div className="relative mb-4">
                            <Camera className="w-20 h-20 mx-auto opacity-80" />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full animate-pulse flex items-center justify-center">
                                <div className="w-3 h-3 bg-white rounded-full"></div>
                                </div>
                            </div>
                          <p className="text-xl font-bold">Camera Active</p>
                          <p className="text-sm opacity-75 mb-3">
                          Student is being monitored
                          </p>
                          <div className="bg-green-600/30 px-3 py-2 rounded-lg border border-green-500/50">
                            <p className="text-sm font-medium">✓ Monitoring Active</p>
                          <p className="text-xs opacity-75 mt-1">Real-time status tracking</p>
                          </div>
                          </div>
                          ) : (
                          <div className="text-gray-400 text-center">
                          <div className="relative mb-4">
                          <CameraOff className="w-20 h-20 mx-auto opacity-50" />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                <X className="w-3 h-3 text-white" />
                                </div>
                            </div>
                          <p className="text-xl font-bold">Camera Disabled</p>
                          <p className="text-sm mb-3">Student has not enabled camera</p>
                          <div className="bg-red-600/30 px-3 py-2 rounded-lg border border-red-500/50">
                            <p className="text-sm font-medium">✗ No Monitoring</p>
                          <p className="text-xs opacity-75 mt-1">Camera access required</p>
                          </div>
                          </div>
                          )}
                          </div>

                          {student.violations.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <h4 className="font-medium text-red-900">Security Violations</h4>
                              </div>
                              <ul className="text-sm text-red-700 space-y-1">
                                {student.violations.map((violation, index) => (
                                  <li key={index}>• {violation}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  // Grid view of all students
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
                              {students.filter(s => s.camera_enabled).length}
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
                          key={student.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                          onClick={() => toggleFullscreen(student.id)}
                        >
                          <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
                          {student.camera_enabled ? (
                          <div className="text-white text-center">
                          <div className="relative mb-2">
                            <Camera className="w-8 h-8 mx-auto opacity-75" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            </div>
                              <p className="text-xs font-medium">Active</p>
                            <div className="mt-1 px-2 py-1 bg-green-600/20 rounded text-xs">
                            Monitoring
                          </div>
                          </div>
                          ) : (
                          <div className="text-gray-400 text-center">
                            <div className="relative mb-2">
                                <CameraOff className="w-8 h-8 mx-auto opacity-50" />
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                          </div>
                          <p className="text-xs">Off</p>
                            <div className="mt-1 px-2 py-1 bg-red-600/20 rounded text-xs">
                                No Access
                              </div>
                            </div>
                          )}
                          
                          {/* Status indicator */}
                          <div className="absolute top-1 left-1">
                            <div className={`px-1 py-0.5 rounded text-xs font-bold ${
                              student.camera_enabled 
                                ? 'bg-green-600 text-white' 
                              : 'bg-red-600 text-white'
                            }`}>
                                 {student.camera_enabled ? 'ACTIVE' : 'OFF'}
                               </div>
                             </div>
                             
                             <div className="absolute top-2 right-2">
                               <Eye className="w-4 h-4 text-white opacity-50" />
                             </div>
                            
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
                                student.camera_enabled 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {student.camera_enabled ? 'Online' : 'Offline'}
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
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}