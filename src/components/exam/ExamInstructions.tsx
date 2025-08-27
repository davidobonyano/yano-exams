'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  User, 
  Clock, 
  CheckCircle, 
  Eye, 
  Shield, 
  Monitor, 
  MousePointer, 
  ArrowRight,
  BookOpen,
  Timer,
  Target,
  Award,
  AlertCircle,
  Play,
  Calendar,
  GraduationCap,
  Camera
} from 'lucide-react'

interface ExamInstructionsProps {
  studentName: string
  examTitle: string
  durationMinutes: number
  instructions?: string
  onContinueToExam: () => void
  onStartDemo?: () => void
  upcomingExams?: Array<{
    title: string
    date: string
    duration: number
  }>
  cameraRequired?: boolean
  onCameraGranted?: (stream: MediaStream) => void
}

export default function ExamInstructions({ 
  studentName, 
  examTitle, 
  durationMinutes, 
  instructions,
  onContinueToExam,
  onStartDemo,
  upcomingExams = [],
  cameraRequired = false,
  onCameraGranted
}: ExamInstructionsProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  const rules = [
    {
      icon: <Eye className="w-5 h-5 text-gray-600" />,
      title: "Stay Focused",
      description: "Do not switch tabs, windows, or leave the exam page during the test",
      critical: true
    },
    {
      icon: <MousePointer className="w-5 h-5 text-gray-600" />,
      title: "No Right-Click",
      description: "Right-clicking, copying, and pasting are disabled for security",
      critical: false
    },
    {
      icon: <Monitor className="w-5 h-5 text-gray-600" />,
      title: "Single Device",
      description: "Use only one device. Do not open the exam on multiple devices",
      critical: true
    },
    {
      icon: <Shield className="w-5 h-5 text-gray-600" />,
      title: "No External Help",
      description: "Do not use external resources, books, or ask for help during the exam",
      critical: true
    },
    ...(cameraRequired ? [{
      icon: <Camera className="w-5 h-5 text-gray-600" />,
      title: "Camera Monitoring",
      description: "Camera will automatically start when you agree and stop after submission",
      critical: true
    }] : []),
    {
      icon: <Timer className="w-5 h-5 text-gray-600" />,
      title: "Time Management",
      description: "The timer cannot be paused. Manage your time wisely for all questions",
      critical: false
    },
    {
      icon: <Target className="w-5 h-5 text-gray-600" />,
      title: "Auto-Save",
      description: "Your answers are automatically saved. You can resume if disconnected",
      critical: false
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {studentName}
          </h1>
          
          <p className="text-lg text-gray-600 mb-6">
            You&apos;re about to start: <span className="font-semibold text-gray-900">{examTitle}</span>
          </p>
          
          <div className="flex items-center justify-center space-x-8">
            <div className="flex items-center space-x-2 text-gray-700">
              <Clock className="w-5 h-5" />
              <span className="font-medium">{durationMinutes} minutes</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700">
              <Award className="w-5 h-5" />
              <span className="font-medium">Best of luck!</span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Demo & Upcoming Exams */}
          <div className="space-y-6">
            {/* Demo Section */}
            {onStartDemo && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                <Card className="border border-green-200 shadow-sm">
                  <CardHeader className="bg-green-50 border-b border-green-200">
                    <CardTitle className="flex items-center space-x-2 text-gray-900">
                      <Play className="w-5 h-5 text-green-600" />
                      <span>New to Online Exams?</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-gray-700 mb-4">
                      Take a quick demo to familiarize yourself with the exam interface and question types.
                    </p>
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">5 minutes</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Questions:</span>
                        <span className="font-medium">5 sample questions</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Scoring:</span>
                        <span className="font-medium">Practice only</span>
                      </div>
                    </div>
                    <motion.button
                      onClick={onStartDemo}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full h-12 font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 flex items-center justify-center"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Take Demo Exam
                    </motion.button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Upcoming Exams */}
            {upcomingExams.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                <Card className="border border-blue-200 shadow-sm">
                  <CardHeader className="bg-blue-50 border-b border-blue-200">
                    <CardTitle className="flex items-center space-x-2 text-gray-900">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <span>Upcoming Exams</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {upcomingExams.map((exam, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{exam.title}</p>
                            <p className="text-sm text-gray-600">{exam.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-blue-600">{exam.duration} min</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Custom Instructions */}
            {instructions && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                <Card className="border border-gray-200 shadow-sm">
                  <CardHeader className="bg-blue-50 border-b border-gray-200">
                    <CardTitle className="flex items-center space-x-2 text-gray-900">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <span>Special Instructions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {instructions}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Right Column - Concise Rules & Start */}
          <div className="space-y-6">
            {/* Quick Rules */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="bg-gray-50 border-b border-gray-200">
                  <CardTitle className="flex items-center space-x-2 text-gray-900">
                    <Shield className="w-5 h-5 text-amber-600" />
                    <span>Quick Rules</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                <div className="space-y-3">
                {rules.filter(rule => rule.critical).map((rule, index) => (
                <div key={index} className="flex items-center space-x-3 text-sm">
                  {rule.icon}
                    <span>{rule.description}</span>
                  </div>
                ))}
                <div className="flex items-center space-x-3 text-sm">
                  <Timer className="w-4 h-4 text-amber-500" />
                  <span>Timer cannot be paused</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <Target className="w-4 h-4 text-green-500" />
                  <span>Answers auto-save</span>
                </div>
                </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Start Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <Card className="border border-green-200 shadow-sm">
                <CardHeader className="bg-green-50 border-b border-green-200">
                  <CardTitle className="flex items-center space-x-2 text-gray-900">
                    <GraduationCap className="w-5 h-5 text-green-600" />
                    <span>Ready to Start?</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Important Notice */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-700">
                          Timer starts immediately and cannot be paused!
                        </p>
                      </div>
                    </div>
                    
                    {/* Checklist */}
                    <div className="space-y-2">
                      {[
                        'Stable internet',
                        'Quiet environment',
                        'No distractions',
                        'Time available'
                      ].map((item, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>

                    {/* Acknowledgment */}
                    <div className="space-y-3 pt-3 border-t border-gray-200">
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          onChange={(e) => setAcknowledged(e.target.checked)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm text-gray-700">
                          I understand the rules and am ready to start
                        </span>
                      </label>

                      <motion.button
                        onClick={async () => {
                          if (cameraRequired && onCameraGranted) {
                            try {
                              const stream = await navigator.mediaDevices.getUserMedia({
                                video: {
                                  width: { ideal: 640 },
                                  height: { ideal: 480 },
                                  facingMode: 'user'
                                },
                                audio: false
                              })
                              onCameraGranted(stream)
                            } catch (err) {
                              console.error('Camera access error:', err)
                              alert('Camera access is required for this exam. Please allow camera access.')
                              return
                            }
                          }
                          onContinueToExam()
                        }}
                        disabled={!acknowledged}
                        whileHover={{ scale: acknowledged ? 1.02 : 1 }}
                        whileTap={{ scale: acknowledged ? 0.98 : 1 }}
                        className="w-full h-12 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 flex items-center justify-center"
                      >
                        {acknowledged ? (
                          <>
                            <span>Continue to Exam</span>
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5 mr-2" />
                            <span>Acknowledge Rules First</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
