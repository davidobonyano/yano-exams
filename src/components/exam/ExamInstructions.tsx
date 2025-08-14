'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Award,
  AlertCircle
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Custom Instructions */}
          {instructions && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="lg:col-span-3 mb-8"
            >
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="bg-blue-50 border-b border-gray-200">
                  <CardTitle className="flex items-center space-x-2 text-gray-900">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <span>Special Instructions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="prose max-w-none">
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
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="lg:col-span-2"
          >
            <Card className="border border-gray-200 shadow-sm h-full">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="flex items-center space-x-2 text-gray-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Exam Rules & Guidelines</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {rules.map((rule, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
                      className={`p-4 rounded-lg border ${
                        rule.critical 
                          ? 'border-red-200 bg-red-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {rule.icon}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-gray-900">{rule.title}</h3>
                            {rule.critical && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                                Critical
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
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
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="lg:col-span-1"
          >
            <Card className="border border-gray-200 shadow-sm h-full">
              <CardHeader className="bg-green-50 border-b border-gray-200">
                <CardTitle className="flex items-center space-x-2 text-gray-900">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Ready to Start?</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Important Notice */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-amber-800 mb-1">Important Notice</h4>
                        <p className="text-sm text-amber-700">
                          Once you click &quot;Continue to Exam&quot;, the timer will start immediately 
                          and cannot be paused. Make sure you&apos;re ready!
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pre-exam Checklist */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Before You Begin:</h4>
                    <div className="space-y-2">
                      {[
                        'Stable internet connection',
                        'Quiet environment',
                        'No distractions nearby',
                        'Sufficient time available'
                      ].map((item, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Acknowledgment */}
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
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
  )
}
