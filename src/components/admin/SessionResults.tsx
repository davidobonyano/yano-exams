'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ExamSession } from '@/types/database-v2'
import { getDetailedStudentResults, DetailedStudentResult } from '@/lib/auto-scoring'
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
  total_questions: number
  percentage: number
  passed: boolean
  time_taken: number
  submitted_at: string
  cheating_detected: boolean
  cheating_incidents: number
  attempt_id: string
}

export default function SessionResults({ session, onClose }: SessionResultsProps) {
  const [results, setResults] = useState<StudentResult[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<DetailedStudentResult | null>(null)
  const [showStudentDetails, setShowStudentDetails] = useState(false)
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
    
    // Set up auto-refresh every 10 seconds for real-time updates
    const refreshInterval = setInterval(() => fetchSessionResults(true), 10000)
    
    return () => clearInterval(refreshInterval)
  }, [session.id])

  const fetchSessionResults = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // Fetch exam results for this session with student and exam details
      console.log('Fetching results for session:', session.id)
      const { data: resultsData, error: resultsError } = await supabase
        .from('exam_results')
        .select(`
          *,
          students!inner(
            id,
            student_id,
            full_name
          ),
          exams!inner(
            total_questions
          ),
          student_exam_attempts!inner(
            completed_at,
            started_at,
            id
          )
        `)
        .eq('session_id', session.id)
        .order('percentage_score', { ascending: false })
      
      console.log('Results query response:', { resultsData, resultsError })

      if (resultsError) throw resultsError

      // Fetch cheating logs for all attempts in this session
      const { data: cheatingData, error: cheatingError } = await supabase
        .from('cheating_logs')
        .select('attempt_id, student_id')
        .eq('session_id', session.id)

      if (cheatingError) {
        console.error('Error fetching cheating logs:', cheatingError)
      }

      // Group cheating incidents by attempt_id
      const cheatingMap = new Map()
      cheatingData?.forEach(log => {
        const count = cheatingMap.get(log.attempt_id) || 0
        cheatingMap.set(log.attempt_id, count + 1)
      })

      const formattedResults = resultsData?.map((result, index) => {
        // Debug logging
        if (!result.id || !result.student_exam_attempts.id) {
          console.warn('Result with missing ID:', {
            resultId: result.id,
            attemptId: result.student_exam_attempts.id,
            studentName: result.students?.full_name,
            index
          })
        }

        // Calculate time taken in minutes
        const timeTaken = result.student_exam_attempts.completed_at && result.student_exam_attempts.started_at
          ? Math.round((new Date(result.student_exam_attempts.completed_at).getTime() - 
                      new Date(result.student_exam_attempts.started_at).getTime()) / (1000 * 60))
          : 0;

        const attemptId = result.student_exam_attempts.id
        const cheatingIncidents = cheatingMap.get(attemptId) || 0

        return {
          id: result.id || `fallback-${result.student_id || Math.random()}`,
          student_id: result.students.student_id,
          full_name: result.students.full_name,
          score: result.correct_answers, // Show correct answers
          total_questions: result.exams.total_questions, // Use exam's total questions (same for all students)
          percentage: Math.round(result.percentage_score), // Round percentage for display
          passed: result.passed,
          time_taken: timeTaken,
          submitted_at: result.created_at,
          cheating_detected: cheatingIncidents > 0,
          cheating_incidents: cheatingIncidents,
          attempt_id: attemptId || `fallback-attempt-${Math.random()}`
        }
      }) || []

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
      setRefreshing(false)
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

  const viewStudentDetails = async (attemptId: string) => {
    try {
      console.log('Attempting to get details for attempt ID:', attemptId)
      
      // Test direct RPC call first
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_detailed_student_results', {
        p_attempt_id: attemptId
      })
      
      console.log('Direct RPC call result:', { rpcData, rpcError })
      
      if (rpcError) {
        console.error('RPC Error:', rpcError)
        return
      }
      
      if (rpcData && rpcData.success) {
        setSelectedStudentDetails(rpcData)
        setShowStudentDetails(true)
      } else {
        console.error('RPC returned unsuccessful result:', rpcData)
      }
    } catch (error) {
      console.error('Error loading student details:', error)
    }
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
        key="session-results-modal"
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
                {/* Close Button - Top Right */}
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Title Section */}
                <div className="pr-16 mb-4">
                  <CardTitle className="text-2xl font-bold flex items-center gap-3">
                    <Award className="w-8 h-8 text-emerald-600" />
                    Session Results
                    {refreshing && (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </CardTitle>
                  <p className="text-muted-foreground mt-1">
                    {session.session_name} - {session.class_level}
                    {refreshing && (
                      <span className="ml-2 text-xs text-blue-600">• Live updates</span>
                    )}
                  </p>
                </div>
                
                {/* Export Button - Below Title */}
                <div className="flex justify-end">
                  <MagneticButton
                    onClick={exportResults}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center"
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                             Details
                           </th>
                         </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {results.map((result, index) => (
                        <motion.tr
                        key={result.attempt_id || result.student_id || `result-${index}`}
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
                                {result.score}/{result.total_questions}
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
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <MagneticButton
                                  onClick={() => viewStudentDetails(result.attempt_id)}
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-4 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </MagneticButton>
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
                      <p className="text-gray-500">Students haven&apos;t completed this exam session yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      {/* Student Details Modal */}
      <AnimatePresence>
        {showStudentDetails && selectedStudentDetails && (
          <motion.div
            key="student-details-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowStudentDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedStudentDetails.attempt_info.student_name} - Detailed Results
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedStudentDetails.attempt_info.exam_title} • {selectedStudentDetails.attempt_info.session_name}
                  </p>
                </div>
                <MagneticButton
                  onClick={() => setShowStudentDetails(false)}
                  variant="outline"
                  size="sm"
                  className="flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </MagneticButton>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="p-6 space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                  <Card key="summary-score">
                  <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                  {selectedStudentDetails.attempt_info.percentage_score.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Final Score</div>
                  </CardContent>
                  </Card>
                  <Card key="summary-correct">
                  <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                  {selectedStudentDetails.attempt_info.correct_answers}
                  </div>
                  <div className="text-sm text-gray-500">Correct</div>
                  </CardContent>
                  </Card>
                  <Card key="summary-incorrect">
                  <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                  {selectedStudentDetails.attempt_info.total_questions - selectedStudentDetails.attempt_info.correct_answers}
                  </div>
                  <div className="text-sm text-gray-500">Incorrect</div>
                  </CardContent>
                  </Card>
                  <Card key="summary-points">
                  <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">
                  {selectedStudentDetails.attempt_info.points_earned}/{selectedStudentDetails.attempt_info.total_points}
                  </div>
                  <div className="text-sm text-gray-500">Points</div>
                  </CardContent>
                  </Card>
                  </div>

                  {/* Questions */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Question-by-Question Breakdown</h3>
                    {selectedStudentDetails.detailed_answers.map((answer, index) => (
                    <Card key={`${selectedStudentDetails.attempt_info.attempt_id}-question-${answer.question_id}-${index}`} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-medium">Question {answer.question_number}</h4>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                answer.is_correct 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {answer.is_correct ? (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Correct
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Incorrect
                                  </>
                                )}
                              </span>
                              <span className="text-sm text-gray-500">
                                {answer.points_earned}/{answer.question_points} pts
                              </span>
                            </div>
                          </div>

                          <p className="text-sm mb-4 p-3 bg-gray-50 rounded">
                            {answer.question_text}
                          </p>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-start space-x-2">
                              <span className="font-medium min-w-fit">Student Answer:</span>
                              <span className={answer.is_correct ? 'text-green-600' : 'text-red-600'}>
                                {answer.student_answer_text}
                              </span>
                            </div>

                            {!answer.is_correct && (
                              <div className="flex items-start space-x-2">
                                <span className="font-medium min-w-fit">Correct Answer:</span>
                                <span className="text-green-600">{answer.correct_answer_text}</span>
                              </div>
                            )}

                            {answer.explanation && (
                              <div className="flex items-start space-x-2">
                                <span className="font-medium min-w-fit">Explanation:</span>
                                <span className="text-gray-600">{answer.explanation}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}