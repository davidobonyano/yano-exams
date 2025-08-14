'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Exam, UserExamAttempt } from '@/types/database'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { TextReveal, GradientText } from '@/components/ui/text-effects'
import { Clock, FileText, Target, GraduationCap, Play, Eye, Trophy } from 'lucide-react'
import Link from 'next/link'

interface ExamWithAttempt extends Exam {
  attempt?: UserExamAttempt
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [exams, setExams] = useState<ExamWithAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      fetchExams()
    }
  }, [profile])

  const fetchExams = async () => {
    if (!profile) return

    try {
      setLoading(true)
      
      // Fetch exams for the user's class level
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('class_level', profile.class_level)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (examsError) throw examsError

      // Fetch user's exam attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('user_exam_attempts')
        .select('*')
        .eq('user_id', profile.id)

      if (attemptsError) throw attemptsError

      // Combine exams with attempt data
      const examsWithAttempts: ExamWithAttempt[] = examsData.map(exam => ({
        ...exam,
        attempt: attemptsData.find(attempt => attempt.exam_id === exam.id)
      }))

      setExams(examsWithAttempts)
    } catch (err) {
      console.error('Error fetching exams:', err)
      setError('Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  const getExamStatus = (exam: ExamWithAttempt) => {
    if (!exam.attempt) {
      return { status: 'available', text: 'Not Started', color: 'bg-green-100 text-green-800' }
    }

    switch (exam.attempt.status) {
      case 'in_progress':
        return { status: 'in_progress', text: 'In Progress', color: 'bg-yellow-100 text-yellow-800' }
      case 'completed':
      case 'submitted':
        return { status: 'completed', text: 'Completed', color: 'bg-gray-100 text-gray-800' }
      default:
        return { status: 'available', text: 'Not Started', color: 'bg-green-100 text-green-800' }
    }
  }

  const canTakeExam = (exam: ExamWithAttempt) => {
    return !exam.attempt || exam.attempt.status === 'in_progress'
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <AnimatedBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="mx-auto w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mb-4"
            />
            <p className="text-xl text-gray-600">Loading your exams...</p>
          </motion.div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8 text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
            className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full flex items-center justify-center mb-6 shadow-2xl"
          >
            <Trophy className="w-8 h-8 text-white" />
          </motion.div>
          
          <TextReveal
            text="Available Exams"
            className="text-4xl md:text-5xl font-bold mb-4"
            delay={0.4}
          />
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Welcome, <GradientText text={profile?.full_name || ''} gradient="from-blue-600 to-purple-600" />! 
            Here are the exams available for {profile?.class_level}.
          </motion.p>
        </motion.div>

        {exams.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="text-center py-12"
          >
            <div className="text-gray-500">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1, type: "spring", stiffness: 200 }}
              >
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
              </motion.div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No exams available</h3>
              <p className="mt-1 text-sm text-gray-500">There are currently no active exams for your class level.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {exams.map((exam, index) => {
              const examStatus = getExamStatus(exam)
              const canTake = canTakeExam(exam)

              return (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 1 + index * 0.1, duration: 0.6 }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden shadow-xl rounded-2xl group hover:shadow-2xl transition-shadow duration-300"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{exam.title}</h3>
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1.2 + index * 0.1 }}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${examStatus.color}`}
                      >
                        {examStatus.text}
                      </motion.span>
                    </div>
                    
                    {exam.description && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.3 + index * 0.1 }}
                        className="text-sm text-gray-600 line-clamp-2 mb-4"
                      >
                        {exam.description}
                      </motion.p>
                    )}
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.4 + index * 0.1 }}
                      className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-6"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">{exam.duration_minutes} mins</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-500" />
                        <span className="font-medium">{exam.total_questions} questions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-green-500" />
                        <span className="font-medium">{exam.passing_score}% pass</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-cyan-500" />
                        <span className="font-medium">{exam.class_level}</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.5 + index * 0.1 }}
                    >
                      {canTake ? (
                        <Link
                          href={`/exam/${exam.id}`}
                          className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-colors duration-200"
                        >
                          <Play className="w-4 h-4" />
                          {exam.attempt?.status === 'in_progress' ? 'Continue Exam' : 'Start Exam'}
                        </Link>
                      ) : (
                        <div className="w-full space-y-2">
                          <button
                            disabled
                            className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl text-gray-500 bg-gray-100 cursor-not-allowed"
                          >
                            <Trophy className="w-4 h-4" />
                            Exam Completed
                          </button>
                          {exam.attempt && (
                            <Link
                              href={`/results/${exam.attempt.id}`}
                              className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                            >
                              <Eye className="w-4 h-4" />
                              View Results
                            </Link>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </div>
  )
}