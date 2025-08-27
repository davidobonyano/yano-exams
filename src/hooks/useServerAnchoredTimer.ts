import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useServerAnchoredTimer(params: {
  attemptId: string
  onTimeUp: () => void
}) {
  const { attemptId, onTimeUp } = params

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [serverSynced, setServerSynced] = useState(false)
  const tickRef = useRef<NodeJS.Timeout | null>(null)

  const syncOnceFromServer = useCallback(async () => {
    try {
      // Get server-authoritative remaining time for this attempt
      const { data, error } = await supabase
        .from('exam_timer_status')
        .select('time_remaining_seconds, server_current_time')
        .eq('attempt_id', attemptId)
        .single()

      if (error) throw error

      const diff = Math.max(0, Number(data.time_remaining_seconds) || 0)
      setRemainingSeconds(diff)
      setServerSynced(true)

      // 3) Start local ticking
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev === null) return null
          const next = prev - 1
          if (next <= 0) {
            clearInterval(tickRef.current as NodeJS.Timeout)
            onTimeUp()
            return 0
          }
          return next
        })
      }, 1000)
    } catch (e) {
      console.error('Failed to sync timer from server:', e)
    }
  }, [attemptId, onTimeUp])

  useEffect(() => {
    syncOnceFromServer()
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [syncOnceFromServer])

  return { remainingSeconds, serverSynced }
}


