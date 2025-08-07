'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/context/SimpleSessionContext'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const { session, clearSession } = useSession()
  const [attempts, setAttempts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) {
      // No session, redirect to login
      router.push('/')
      return
    }
    
    loadCompletedAttempts()
  }, [session, router])

  const loadCompletedAttempts = async () => {
    if (!session) return

    try {
      const { data, error } = await supabase
        .from('student_exam_attempts')
        .select(`
          *,
          exam_results (
            total_questions,
            correct_answers,
            percentage_score,
            passed
          )
        `)
        .eq('student_id', session.student.id)
        .eq('session_id', session.session.id)
        .in('status', ['completed', 'submitted'])
        .order('completed_at', { ascending: false })

      if (error) throw error

      setAttempts(data || [])
    } catch (error) {
      console.error('Error loading completed attempts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartNewSession = () => {
    clearSession()
    router.push('/')
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p>Redirecting to login...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mb-4"></div>
          <p className="text-lg font-medium text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  const latestAttempt = attempts[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Exam Completed!</h1>
          <p className="text-lg text-gray-600">Congratulations, {session.student.full_name}</p>
        </div>

        {/* Exam Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Exam Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Session Information</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">Session Code:</span> {session.session.session_code}</p>
                <p><span className="font-medium">Student ID:</span> {session.student.student_id}</p>
                <p><span className="font-medium">Class:</span> {session.student.class_level}</p>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Exam Details</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium">Exam:</span> {session.exam.title}</p>
                <p><span className="font-medium">Duration:</span> {session.exam.duration_minutes} minutes</p>
                {latestAttempt && (
                  <p><span className="font-medium">Completed:</span> {new Date(latestAttempt.completed_at).toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {latestAttempt?.exam_results?.[0] && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {latestAttempt.exam_results[0].percentage_score.toFixed(1)}%
                </div>
                <div className="text-sm text-blue-600 font-medium">Overall Score</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {latestAttempt.exam_results[0].correct_answers}
                </div>
                <div className="text-sm text-green-600 font-medium">Correct Answers</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {latestAttempt.exam_results[0].total_questions}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Questions</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {latestAttempt.exam_results[0].passed ? 'PASS' : 'FAIL'}
                </div>
                <div className="text-sm text-purple-600 font-medium">Result</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">What's Next?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                if (latestAttempt) {
                  router.push(`/results/${latestAttempt.id}`)
                }
              }}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Detailed Results
            </button>
            <button
              onClick={handleStartNewSession}
              className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Join Another Session
            </button>
            <button
              onClick={() => {
                clearSession()
                router.push('/')
              }}
              className="w-full flex items-center justify-center px-6 py-3 border border-red-300 text-base font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Exit Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}