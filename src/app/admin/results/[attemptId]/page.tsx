'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { DetailedStudentResult } from '@/lib/auto-scoring'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Award,
  User as UserIcon
} from 'lucide-react'

export default function StudentResultsPage() {
  const params = useParams()
  const router = useRouter()
  const attemptId = params.attemptId as string
  
  const [loading, setLoading] = useState(true)
  const [studentDetails, setStudentDetails] = useState<DetailedStudentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStudentDetails = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_detailed_student_results', {
        p_attempt_id: attemptId
      })
      
      if (rpcError) {
        setError('Failed to load student details')
        console.error('RPC Error:', rpcError)
        return
      }
      
      if (rpcData && rpcData.success) {
        setStudentDetails(rpcData)
      } else {
        setError('No results found for this attempt')
      }
    } catch (error) {
      console.error('Error loading student details:', error)
      setError('An error occurred while loading student details')
    } finally {
      setLoading(false)
    }
  }, [attemptId])

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/admin')
        return
      }
      loadStudentDetails()
    })
  }, [attemptId, router, loadStudentDetails])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !studentDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Results</h1>
            <p className="text-gray-600 mb-6">{error || 'Student details not found'}</p>
            <Link href="/admin/results">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Results
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {studentDetails.attempt_info.student_name} - Detailed Results
                </h1>
                <p className="text-muted-foreground">
                  {studentDetails.attempt_info.exam_title} • {studentDetails.attempt_info.session_name}
                </p>
              </div>
            </div>
            
            <Link href="/admin/results">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Results
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {studentDetails.attempt_info.percentage_score.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500 flex items-center justify-center">
                <Award className="w-4 h-4 mr-1" />
                Final Score
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {studentDetails.attempt_info.correct_answers}
              </div>
              <div className="text-sm text-gray-500 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                Correct Answers
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {studentDetails.attempt_info.total_questions - studentDetails.attempt_info.correct_answers}
              </div>
              <div className="text-sm text-gray-500 flex items-center justify-center">
                <XCircle className="w-4 h-4 mr-1" />
                Incorrect Answers
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {studentDetails.attempt_info.points_earned}/{studentDetails.attempt_info.total_points}
              </div>
              <div className="text-sm text-gray-500 flex items-center justify-center">
                <Award className="w-4 h-4 mr-1" />
                Points Earned
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Questions Breakdown */}
        <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Question-by-Question Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {studentDetails.detailed_answers.map((answer, index) => (
                <Card key={`question-${answer.question_id}-${index}`} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-lg">Question {answer.question_number}</h4>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          answer.is_correct 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {answer.is_correct ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Correct
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Incorrect
                            </>
                          )}
                        </span>
                        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {answer.points_earned}/{answer.question_points} pts
                        </span>
                      </div>
                    </div>

                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-800">{answer.question_text}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <span className="font-medium text-gray-700 min-w-fit">Student Answer:</span>
                        <span className={`font-medium ${answer.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                          {answer.student_answer_text}
                        </span>
                      </div>

                      {!answer.is_correct && (
                        <div className="flex items-start space-x-3">
                          <span className="font-medium text-gray-700 min-w-fit">Correct Answer:</span>
                          <span className="font-medium text-green-600">{answer.correct_answer_text}</span>
                        </div>
                      )}

                      {answer.explanation && (
                        <div className="flex items-start space-x-3">
                          <span className="font-medium text-gray-700 min-w-fit">Explanation:</span>
                          <span className="text-gray-600">{answer.explanation}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
