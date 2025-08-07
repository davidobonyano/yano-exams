'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, ArrowLeft, Clock, Eye } from 'lucide-react'

interface ResultsBlockedProps {
  studentName?: string
  examTitle?: string
  sessionCode?: string
  submittedAt?: string
}

export default function ResultsBlocked({ 
  studentName, 
  examTitle, 
  sessionCode,
  submittedAt 
}: ResultsBlockedProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full"
      >
        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-lg">
          <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-t-2xl" />
          
          <CardHeader className="text-center pt-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-6"
            >
              <Lock className="w-10 h-10 text-blue-600" />
            </motion.div>
            
            <CardTitle className="text-2xl mb-2">Results Under Review</CardTitle>
            <p className="text-muted-foreground">
              Your exam has been submitted successfully and is being reviewed by your teacher.
            </p>
          </CardHeader>
          
          <CardContent className="px-8 pb-8">
            {/* Exam Information */}
            <div className="space-y-4 mb-8">
              {examTitle && (
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Eye className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-blue-900">Exam</div>
                      <div className="text-blue-700">{examTitle}</div>
                    </div>
                  </div>
                </div>
              )}
              
              {studentName && (
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <div className="font-medium text-green-900">Student</div>
                    <div className="text-green-700">{studentName}</div>
                  </div>
                  {sessionCode && (
                    <Badge variant="outline" className="bg-white">
                      Session: {sessionCode}
                    </Badge>
                  )}
                </div>
              )}
              
              {submittedAt && (
                <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="font-medium text-purple-900">Submitted</div>
                    <div className="text-purple-700">
                      {new Date(submittedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Information Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6"
            >
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                Why can't I see my results?
              </h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Your teacher is currently reviewing all submitted exams
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Results will be released when grading is complete
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  You may receive your results via email or in-class announcement
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Check with your teacher for the expected release timeline
                </li>
              </ul>
            </motion.div>
            
            {/* Success Message */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center space-x-2 bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-full">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 bg-green-500 rounded-full"
                />
                <span className="text-sm font-medium">Exam submitted successfully!</span>
              </div>
            </motion.div>
            
            {/* Actions */}
            <div className="flex justify-center">
              <Button
                onClick={() => router.push('/dashboard')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                size="lg"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}