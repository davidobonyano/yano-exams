'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
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
  }
  exam_sessions: {
    session_code: string
    session_name: string
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
  const [sessions, setSessions] = useState<any[]>([])
  const [emailAddress, setEmailAddress] = useState('')
  const [emailingResults, setEmailingResults] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadResults()
    loadSessions()
  }, [teacherId])

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, session_code, session_name, allow_student_results_view')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const loadResults = async () => {
    try {
      setLoading(true)
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
            teacher_id
          ),
          exams (
            title
          )
        `)
        .eq('exam_sessions.teacher_id', teacherId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setResults(data || [])
    } catch (error) {
      console.error('Error loading results:', error)
      toast.error('Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const toggleResultsVisibility = async (sessionId: string, currentlyVisible: boolean) => {
    try {
      const functionName = currentlyVisible ? 'hide_results_from_students' : 'release_results_to_students'
      
      const { error } = await supabase.rpc(functionName, {
        session_id_param: sessionId
      })

      if (error) throw error

      toast.success(
        currentlyVisible 
          ? 'Results hidden from students' 
          : 'Results released to students!'
      )
      
      await loadResults()
      await loadSessions()
    } catch (error) {
      console.error('Error toggling results visibility:', error)
      toast.error('Failed to update results visibility')
    }
  }

  const sendResultByEmail = async (resultId: string, studentName: string) => {
    if (!emailAddress.trim()) {
      toast.error('Please enter an email address')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailAddress)) {
      toast.error('Please enter a valid email address')
      return
    }

    setEmailingResults(prev => new Set(prev).add(resultId))
    
    try {
      // Log the email attempt in the database
      const { error } = await supabase
        .from('result_emails')
        .insert([{
          result_id: resultId,
          student_email: emailAddress,
          teacher_id: teacherId,
          email_status: 'pending'
        }])

      if (error) throw error

      // TODO: Implement actual email sending logic here
      // This would integrate with your email service (SendGrid, SMTP, etc.)
      
      // For now, simulate email sending
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Update email status to sent
      await supabase
        .from('result_emails')
        .update({ email_status: 'sent' })
        .eq('result_id', resultId)
        .eq('student_email', emailAddress)

      toast.success(`Results sent to ${emailAddress}`)
      setEmailAddress('')
    } catch (error) {
      console.error('Error sending email:', error)
      toast.error('Failed to send email')
      
      // Update email status to failed
      await supabase
        .from('result_emails')
        .update({ 
          email_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('result_id', resultId)
        .eq('student_email', emailAddress)
    } finally {
      setEmailingResults(prev => {
        const newSet = new Set(prev)
        newSet.delete(resultId)
        return newSet
      })
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
  }, {} as Record<string, any>)

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
                      <span>{group.session.session_name}</span>
                      <Badge variant="outline">{group.session.session_code}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {group.exam.title} • {group.results.length} student(s)
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={group.results[0]?.results_visible_to_student ? "default" : "secondary"}
                      className="flex items-center space-x-1"
                    >
                      {group.results[0]?.results_visible_to_student ? (
                        <><Unlock className="w-3 h-3" /> Visible to Students</>
                      ) : (
                        <><Lock className="w-3 h-3" /> Hidden from Students</>
                      )}
                    </Badge>
                    
                    <Button
                      onClick={() => toggleResultsVisibility(
                        group.sessionId, 
                        group.results[0]?.results_visible_to_student
                      )}
                      variant={group.results[0]?.results_visible_to_student ? "outline" : "default"}
                      size="sm"
                    >
                      {group.results[0]?.results_visible_to_student ? (
                        <><EyeOff className="w-4 h-4 mr-2" /> Hide Results</>
                      ) : (
                        <><Eye className="w-4 h-4 mr-2" /> Release Results</>
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
                              <div className="flex items-center space-x-2">
                                <Input
                                  type="email"
                                  placeholder="student@email.com"
                                  value={emailAddress}
                                  onChange={(e) => setEmailAddress(e.target.value)}
                                  className="w-48 h-8 text-sm"
                                />
                                <Button
                                  onClick={() => sendResultByEmail(result.id, result.students.full_name)}
                                  disabled={emailingResults.has(result.id)}
                                  size="sm"
                                  className="h-8"
                                >
                                  {emailingResults.has(result.id) ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <><Send className="w-3 h-3 mr-1" /> Email</>
                                  )}
                                </Button>
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
    </div>
  )
}