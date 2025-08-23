'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getDetailedStudentResults, getSessionDetailedResults, DetailedStudentResult, SessionDetailedResults } from '@/lib/auto-scoring'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Download, 
  Users, 
  CheckCircle, 
  XCircle, 
  Search,
  Send,
  Lock,
  Unlock
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface ExamResult {
  id: string
  attempt_id: string
  student_id: string
  session_id: string
  exam_id: string
  total_questions: number
  correct_answers: number
  total_points: number
  points_earned: number
  percentage_score: number
  passed: boolean
  results_visible_to_student: boolean
  created_at: string
  students: {
    full_name: string
    student_id: string
    email?: string | null
  }
  exam_sessions: {
    session_code: string
    session_name: string
    show_results_after_submit: boolean
  }
  exams: {
    title: string
  }
}

interface TeacherResultsManagerProps {
  teacherId: string
}

export default function TeacherResultsManager({ teacherId }: TeacherResultsManagerProps) {
  const [results, setResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSession, setSelectedSession] = useState<string>('')
  const [sessions, setSessions] = useState<Array<{ id: string; session_code: string; session_name: string }>>([])
  const [emailAddresses, setEmailAddresses] = useState<{[key: string]: string}>({})
  const [emailingResults, setEmailingResults] = useState<Set<string>>(new Set())
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<DetailedStudentResult | null>(null)
  const [showStudentDetails, setShowStudentDetails] = useState(false)


  useEffect(() => {
    if (teacherId) {
      loadResults()
      loadSessions()
    }
  }, [teacherId])

  const loadSessions = async () => {
    if (!teacherId) {
      console.warn('No teacher ID provided for loading sessions')
      return
    }

    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, session_code, session_name')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const loadResults = async () => {
    if (!teacherId) {
      console.warn('No teacher ID provided for loading results')
      return
    }

    try {
      setLoading(true)
      // First get the results
      const { data, error } = await supabase
        .from('exam_results')
        .select(`
          *,
          students!inner (
            full_name,
            student_id
          ),
          exam_sessions!inner (
            session_code,
            session_name,
            teacher_id,
            show_results_after_submit
          ),
          exams (
            title
          )
        `)
        .eq('exam_sessions.teacher_id', teacherId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Now get email data from teacher_students table
      const studentIds = data?.map(result => result.students.student_id) || []
      console.log('Student IDs found:', studentIds)
      
      const { data: teacherStudentsData, error: emailError } = await supabase
        .from('teacher_students')
        .select('student_id, email')
        .eq('teacher_id', teacherId)
        .in('student_id', studentIds)

      console.log('Teacher students email data:', teacherStudentsData)
      console.log('Email query error:', emailError)

      // Create email lookup map
      const emailMap = new Map()
      teacherStudentsData?.forEach(ts => {
        if (ts.email) {
          console.log(`Setting email for ${ts.student_id}:`, ts.email)
        }
        emailMap.set(ts.student_id, {
          email: ts.email
        })
      })

      // Merge email data into results
      const resultsWithEmails = data?.map(result => {
        const emailData = emailMap.get(result.students.student_id)
        const mergedResult = {
          ...result,
          students: {
            ...result.students,
            ...emailData
          }
        }
        console.log(`Student ${result.students.student_id} final result:`, mergedResult.students)
        return mergedResult
      }) || []

      setResults(resultsWithEmails)
    } catch (error) {
      console.error('Error loading results:', error)
      toast.error('Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const sendAllEmailsForSession = async (sessionId: string) => {
    const sessionResults = results.filter(result => result.session_id === sessionId)
    const resultsWithEmails = sessionResults.filter(result => 
      result.students.email || emailAddresses[result.id]?.trim()
    )

    if (resultsWithEmails.length === 0) {
      toast.error('No email addresses found for this session')
      return
    }

    setEmailingResults(prev => new Set(prev).add(sessionId))

    try {
      let successCount = 0
      let failCount = 0

      for (const result of resultsWithEmails) {
        const emailToSend = emailAddresses[result.id]?.trim() || result.students.email
        
        if (emailToSend) {
          try {
            const response = await fetch('/api/admin/send-result-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resultId: result.id,
                email: emailToSend,
                studentName: result.students.full_name
              }),
            })

            if (response.ok) {
              successCount++
            } else {
              failCount++
            }
          } catch {
            failCount++
          }
        }
      }

      toast.success(`Emails sent: ${successCount} successful, ${failCount} failed`)
      
      // Clear email inputs after bulk send
      setEmailAddresses(prev => {
        const newState = { ...prev }
        resultsWithEmails.forEach(result => {
          newState[result.id] = ''
        })
        return newState
      })

    } catch (error) {
      console.error('Error sending bulk emails:', error)
      toast.error('Failed to send bulk emails')
    } finally {
      setEmailingResults(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionId)
        return newSet
      })
    }
  }

  const sendResultByEmail = async (resultId: string, studentName: string, email: string) => {
    if (!email.trim()) {
      toast.error('Please enter an email address')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    setEmailingResults(prev => new Set(prev).add(resultId))
    
    try {
      // Send actual email using API endpoint
      const response = await fetch('/api/admin/send-result-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resultId,
          email,
          studentName
        }),
      })

      const emailResult = await response.json()
      
      if (!response.ok) {
        throw new Error(emailResult.error || 'Failed to send email')
      }

      toast.success(`Results sent to ${email}`)
      setEmailAddresses(prev => ({
        ...prev,
        [resultId]: ''
      }))
    } catch (error) {
      console.error('Error sending email:', error)
      toast.error('Failed to send email')
    } finally {
      setEmailingResults(prev => {
        const newSet = new Set(prev)
        newSet.delete(resultId)
        return newSet
      })
    }
  }

  const viewStudentDetails = async (attemptId: string) => {
    try {
      const details = await getDetailedStudentResults(attemptId)
      if (details) {
        setSelectedStudentDetails(details)
        setShowStudentDetails(true)
      } else {
        toast.error('Failed to load student details')
      }
    } catch (error) {
      console.error('Error loading student details:', error)
      toast.error('Failed to load student details')
    }
  }



  const filteredResults = results.filter(result => {
    const matchesSearch = result.students.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.students.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.exams.title.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesSession = !selectedSession || result.session_id === selectedSession

    return matchesSearch && matchesSession
  })

  const groupedResults = filteredResults.reduce((acc, result) => {
    const sessionKey = `${result.session_id}-${result.exam_sessions.session_code}`
    if (!acc[sessionKey]) {
      acc[sessionKey] = {
        session: result.exam_sessions,
        exam: result.exams,
        results: [],
        sessionId: result.session_id
      }
    }
    acc[sessionKey].results.push(result)
    return acc
  }, {} as Record<string, { session: unknown; exam: unknown; results: ExamResult[]; sessionId: string }>)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search students, IDs, or exams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <select
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
          className="px-3 py-2 border rounded-lg bg-white"
        >
          <option value="">All Sessions</option>
          {sessions.map(session => (
            <option key={session.id} value={session.id}>
              {session.session_code} - {session.session_name}
            </option>
          ))}
        </select>
      </div>

      <AnimatePresence>
        {Object.entries(groupedResults).map(([sessionKey, group]) => (
          <motion.div
            key={sessionKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>{(group.session as { session_name: string }).session_name}</span>
                      <Badge variant="outline">{(group.session as { session_code: string }).session_code}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(group.exam as { title: string }).title} • {group.results.length} student(s)
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={group.results[0]?.exam_sessions.show_results_after_submit ? "default" : "secondary"}
                      className="flex items-center space-x-1"
                    >
                      {group.results[0]?.exam_sessions.show_results_after_submit ? (
                        <><Unlock className="w-3 h-3" /> Visible to Students</>
                      ) : (
                        <><Lock className="w-3 h-3" /> Hidden from Students</>
                      )}
                    </Badge>
                    
                    <Button
                      onClick={() => sendAllEmailsForSession(group.sessionId)}
                      variant="default"
                      size="sm"
                      disabled={emailingResults.has(group.sessionId)}
                    >
                      {emailingResults.has(group.sessionId) ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Sending...</>
                      ) : (
                        <><Send className="w-4 h-4 mr-2" /> Send All Emails</>
                      )}
                    </Button>

                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-500">Student</th>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-500">Score</th>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-500">Status</th>
                        <th className="text-left py-3 px-6 text-sm font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.results.map((result: ExamResult, index: number) => (
                        <motion.tr
                          key={result.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="py-4 px-6">
                            <div>
                              <div className="font-medium">{result.students.full_name}</div>
                              <div className="text-sm text-muted-foreground">
                                ID: {result.students.student_id}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg font-bold">
                                {result.percentage_score.toFixed(1)}%
                              </span>
                              <div className="text-sm text-muted-foreground">
                                {result.correct_answers}/{result.total_questions}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <Badge 
                              variant={result.passed ? "default" : "destructive"}
                              className="flex items-center space-x-1 w-fit"
                            >
                              {result.passed ? (
                                <><CheckCircle className="w-3 h-3" /> Passed</>
                              ) : (
                                <><XCircle className="w-3 h-3" /> Failed</>
                              )}
                            </Badge>
                          </td>
                          <td className="py-4 px-6">
                          <div className="flex items-center space-x-2">
                          <Link href={`/admin/results/${result.attempt_id}`}>
                            <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            >
                            <Eye className="w-3 h-3 mr-1" /> View Details
                            </Button>
                          </Link>

                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-2">
                            <Input
                            type="email"
                            placeholder="Enter email address"
                            value={emailAddresses[result.id] || ''}
                            onChange={(e) => setEmailAddresses(prev => ({
                              ...prev,
                                [result.id]: e.target.value
                              }))}
                            className="w-48 h-8 text-sm"
                            />
                            <Button
                            onClick={() => sendResultByEmail(result.id, result.students.full_name, emailAddresses[result.id] || '')}
                              disabled={emailingResults.has(result.id) || !emailAddresses[result.id]?.trim()}
                            size="sm"
                            className="h-8"
                            >
                            {emailingResults.has(result.id) ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                  <><Send className="w-3 h-3 mr-1" /> Send</>
                                )}
                              </Button>
                            </div>
                            {/* Quick email options */}
                            <div className="flex space-x-1">
                              {result.students.email && (
                                <Button
                                  onClick={() => setEmailAddresses(prev => ({
                                    ...prev,
                                    [result.id]: result.students.email!
                                  }))}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                >
                                  Use: {result.students.email}
                                </Button>
                              )}
                            </div>
                          </div>
                             </div>
                           </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {filteredResults.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Results Found</h3>
            <p className="text-muted-foreground">
              {results.length === 0 
                ? "No exam results available yet. Students need to complete their exams first."
                : "No results match your current filters. Try adjusting your search."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Student Details Modal */}
      <AnimatePresence>
        {showStudentDetails && selectedStudentDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
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
                  <p className="text-sm text-muted-foreground">
                    {selectedStudentDetails.attempt_info.exam_title} • {selectedStudentDetails.attempt_info.session_name}
                  </p>
                </div>
                <Button
                  onClick={() => setShowStudentDetails(false)}
                  variant="outline"
                  size="sm"
                >
                  Close
                </Button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="p-6 space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedStudentDetails.attempt_info.percentage_score.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Final Score</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedStudentDetails.attempt_info.correct_answers}
                        </div>
                        <div className="text-sm text-muted-foreground">Correct</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {selectedStudentDetails.attempt_info.total_questions - selectedStudentDetails.attempt_info.correct_answers}
                        </div>
                        <div className="text-sm text-muted-foreground">Incorrect</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold">
                          {selectedStudentDetails.attempt_info.points_earned}/{selectedStudentDetails.attempt_info.total_points}
                        </div>
                        <div className="text-sm text-muted-foreground">Points</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Questions */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Question-by-Question Breakdown</h3>
                    {selectedStudentDetails.detailed_answers.map((answer, index) => (
                      <Card key={answer.question_id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-medium">Question {answer.question_number}</h4>
                            <div className="flex items-center space-x-2">
                              <Badge variant={answer.is_correct ? "default" : "destructive"}>
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
                              </Badge>
                              <span className="text-sm text-muted-foreground">
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
                                <span className="text-muted-foreground">{answer.explanation}</span>
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
    </div>
  )
}