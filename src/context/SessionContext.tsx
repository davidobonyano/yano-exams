'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Student, 
  ExamSession, 
  Exam, 
  SessionContext as SessionContextType,
  SessionJoinResponse,
  ClassLevel 
} from '@/types/database-v2'

interface SessionProviderType {
  session: SessionContextType | null
  loading: boolean
  joinSession: (sessionCode: string, studentId: string, fullName: string, classLevel: ClassLevel, schoolName?: string) => Promise<{ error: string | null }>
  leaveSession: () => void
  refreshSession: () => Promise<void>
}

const SessionContext = createContext<SessionProviderType | undefined>(undefined)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionContextType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session in localStorage
    const savedSession = localStorage.getItem('exam_session')
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession)
        setSession(parsedSession)
        // Validate session is still active
        validateSession(parsedSession)
      } catch (error) {
        console.error('Error parsing saved session:', error)
        localStorage.removeItem('exam_session')
      }
    }
    setLoading(false)
  }, [])

  const validateSession = async (sessionData: SessionContextType) => {
    try {
      // Check if session is still active
      const { data: sessionCheck, error } = await supabase
        .from('exam_sessions')
        .select('status, ends_at')
        .eq('id', sessionData.session.id)
        .single()

      if (error || !sessionCheck) {
        throw new Error('Session not found')
      }

      if (sessionCheck.status !== 'active' || new Date(sessionCheck.ends_at) < new Date()) {
        throw new Error('Session has ended')
      }

      // Session is still valid
      setSession(sessionData)
    } catch (error) {
      console.error('Session validation failed:', error)
      leaveSession()
    }
  }

  const joinSession = async (
    sessionCode: string, 
    studentId: string, 
    fullName: string, 
    classLevel: ClassLevel,
    schoolName?: string
  ): Promise<{ error: string | null }> => {
    try {
      setLoading(true)

      // Call the database function to join session
      const { data, error } = await supabase.rpc('join_exam_session', {
        p_session_code: sessionCode,
        p_student_id: studentId,
        p_full_name: fullName,
        p_class_level: classLevel,
        p_school_name: schoolName
      })

      if (error) throw error

      const response = data as SessionJoinResponse

      if (!response.success) {
        return { error: response.error || 'Failed to join session' }
      }

      // Fetch complete session data
      const [studentData, sessionData, examData] = await Promise.all([
        supabase.from('students').select('*').eq('id', response.student_id).single(),
        supabase.from('exam_sessions').select('*').eq('id', response.session_id).single(),
        supabase.from('exams').select('*').eq('id', response.exam_id).single()
      ])

      if (studentData.error || sessionData.error || examData.error) {
        throw new Error('Failed to fetch session data')
      }

      const sessionContext: SessionContextType = {
        student: studentData.data,
        session: sessionData.data,
        exam: examData.data,
        participant_id: response.participant_id!
      }

      setSession(sessionContext)
      localStorage.setItem('exam_session', JSON.stringify(sessionContext))

      return { error: null }
    } catch (error: unknown) {
      console.error('Error joining session:', error)
      return { error: error instanceof Error ? error.message : 'Failed to join session' }
    } finally {
      setLoading(false)
    }
  }

  const leaveSession = () => {
    setSession(null)
    localStorage.removeItem('exam_session')
  }

  const refreshSession = async () => {
    if (!session) return

    try {
      const [sessionData, examData] = await Promise.all([
        supabase.from('exam_sessions').select('*').eq('id', session.session.id).single(),
        supabase.from('exams').select('*').eq('id', session.exam.id).single()
      ])

      if (sessionData.error || examData.error) {
        throw new Error('Failed to refresh session data')
      }

      const updatedSession: SessionContextType = {
        ...session,
        session: sessionData.data,
        exam: examData.data
      }

      setSession(updatedSession)
      localStorage.setItem('exam_session', JSON.stringify(updatedSession))
    } catch (error) {
      console.error('Error refreshing session:', error)
      leaveSession()
    }
  }

  const value = {
    session,
    loading,
    joinSession,
    leaveSession,
    refreshSession
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}