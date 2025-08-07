'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ExamSession } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { 
  X, 
  Users, 
  Award, 
  Clock, 
  TrendingUp, 
  Download,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'

interface SessionResultsProps {
  session: ExamSession
  onClose: () => void
}

interface StudentResult {
  id: string
  student_id: string
  full_name: string
  score: number
  percentage: number
  passed: boolean
  time_taken: number
  submitted_at: string
  cheating_detected: boolean
  cheating_incidents: number
}

export default function SessionResults({ session, onClose }: SessionResultsProps) {
  const [results, setResults] = useState<StudentResult[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalStudents: 0,
    submitted: 0,
    passed: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0
  })

  useEffect(() => {
    fetchSessionResults()
  }, [session.id])

  const fetchSessionResults = async () => {
    try {
      setLoading(true)

      // Fetch student results for this session
      const { data: resultsData, error: resultsError } = await supabase
        .from('student_exam_results')
        .select(`
          *,
          teacher_students!inner(
            student_id,
            full_name
          )
        `)
        .eq('session_id', session.id)
        .order('percentage', { ascending: false })

      if (resultsError) throw resultsError

      const formattedResults = resultsData?.map(result => ({
        id: result.id,
        student_id: result.teacher_students.student_id,
        full_name: result.teacher_students.full_name,
        score: result.points_earned,
        percentage: result.percentage_score,
        passed: result.passed,
        time_taken: result.time_taken_minutes,
        submitted_at: result.created_at,
        cheating_detected: result.cheating_detected || false,
        cheating_incidents: result.cheating_incidents || 0
      })) || []

      setResults(formattedResults)

      // Calculate statistics
      if (formattedResults.length > 0) {
        const scores = formattedResults.map(r => r.percentage)
        setStats({
          totalStudents: formattedResults.length,
          submitted: formattedResults.length,
          passed: formattedResults.filter(r => r.passed).length,
          averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores)
        })
      }

    } catch (error) {
      console.error('Error fetching session results:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportResults = () => {
    const csvContent = [
      ['Student ID', 'Name', 'Score', 'Percentage', 'Status', 'Time Taken (min)', 'Submitted At', 'Cheating Detected'].join(','),
      ...results.map(result => [
        result.student_id,
        result.full_name,
        result.score,
        result.percentage,
        result.passed ? 'Passed' : 'Failed',
        result.time_taken,
        new Date(result.submitted_at).toLocaleString(),
        result.cheating_detected ? 'Yes' : 'No'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.session_name}_results.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-purple-900/30 to-blue-900/30 backdrop-blur-sm" />
        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md w-full max-w-md">
            <CardContent className="p-8 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-gray-600">Loading session results...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
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
          className="fixed inset-0 bg-gradient-to-br from-black/40 via-purple-900/30 to-blue-900/30 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Container */}
        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden"
          >
            <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md">
              {/* Header */}
              <div className="h-2 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" />
              
              <CardHeader className="relative">
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="absolute right-4 top-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
                
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold flex items-center gap-3">
                      <Award className="w-8 h-8 text-emerald-600" />
                      Session Results
                    </CardTitle>
                    <p className="text-muted-foreground mt-1">
                      {session.session_name} - {session.class_level}
                    </p>
                  </div>
                  
                  <MagneticButton
                    onClick={exportResults}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </MagneticButton>
                </div>
              </CardHeader>

              <CardContent className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700">Total Students</p>
                        <p className="text-2xl font-bold text-blue-900">{stats.totalStudents}</p>
                      </div>
                      <Users className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-700">Passed</p>
                        <p className="text-2xl font-bold text-green-900">{stats.passed}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-700">Average Score</p>
                        <p className="text-2xl font-bold text-purple-900">{stats.averageScore}%</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-700">Highest Score</p>
                        <p className="text-2xl font-bold text-orange-900">{stats.highestScore}%</p>
                      </div>
                      <Award className="w-8 h-8 text-orange-600" />
                    </div>
                  </div>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Submitted
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Security
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {results.map((result, index) => (
                          <motion.tr
                            key={result.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {result.full_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {result.student_id}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 font-medium">
                                {result.score}/{session.exam?.total_questions || 'N/A'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {result.percentage}%
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                result.passed 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {result.passed ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Passed
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Failed
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1 text-gray-400" />
                                {result.time_taken} min
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(result.submitted_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {result.cheating_detected ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {result.cheating_incidents} incident{result.cheating_incidents !== 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Clean
                                </span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {results.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <Award className="w-12 h-12 mx-auto" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
                      <p className="text-gray-500">Students haven't completed this exam session yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}