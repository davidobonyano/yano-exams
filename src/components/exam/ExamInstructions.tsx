'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ModernBackground } from '@/components/ui/modern-background'
import { TextReveal, GradientText } from '@/components/ui/text-effects'
import { 
  User, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  Shield, 
  Monitor, 
  MousePointer, 
  ArrowRight,
  BookOpen,
  Timer,
  Target,
  Award
} from 'lucide-react'

interface ExamInstructionsProps {
  studentName: string
  examTitle: string
  durationMinutes: number
  instructions?: string
  onContinueToExam: () => void
}

export default function ExamInstructions({ 
  studentName, 
  examTitle, 
  durationMinutes, 
  instructions,
  onContinueToExam 
}: ExamInstructionsProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  const rules = [
    {
      icon: <Eye className="w-5 h-5" />,
      title: "Stay Focused",
      description: "Do not switch tabs, windows, or leave the exam page during the test",
      severity: "high"
    },
    {
      icon: <MousePointer className="w-5 h-5" />,
      title: "No Right-Click",
      description: "Right-clicking, copying, and pasting are disabled for security",
      severity: "medium"
    },
    {
      icon: <Monitor className="w-5 h-5" />,
      title: "Single Device",
      description: "Use only one device. Do not open the exam on multiple devices",
      severity: "high"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "No External Help",
      description: "Do not use external resources, books, or ask for help during the exam",
      severity: "high"
    },
    {
      icon: <Timer className="w-5 h-5" />,
      title: "Time Management",
      description: "The timer cannot be paused. Manage your time wisely for all questions",
      severity: "medium"
    },
    {
      icon: <Target className="w-5 h-5" />,
      title: "Auto-Save",
      description: "Your answers are automatically saved. You can resume if disconnected",
      severity: "low"
    }
  ]

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <ModernBackground variant="default">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-4xl"
        >
          {/* Welcome Header */}
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
              className="mx-auto w-20 h-20 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-6 shadow-2xl"
            >
              <User className="w-10 h-10 text-white" />
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Welcome, <GradientText 
                text={studentName}
                gradient="from-green-600 via-blue-600 to-purple-600"
              />!
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-xl text-gray-600 mb-2"
            >
              You're about to start: <span className="font-semibold">{examTitle}</span>
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="flex items-center justify-center space-x-6 text-lg"
            >
              <div className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
                <Clock className="w-5 h-5" />
                <span className="font-medium">{durationMinutes} minutes</span>
              </div>
              <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
                <Award className="w-5 h-5" />
                <span className="font-medium">Good Luck!</span>
              </div>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Custom Instructions */}
            {instructions && (
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, duration: 0.8 }}
                className="lg:col-span-3 mb-6"
              >
                <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-md">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="w-6 h-6" />
                      <span>Special Instructions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-lg max-w-none">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {instructions}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Exam Rules */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4, duration: 0.8 }}
              className="lg:col-span-2"
            >
              <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-md h-full">
                <CardHeader className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-6 h-6" />
                    <span>Exam Rules & Guidelines</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {rules.map((rule, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.6 + index * 0.1, duration: 0.6 }}
                        className={`p-4 rounded-xl border-l-4 ${getSeverityColor(rule.severity)}`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {rule.icon}
                          </div>
                          <div>
                            <h3 className="font-semibold mb-1">{rule.title}</h3>
                            <p className="text-sm opacity-90">{rule.description}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Continue Section */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.6, duration: 0.8 }}
              className="lg:col-span-1"
            >
              <Card className="border-0 shadow-xl bg-white/10 backdrop-blur-md h-full">
                <CardHeader className="bg-gradient-to-r from-green-500 to-cyan-500 text-white">
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="w-6 h-6" />
                    <span>Ready to Start?</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div className="space-y-4 mb-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notice</h4>
                      <p className="text-sm text-yellow-700">
                        Once you click "Continue to Exam", the timer will start immediately 
                        and cannot be paused. Make sure you're ready!
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-700">Before You Begin:</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Stable internet connection</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Quiet environment</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>No distractions nearby</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acknowledgment Checkbox */}
                  <div className="space-y-4">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        I have read and understand all the exam rules and guidelines. 
                        I am ready to start the exam.
                      </span>
                    </label>

                    <motion.button
                      onClick={onContinueToExam}
                      disabled={!acknowledged}
                      whileHover={{ scale: acknowledged ? 1.02 : 1 }}
                      whileTap={{ scale: acknowledged ? 0.98 : 1 }}
                      className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {acknowledged ? (
                        <>
                          <span>Continue to Exam</span>
                          <ArrowRight className="w-6 h-6 ml-2" />
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-6 h-6 mr-2" />
                          <span>Acknowledge Rules First</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </ModernBackground>
  )
}