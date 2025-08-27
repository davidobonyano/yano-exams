'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { Send, X, CheckCircle, AlertTriangle } from 'lucide-react'

interface SubmitConfirmationModalProps {
  isOpen: boolean
  step: 'confirm' | 'submitting' | 'success'
  onClose: () => void
  onConfirm: () => Promise<void>
  questionsAnswered: number
  totalQuestions: number
  timeRemaining: number
}

export default function SubmitConfirmationModal({
  isOpen,
  step,
  onClose,
  onConfirm,
  questionsAnswered,
  totalQuestions,
  timeRemaining
}: SubmitConfirmationModalProps) {
  const isSubmitting = step === 'submitting'
  const isSuccess = step === 'success'
  const unansweredCount = useMemo(() => totalQuestions - questionsAnswered, [totalQuestions, questionsAnswered])
  
  const handleConfirm = async () => {
    if (isSubmitting || isSuccess) return
    await onConfirm()
  }



  return (
    <AnimatePresence>
      {isOpen && (
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
            className="fixed inset-0 bg-gradient-to-br from-black/60 via-blue-900/40 to-purple-900/40 backdrop-blur-sm"
            onClick={!isSubmitting ? onClose : undefined}
          />

          {/* Modal Container */}
          <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-md"
            >
              <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
                {/* Header Bar */}
                <div className="h-2 bg-gradient-to-r from-green-500 via-emerald-500 to-cyan-500" />
                
                <CardHeader className="relative">
                  {!isSubmitting && !isSuccess && (
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className="absolute right-4 top-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  )}
                  
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
                      className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
                    >
                      {isSubmitting ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                        />
                      ) : isSuccess ? (
                        <CheckCircle className="w-8 h-8 text-white" />
                      ) : (
                        <Send className="w-8 h-8 text-white" />
                      )}
                    </motion.div>
                    
                    <CardTitle className="text-2xl font-bold">
                      {isSubmitting ? 'Submitting Exam...' : isSuccess ? 'Submitted!' : 'Submit Exam?'}
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {isSubmitting ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center space-y-4"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-green-600"
                      >
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                      </motion.div>
                      <p className="text-gray-600">
                        Please wait while we process your exam submission...
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-700">
                          🔒 Do not close this window or navigate away
                        </p>
                      </div>
                    </motion.div>
                  ) : isSuccess ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center space-y-4"
                    >
                      <div className="text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                      </div>
                      <p className="text-gray-700 text-lg">Exam submitted successfully!</p>
                      <p className="text-sm text-gray-500">Redirecting to dashboard…</p>
                    </motion.div>
                  ) : (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center"
                      >
                        <p className="text-gray-700 text-lg mb-4">
                          Are you sure you want to submit your exam?
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                          Once submitted, you cannot make any changes to your answers.
                        </p>
                      </motion.div>

                      {/* Stats */}
                      <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="grid grid-cols-2 gap-4"
                      >
                      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
                      <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-600">{questionsAnswered}</div>
                      <div className="text-sm text-green-600">Answered</div>
                      </div>
                      
                      <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-100 rounded-xl border border-orange-200">
                      <AlertTriangle className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-orange-600">{unansweredCount}</div>
                      <div className="text-sm text-orange-600">Unanswered</div>
                      </div>
                      </motion.div>

                      {/* Warning for unanswered questions */}
                      {unansweredCount > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="bg-amber-50 border border-amber-200 rounded-lg p-4"
                        >
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <h4 className="font-medium text-amber-900">Incomplete Exam</h4>
                              <p className="text-sm text-amber-700 mt-1">
                                You have {unansweredCount} unanswered question{unansweredCount !== 1 ? 's' : ''}. 
                                These will be marked as incorrect.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Action Buttons */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex gap-4"
                      >
                        <MagneticButton
                          onClick={onClose}
                          variant="outline"
                          size="lg"
                          className="flex-1"
                        >
                          Cancel
                        </MagneticButton>
                        
                        <MagneticButton
                          onClick={handleConfirm}
                          variant="primary"
                          size="lg"
                          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Submit Exam
                        </MagneticButton>
                      </motion.div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}