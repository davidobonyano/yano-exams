'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Clock, ArrowRight, X } from 'lucide-react'

export default function ExamSubmissionSuccess() {
  const [isVisible, setIsVisible] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const examSubmitted = searchParams.get('examSubmitted')
    if (examSubmitted === 'true') {
      setIsVisible(true)

      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setIsVisible(false)
            // Clean up URL without the parameter
            router.replace('/dashboard')
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [searchParams, router])

  const handleDismiss = () => {
    setIsVisible(false)
    router.replace('/dashboard')
  }

  const handleContinue = () => {
    setIsVisible(false)
    router.replace('/dashboard')
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 50 }}
            animate={{ y: 0 }}
            exit={{ y: 50 }}
            className="max-w-md w-full"
          >
            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-lg overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />
              
              <CardContent className="p-8 text-center relative">
                <button
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="mx-auto w-20 h-20 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-6"
                >
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Exam Submitted Successfully!
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Your exam has been submitted and saved. Your teacher will review your answers and release results when ready.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6"
                >
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-2" />
                    What happens next?
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Your answers are being processed</li>
                    <li>• Results will be available when your teacher releases them</li>
                    <li>• You may receive results via email or class announcement</li>
                    <li>• Check with your teacher for the expected timeline</li>
                  </ul>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center justify-between"
                >
                  <div className="text-sm text-gray-500">
                    Auto-closing in {countdown}s
                  </div>
                  <Button
                    onClick={handleContinue}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    Continue to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}