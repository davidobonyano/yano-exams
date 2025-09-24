'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Exam } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { X, Calendar, Clock, Users, FileText, CheckCircle, Settings, AlertTriangle, Award } from 'lucide-react'
import toast from 'react-hot-toast'

interface CreateSessionModalProps {
  exam: Exam
  onClose: () => void
  onCreated: () => void
}

export default function CreateSessionModal({ exam, onClose, onCreated }: CreateSessionModalProps) {
  const [sessionName, setSessionName] = useState(`${exam.title} - Session`)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [maxStudents, setMaxStudents] = useState(50)
  const [instructions, setInstructions] = useState('')
  const [allowLateJoin, setAllowLateJoin] = useState(false)
  const [enableCameraMonitoring, setEnableCameraMonitoring] = useState(false)
  const [showResultsAfterSubmit, setShowResultsAfterSubmit] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionCode, setSessionCode] = useState('')

  // Set default times (1 hour from now to 2 hours from now)
  useState(() => {
    const now = new Date()
    const start = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
    const end = new Date(start.getTime() + exam.duration_minutes * 60 * 1000 + 30 * 60 * 1000) // duration + 30 min buffer

    setStartsAt(start.toISOString().slice(0, 16)) // Format for datetime-local input
    setEndsAt(end.toISOString().slice(0, 16))
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Validate dates
      const startDate = new Date(startsAt)
      const endDate = new Date(endsAt)
      
      if (startDate >= endDate) {
        throw new Error('End time must be after start time')
      }

      if (startDate < new Date()) {
        throw new Error('Start time must be in the future')
      }

      const { data, error } = await supabase.rpc('create_exam_session', {
        p_exam_id: exam.id,
        p_session_name: sessionName.trim(),
        p_class_level: exam.class_level,
        p_starts_at: startDate.toISOString(),
        p_ends_at: endDate.toISOString(),
        p_max_students: maxStudents,
        p_instructions: instructions.trim() || null,
        p_camera_monitoring_enabled: enableCameraMonitoring,
        p_show_results_after_submit: showResultsAfterSubmit
      })

      if (error) throw error

      if (data.success) {
        setSessionCode(data.session_code)
        toast.success(`Session "${sessionName}" created successfully! Code: ${data.session_code}`)
        onCreated()
      } else {
        throw new Error(data.error || 'Failed to create session')
      }
    } catch (err: unknown) {
      console.error('Error creating session:', err)
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  if (sessionCode) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] overflow-y-auto"
        >
          {/* Enhanced Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-br from-black/20 via-green-900/20 to-blue-900/20 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="flex items-center justify-center min-h-screen p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-md"
            >
              <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
                {/* Success Gradient Header */}
                <div className="h-2 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
                
                {/* Header */}
                <CardHeader className="relative text-center">
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    className="w-16 h-16 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle className="w-8 h-8 text-white" />
                  </motion.div>
                  
                  <CardTitle className="text-2xl font-bold text-green-800">
                    Session Created!
                  </CardTitle>
                  <p className="text-muted-foreground">Share this code with your students</p>
                </CardHeader>

                <CardContent className="p-8 text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                    className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border-2 border-indigo-200 mb-6"
                  >
                    <div className="text-4xl font-mono font-bold text-indigo-600 mb-2">
                      {sessionCode}
                    </div>
                    <p className="text-sm text-indigo-500 font-medium">Session Code</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-3 text-sm text-gray-700 mb-8"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Session:</span>
                      <span className="text-gray-600">{sessionName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Starts:</span>
                      <span className="text-gray-600">{new Date(startsAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Ends:</span>
                      <span className="text-gray-600">{new Date(endsAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Max Students:</span>
                      <span className="text-gray-600">{maxStudents}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Camera Monitoring:</span>
                      <span className={`text-sm px-2 py-1 rounded-full ${enableCameraMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {enableCameraMonitoring ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Show Results:</span>
                      <span className={`text-sm px-2 py-1 rounded-full ${showResultsAfterSubmit ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {showResultsAfterSubmit ? 'Immediately' : 'Hidden'}
                      </span>
                    </div>
                  </motion.div>

                  <MagneticButton
                    onClick={onClose}
                    className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl flex items-center justify-center"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Done
                  </MagneticButton>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] overflow-y-auto"
      >
        {/* Enhanced Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gradient-to-br from-black/20 via-indigo-900/20 to-purple-900/20 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Container */}
        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-2xl z-10"
          >
            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden max-h-[90vh] flex flex-col">
              {/* Gradient Header */}
              <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />
              
              {/* Header */}
              <CardHeader className="relative flex-shrink-0">
                {/* Close Button - Top Right */}
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Title Section */}
                <div className="pr-16">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
                      <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold">Create Exam Session</CardTitle>
                      <p className="text-muted-foreground">
                        For: <strong>{exam.title}</strong> ({exam.class_level})
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-8 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Session Name */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <FloatingInput
                      label="Session Name *"
                      icon={<FileText className="w-5 h-5" />}
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      required
                      placeholder="e.g., JSS1 Mathematics - Morning Session"
                    />
                  </motion.div>

                  {/* Date and Time Grid */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Start Time *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        className="w-full bg-white/95 backdrop-blur-sm border-2 border-gray-200 rounded-xl px-4 py-4 text-gray-900 transition-all duration-300 focus:outline-none focus:border-indigo-500 focus:bg-white [color-scheme:light]"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        End Time *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        className="w-full bg-white/95 backdrop-blur-sm border-2 border-gray-200 rounded-xl px-4 py-4 text-gray-900 transition-all duration-300 focus:outline-none focus:border-indigo-500 focus:bg-white [color-scheme:light]"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                      />
                    </div>
                  </motion.div>

                  {/* Max Students */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <FloatingInput
                      label="Maximum Students"
                      icon={<Users className="w-5 h-5" />}
                      type="number"
                      min="1"
                      max="200"
                      value={maxStudents.toString()}
                      onChange={(e) => setMaxStudents(parseInt(e.target.value) || 50)}
                    />
                  </motion.div>

                  {/* Instructions */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="space-y-2"
                  >
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Special Instructions
                    </label>
                    <textarea
                      rows={3}
                      className="w-full bg-white/95 backdrop-blur-sm border-2 border-gray-200 rounded-xl px-4 py-4 text-gray-900 transition-all duration-300 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none"
                      placeholder="Any special instructions for students..."
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                    />
                  </motion.div>

                  {/* Session Options */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center space-x-3 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200">
                      <input
                        id="allowLateJoin"
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={allowLateJoin}
                        onChange={(e) => setAllowLateJoin(e.target.checked)}
                      />
                      <label htmlFor="allowLateJoin" className="text-sm font-medium text-gray-700">
                        Allow students to join after session starts
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200">
                      <input
                        id="enableCameraMonitoring"
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={enableCameraMonitoring}
                        onChange={(e) => setEnableCameraMonitoring(e.target.checked)}
                      />
                      <div className="flex-1">
                        <label htmlFor="enableCameraMonitoring" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Enable camera monitoring
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Students will be prompted to turn on their cameras during the exam
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200">
                      <input
                        id="showResultsAfterSubmit"
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={showResultsAfterSubmit}
                        onChange={(e) => setShowResultsAfterSubmit(e.target.checked)}
                      />
                      <div className="flex-1">
                        <label htmlFor="showResultsAfterSubmit" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Award className="w-4 h-4" />
                          Show results after submission
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Students will see their results immediately after submitting the exam
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Error Display */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="p-4 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl"
                      >
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span className="text-sm font-medium text-red-800">{error}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action Buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="flex flex-col sm:flex-row gap-4 pt-6"
                  >
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl disabled:opacity-60 transition-all duration-200 hover:scale-105 flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                          />
                          Creating Session...
                        </>
                      ) : (
                        <>
                          <Settings className="w-5 h-5 mr-2" />
                          Create Session
                        </>
                      )}
                    </button>

                    <MagneticButton
                      onClick={onClose}
                      variant="outline"
                      className="flex-1 h-14 text-lg font-semibold bg-white/80 backdrop-blur-sm border-2 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300 rounded-xl flex items-center justify-center"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Cancel
                    </MagneticButton>
                  </motion.div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}