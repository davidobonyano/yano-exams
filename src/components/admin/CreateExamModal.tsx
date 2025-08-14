'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ClassLevel } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { EnhancedSelect } from '@/components/ui/enhanced-select'
import { X, BookOpen, Clock, Users, Target, Loader2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const CLASS_LEVELS: { value: ClassLevel; label: string }[] = [
  { value: 'JSS1', label: '🎓 Junior Secondary School 1 (JSS1)' },
  { value: 'JSS2', label: '🎓 Junior Secondary School 2 (JSS2)' },
  { value: 'JSS3', label: '🎓 Junior Secondary School 3 (JSS3)' },
  { value: 'SS1', label: '🏆 Senior Secondary School 1 (SS1)' },
  { value: 'SS2', label: '🏆 Senior Secondary School 2 (SS2)' },
  { value: 'SS3', label: '🏆 Senior Secondary School 3 (SS3)' },
]

interface CreateExamModalProps {
  onClose: () => void
  onCreated: () => void
}

export default function CreateExamModal({ onClose, onCreated }: CreateExamModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [classLevel, setClassLevel] = useState<ClassLevel>('JSS1')
  const [duration, setDuration] = useState(60)
  const [totalQuestions, setTotalQuestions] = useState(20)
  const [passingScore, setPassingScore] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('exams')
        .insert([{
          title: title.trim(),
          description: description.trim() || null,
          class_level: classLevel,
          duration_minutes: duration,
          total_questions: totalQuestions,
          passing_score: passingScore,
          created_by: user.id
        }])

      if (error) throw error

      toast.success('Exam created successfully!')
      onCreated()
      onClose()
    } catch (err: any) {
      console.error('Error creating exam:', err)
      const errorMessage = err.message || 'Failed to create exam'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] overflow-y-auto"
      >
        {/* Enhanced Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gradient-to-br from-black/40 via-purple-900/30 to-blue-900/30 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Container */}
        <div className="flex items-center justify-center min-h-screen  p-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-2xl z-10"
          >
            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
              {/* Gradient Header */}
              <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />
              
              {/* Header */}
              <CardHeader className="relative">
                {/* Close Button - Top Right */}
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Title Section */}
                <div className="flex items-center space-x-4 pr-16">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold">Create New Exam</CardTitle>
                    <p className="text-muted-foreground">Design your assessment with advanced settings</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-8 max-h-[70vh] overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Exam Title */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <FloatingInput
                      label="Exam Title *"
                      icon={<BookOpen className="w-5 h-5" />}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="e.g., JSS1 Mathematics Mid-Term Exam"
                    />
                  </motion.div>

                  {/* Description */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-2"
                  >
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Description
                    </label>
                    <textarea
                      rows={3}
                      className="w-full bg-white/95 backdrop-blur-sm border-2 border-gray-200 rounded-xl px-4 py-4 text-gray-900 transition-all duration-300 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                      placeholder="Brief description of the exam (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </motion.div>

                  {/* Class Level */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-2"
                  >
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Class Level *
                    </label>
                    <EnhancedSelect
                      label="Class Level *"
                      options={CLASS_LEVELS}
                      value={classLevel}
                      onChange={(value) => setClassLevel(value as ClassLevel)}
                      placeholder="Select class level"
                    />
                  </motion.div>

                  {/* Settings Grid */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <FloatingInput
                          label="Duration (mins) *"
                          icon={<Clock className="w-5 h-5" />}
                          type="number"
                          min="1"
                          max="300"
                          value={duration.toString()}
                          onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                          required
                          placeholder="60"
                        />
                      </div>

                      <div>
                        <FloatingInput
                          label="Total Questions *"
                          icon={<Target className="w-5 h-5" />}
                          type="number"
                          min="1"
                          max="200"
                          value={totalQuestions.toString()}
                          onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 20)}
                          required
                          placeholder="20"
                        />
                      </div>

                      <div>
                        <FloatingInput
                          label="Pass Score (%) *"
                          icon={<Target className="w-5 h-5" />}
                          type="number"
                          min="1"
                          max="100"
                          value={passingScore.toString()}
                          onChange={(e) => setPassingScore(parseInt(e.target.value) || 50)}
                          required
                          placeholder="50"
                        />
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
                    transition={{ delay: 0.8 }}
                    className="flex flex-col sm:flex-row gap-4 pt-6"
                  >
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl disabled:opacity-60 transition-all duration-200 hover:scale-105 flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"
                          />
                          Creating Exam...
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-5 h-5 mr-3" />
                          Create Exam
                        </>
                      )}
                    </button>

                    <MagneticButton
                      onClick={onClose}
                      variant="outline"
                      className="flex-1 h-14 text-lg font-semibold bg-white/80 backdrop-blur-sm border-2 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300 rounded-xl"
                    >
                      <X className="w-5 h-5 mr-3" />
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