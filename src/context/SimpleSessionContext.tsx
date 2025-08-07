'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SessionData {
  student_name: string
  student_class_level?: string
  session_id: string
  session_code?: string
  exam_id: string
  exam_title: string
  duration_minutes: number
  instructions?: string
  participant_id: string
  student_id: string
  teacher_id?: string
  camera_monitoring_enabled?: boolean
  can_resume?: boolean
  attempt_id?: string
  time_remaining?: number
}

// Create session context compatible with existing SessionExamInterface
interface SessionContextType {
  session: {
    student: {
      id: string
      student_id: string
      full_name: string
      class_level: string
    }
    session: {
      id: string
      session_code: string
      camera_monitoring_enabled?: boolean
      teacher_id: string
    }
    exam: {
      id: string
      title: string
      duration_minutes: number
    }
    participant_id: string
  } | null
  loading: boolean
  setSessionData: (data: SessionData) => void
  clearSession: () => void
}

const SimpleSessionContext = createContext<SessionContextType | undefined>(undefined)

export function SimpleSessionProvider({ children }: { children: ReactNode }) {
  const [sessionData, setSessionDataState] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)

  // Load session data from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('exam_session_data')
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession)
        console.log('=== RESTORED SESSION FROM LOCALSTORAGE ===')
        console.log('Restored data:', parsedSession)
        setSessionDataState(parsedSession)
      } catch (error) {
        console.error('Error parsing saved session:', error)
        localStorage.removeItem('exam_session_data')
      }
    }
    setLoading(false)
  }, [])

  const setSessionData = (data: SessionData) => {
    console.log('=== SETTING SESSION DATA ===')
    console.log('Data received:', data)
    setSessionDataState(data)
    // Save to localStorage for persistence
    localStorage.setItem('exam_session_data', JSON.stringify(data))
  }

  const clearSession = () => {
    setSessionDataState(null)
    localStorage.removeItem('exam_session_data')
  }

  // Transform our session data format to match what SessionExamInterface expects
  const session = sessionData ? {
    student: {
      id: sessionData.student_id,
      student_id: sessionData.student_id,
      full_name: sessionData.student_name,
      class_level: sessionData.student_class_level || 'JSS1'
    },
    session: {
      id: sessionData.session_id,
      session_code: sessionData.session_code || sessionData.session_id.slice(-6),
      camera_monitoring_enabled: sessionData.camera_monitoring_enabled || false,
      teacher_id: sessionData.teacher_id || 'unknown'
    },
    exam: {
      id: sessionData.exam_id,
      title: sessionData.exam_title,
      duration_minutes: sessionData.duration_minutes
    },
    participant_id: sessionData.participant_id
  } : null

  // Debug log when session changes
  if (session) {
    console.log('=== SESSION CONTEXT CREATED ===')
    console.log('Session object:', session)
  }

  return (
    <SimpleSessionContext.Provider 
      value={{ 
        session, 
        loading, 
        setSessionData, 
        clearSession 
      }}
    >
      {children}
    </SimpleSessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SimpleSessionContext)
  if (context === undefined) {
    throw new Error('useSession must be used within a SimpleSessionProvider')
  }
  return context
}