import { supabase } from './supabase'

export interface ServerTimerStatus {
  timeRemainingSeconds: number
  timerStatus: 'NORMAL' | 'CAUTION' | 'WARNING' | 'EXPIRED'
  isExpired: boolean
  serverCurrentTime: string
  status: string
}

/**
 * Start an exam with server-authoritative timing
 * This prevents students from manipulating the timer
 */
export async function startExamWithServerTimer(
  sessionId: string,
  studentId: string,
  examId: string,
  durationMinutes: number
): Promise<{ success: boolean; attemptId?: string; error?: string }> {
  try {
    console.log('🚀 Starting exam with server timer authority:', {
      sessionId,
      studentId,
      examId,
      durationMinutes
    })

    const { data, error } = await supabase.rpc('start_exam_with_server_timer', {
      p_session_id: sessionId,
      p_student_id: studentId,
      p_exam_id: examId,
      p_duration_minutes: durationMinutes
    })

    if (error) {
      console.error('❌ Failed to start exam with server timer:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Exam started with server timer. Attempt ID:', data)
    return { success: true, attemptId: data }
  } catch (error) {
    console.error('❌ Error starting exam with server timer:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get real-time server timer status
 * This is the ONLY source of truth for time remaining
 */
export async function getServerTimerStatus(attemptId: string): Promise<ServerTimerStatus | null> {
  try {
    const { data, error } = await supabase
      .from('exam_timer_status')
      .select(`
        time_remaining_seconds,
        timer_status,
        server_current_time,
        is_expired,
        status
      `)
      .eq('attempt_id', attemptId)
      .single()

    if (error) throw error

    return {
      timeRemainingSeconds: data.time_remaining_seconds,
      timerStatus: data.timer_status,
      isExpired: data.is_expired,
      serverCurrentTime: data.server_current_time,
      status: data.status
    }
  } catch (error) {
    console.error('❌ Failed to get server timer status:', error)
    return null
  }
}

/**
 * Force submit exam when time is up (server-side validation)
 */
export async function submitExamWithTimeValidation(
  attemptId: string
): Promise<{ success: boolean; error?: string; timeExpired?: boolean }> {
  try {
    // First check if time is really up according to server
    const timerStatus = await getServerTimerStatus(attemptId)
    
    if (!timerStatus) {
      return { success: false, error: 'Could not verify timer status' }
    }

    console.log('⏰ Server timer status at submission:', timerStatus)

    // Submit the exam
    const { error: submitError } = await supabase
      .from('student_exam_attempts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', attemptId)

    if (submitError) {
      console.error('❌ Failed to submit exam:', submitError)
      return { success: false, error: submitError.message }
    }

    console.log('✅ Exam submitted successfully')
    return { 
      success: true, 
      timeExpired: timerStatus.isExpired 
    }
  } catch (error) {
    console.error('❌ Error submitting exam:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Subscribe to server timer events for real-time updates
 */
export function subscribeToServerTimerEvents(
  attemptId: string,
  onTimeUp: () => void,
  onStatusChange?: (status: ServerTimerStatus) => void
) {
  const channel = supabase
    .channel(`timer-${attemptId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'student_exam_attempts',
      filter: `id=eq.${attemptId}`
    }, async (payload) => {
      console.log('📡 Server timer update:', payload)
      
      // If server auto-submitted, trigger client submission
      if (payload.new.status === 'submitted') {
        console.log('🚨 SERVER AUTO-SUBMITTED - triggering client handler')
        onTimeUp()
      }
      
      // If status change callback provided, get latest timer status
      if (onStatusChange) {
        const status = await getServerTimerStatus(attemptId)
        if (status) {
          onStatusChange(status)
        }
      }
    })
    .subscribe()

  return channel
}

/**
 * Utility to format seconds into readable time
 */
export function formatServerTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
