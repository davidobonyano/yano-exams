'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/context/SimpleSessionContext'
import { supabase } from '@/lib/supabase'
import { StudentExamAttempt } from '@/types/database-v2'
import Link from 'next/link'

export default function SessionDashboard() {
  const { session, clearSession } = useSession()
  const [attempt, setAttempt] = useState<StudentExamAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (session) {
      checkExamAttempt()
    }
  }, [session])

  const checkExamAttempt = async () => {
    if (!session) return

    try {
      setLoading(true)
      
      // Check if student has already started this exam
      const { data: attemptData, error: attemptError } = await supabase
        .from('student_exam_attempts')
        .select('*')
        .eq('session_id', session.session.id)
        .eq('student_id', session.student.id)
        .eq('exam_id', session.exam.id)
        .single()

      if (attemptError && attemptError.code !== 'PGRST116') {
        throw attemptError
      }

      setAttempt(attemptData || null)
    } catch (err: any) {
      console.error('Error checking exam attempt:', err)
      setError('Failed to load exam status')
    } finally {
      setLoading(false)
    }
  }

  const startExam = async () => {
    if (!session) return

    try {
      setLoading(true)
      
      // Create new exam attempt
      const { data, error } = await supabase
        .from('student_exam_attempts')
        .insert([{
          session_id: session.session.id,
          student_id: session.student.id,
          exam_id: session.exam.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          time_remaining: session.exam.duration_minutes * 60
        }])
        .select()
        .single()

      if (error) throw error

      setAttempt(data)
    } catch (err: any) {
      console.error('Error starting exam:', err)
      setError(err.message || 'Failed to start exam')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-gray-600">No active session</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const getExamStatus = () => {
    if (!attempt) {
      return { status: 'available', text: 'Not Started', color: 'bg-green-100 text-green-800' }
    }

    switch (attempt.status) {
      case 'in_progress':
        return { status: 'in_progress', text: 'In Progress', color: 'bg-yellow-100 text-yellow-800' }
      case 'completed':
      case 'submitted':
        return { status: 'completed', text: 'Completed', color: 'bg-gray-100 text-gray-800' }
      default:
        return { status: 'available', text: 'Not Started', color: 'bg-green-100 text-green-800' }
    }
  }

  const canTakeExam = () => {
    if (!attempt) return true
    return attempt.status === 'in_progress'
  }

  const examStatus = getExamStatus()
  const canTake = canTakeExam()

  // Check if session is still active
  const sessionEnded = new Date(session.session.ends_at) < new Date()
  const sessionActive = session.session.status === 'active' && !sessionEnded

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">YANO Exam Platform</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                <span className="font-medium">{session.student.full_name}</span>
                <span className="ml-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                  {session.student.class_level}
                </span>
              </div>
              <button
                onClick={clearSession}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Leave Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Session Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Session Information</h2>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                sessionActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {sessionActive ? 'Active' : 'Ended'}
              </span>
              <span className="text-sm text-gray-500">
                Code: <span className="font-mono font-semibold">{session.session.session_code}</span>
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Session:</span>
              <span className="ml-2 text-gray-600">{session.session.session_name}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Student ID:</span>
              <span className="ml-2 text-gray-600">{session.student.student_id}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Starts:</span>
              <span className="ml-2 text-gray-600">
                {new Date(session.session.starts_at).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Ends:</span>
              <span className="ml-2 text-gray-600">
                {new Date(session.session.ends_at).toLocaleString()}
              </span>
            </div>
          </div>

          {session.session.instructions && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <h4 className="text-sm font-medium text-blue-800">Instructions:</h4>
              <p className="mt-1 text-sm text-blue-700">{session.session.instructions}</p>
            </div>
          )}
        </div>

        {/* Exam Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">{session.exam.title}</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${examStatus.color}`}>
              {examStatus.text}
            </span>
          </div>
          
          {session.exam.description && (
            <p className="mb-4 text-sm text-gray-600">{session.exam.description}</p>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 mb-6">
            <div>
              <span className="font-medium">Duration:</span> {session.exam.duration_minutes} mins
            </div>
            <div>
              <span className="font-medium">Questions:</span> {session.exam.total_questions}
            </div>
            <div>
              <span className="font-medium">Passing Score:</span> {session.exam.passing_score}%
            </div>
            <div>
              <span className="font-medium">Class:</span> {session.exam.class_level}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {!sessionActive ? (
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="text-sm text-yellow-800">
                This session has ended. You can no longer take the exam.
              </div>
            </div>
          ) : canTake ? (
            <div className="space-y-3">
              {!attempt ? (
                <button
                  onClick={startExam}
                  disabled={loading}
                  className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Starting...' : 'Start Exam'}
                </button>
              ) : (
                <Link
                  href={`/exam/${session.exam.id}?session=${session.session.id}`}
                  className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Continue Exam
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <button
                disabled
                className="w-full inline-flex justify-center items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-500 bg-gray-100 cursor-not-allowed"
              >
                Exam Completed
              </button>
              {attempt && (
                <Link
                  href={`/results/${attempt.id}`}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  View Results
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}