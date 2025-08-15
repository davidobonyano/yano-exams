'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FloatingInput } from '@/components/ui/floating-input'
import { ModernBackground } from '@/components/ui/modern-background'
import { TextReveal, GradientText } from '@/components/ui/text-effects'
import { BookOpen, User, Hash, Award, CheckCircle, Play } from 'lucide-react'
import toast from 'react-hot-toast'

interface StudentLoginProps {
  onLoginSuccess: (sessionData: {
    student_name: string
    session_id: string
    exam_id: string
    exam_title: string
    duration_minutes: number
    instructions?: string
    participant_id: string
    student_id: string
    can_resume?: boolean
    attempt_id?: string
    time_remaining?: number
  }) => void
  onStartDemo?: () => void
}

export default function SimpleStudentLogin({ onLoginSuccess, onStartDemo }: StudentLoginProps) {
  const [sessionCode, setSessionCode] = useState('')
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!sessionCode.trim() || !studentId.trim()) {
      toast.error('Please enter both Session Code and Student ID')
      return
    }

    if (sessionCode.length !== 6 || !/^[A-Za-z0-9]{6}$/.test(sessionCode)) {
      toast.error('Session code must be exactly 6 characters')
      return
    }

    setLoading(true)

    try {
      // Call the simplified join function
      const { data, error } = await supabase.rpc('join_session_by_student_id', {
        p_session_code: sessionCode,
        p_student_id: studentId.toUpperCase()
      })

      if (error) throw error

      const result = data
      if (!result.success) {
        toast.error(result.error)
        return
      }

      // Check if student has an existing attempt
      const { data: statusData, error: statusError } = await supabase.rpc('get_student_exam_status', {
        p_session_id: result.session_id,
        p_student_id: studentId.toUpperCase()
      })

      if (statusError) throw statusError

      const status = statusData
      
      toast.success(`Welcome, ${result.student_name}!`)
      
      onLoginSuccess({
        student_name: result.student_name,
        student_class_level: result.student_class_level,
        session_id: result.session_id,
        session_code: result.session_code,
        exam_id: result.exam_id,
        exam_title: result.exam_title,
        duration_minutes: result.duration_minutes,
        instructions: result.instructions,
        participant_id: result.participant_id,
        student_id: result.student_id,
        teacher_id: result.teacher_id,
        camera_monitoring_enabled: result.camera_monitoring_enabled,
        show_results_after_submit: result.show_results_after_submit,
        can_resume: status.can_resume || false,
        attempt_id: status.attempt_id,
        time_remaining: status.time_remaining
      })
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleLogin()
    }
  }

  return (
    <ModernBackground variant="default">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 20 }}
              className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full flex items-center justify-center mb-6 shadow-2xl"
            >
              <Award className="w-8 h-8 text-white" />
            </motion.div>
            
            <TextReveal
              text="Student Exam Portal"
              className="text-3xl md:text-4xl font-bold mb-3"
              delay={0.6}
            />
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="text-gray-600 text-lg"
            >
              Enter your credentials to access your exam
            </motion.p>
          </motion.div>

          {/* Login Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />
              
              <CardHeader className="text-center p-6">
                <CardTitle className="text-xl font-bold mb-2">
                  <GradientText 
                    text="Quick Access Login"
                    gradient="from-blue-600 via-purple-600 to-cyan-600"
                  />
                </CardTitle>
                <CardDescription className="text-sm">
                  Only your Student ID and Session Code required
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 pt-0 space-y-6">
                {/* Session Code */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4, duration: 0.6 }}
                >
                  <FloatingInput
                    label="Session Code"
                    icon={<Hash className="w-5 h-5" />}
                    value={sessionCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
                      setSessionCode(value)
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="A1B2C3"
                    className="text-center text-xl font-mono tracking-widest h-14"
                    maxLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    6-character code from your teacher
                  </p>
                </motion.div>

                {/* Student ID */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.6, duration: 0.6 }}
                >
                  <FloatingInput
                    label="Student ID"
                    icon={<User className="w-5 h-5" />}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    placeholder="JSS1A-001"
                    className="font-mono text-center h-12"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Your unique student ID (e.g., JSS1A-001)
                  </p>
                </motion.div>

                {/* Login Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8, duration: 0.6 }}
                  className="pt-4"
                >
                  <button
                    onClick={handleLogin}
                    disabled={loading || !sessionCode || !studentId}
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"
                        />
                        Logging in...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 mr-3" />
                        Access Exam
                      </>
                    )}
                  </button>
                </motion.div>



                {/* Instructions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2, duration: 0.6 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4"
                >
                  <h3 className="font-semibold text-center mb-3 flex items-center justify-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    How to Access
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        1
                      </div>
                      <span>Get your 6-digit session code from teacher</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        2
                      </div>
                      <span>Enter your Student ID (e.g., JSS1A-001)</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        3
                      </div>
                      <span>Click &quot;Access Exam&quot; to begin</span>
                    </div>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </ModernBackground>
  )
}