'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Clock, AlertTriangle, Wifi, WifiOff, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface UnbreakableExamTimerProps {
  attemptId: string
  onTimeUp: () => void
  onTimeUpdate?: (timeRemaining: number) => void
}

export default function UnbreakableExamTimer({ 
  attemptId, 
  onTimeUp,
  onTimeUpdate
}: UnbreakableExamTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [timerStatus, setTimerStatus] = useState<'NORMAL' | 'CAUTION' | 'WARNING' | 'EXPIRED'>('NORMAL')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [serverTime, setServerTime] = useState<string>('')
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const displayIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoSubmitRef = useRef<NodeJS.Timeout | null>(null)
  
  // This is the ONLY source of truth - server database
  const getServerTimeRemaining = async () => {
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

      if (data) {
        const newTimeRemaining = Math.max(0, data.time_remaining_seconds)
        setTimeRemaining(newTimeRemaining)
        setTimerStatus(data.timer_status)
        setServerTime(data.server_current_time)
        
        // If server says time is up, submit immediately
        if (data.is_expired && data.status === 'in_progress') {
          console.log('🚨 SERVER SAYS TIME IS UP - AUTO SUBMITTING')
          onTimeUp()
          return
        }
        
        if (onTimeUpdate) {
          onTimeUpdate(newTimeRemaining)
        }

        return newTimeRemaining
      }
    } catch (error) {
      console.error('Failed to sync with server time authority:', error)
      return null
    }
  }

  // Setup server sync (every 2 seconds for accuracy)
  useEffect(() => {
    const syncWithServer = async () => {
      if (!isOnline) return
      
      const serverTime = await getServerTimeRemaining()
      if (serverTime !== null && serverTime !== undefined && serverTime <= 0) {
        onTimeUp()
      }
    }

    // Initial sync
    syncWithServer()
    
    // Regular sync every 2 seconds (very frequent to prevent manipulation)
    syncIntervalRef.current = setInterval(syncWithServer, 2000)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [attemptId, isOnline, onTimeUp])

  // Display timer updates (smooth countdown between server syncs)
  useEffect(() => {
    displayIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          onTimeUp()
          return 0
        }
        return Math.max(0, prev - 1)
      })
    }, 1000)

    return () => {
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current)
      }
    }
  }, [onTimeUp])

  // Handle online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      getServerTimeRemaining()
      toast.success('Connection restored - syncing with server time')
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      toast.error('Connection lost - timer continues running')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listen for server auto-submit notifications
  useEffect(() => {
    const channel = supabase
      .channel('exam-timer-alerts')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'student_exam_attempts',
        filter: `id=eq.${attemptId}`
      }, (payload) => {
        if (payload.new.status === 'submitted') {
          console.log('🚨 SERVER AUTO-SUBMITTED EXAM')
          onTimeUp()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [attemptId, onTimeUp])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getTimerColor = () => {
    switch (timerStatus) {
      case 'EXPIRED': return 'text-red-700 animate-pulse'
      case 'WARNING': return 'text-red-600'
      case 'CAUTION': return 'text-orange-600'
      default: return 'text-green-600'
    }
  }

  const getBackgroundColor = () => {
    switch (timerStatus) {
      case 'EXPIRED': return 'bg-red-100 border-red-300'
      case 'WARNING': return 'bg-red-50 border-red-200'
      case 'CAUTION': return 'bg-orange-50 border-orange-200'
      default: return 'bg-green-50 border-green-200'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl border-2 shadow-lg backdrop-blur-sm ${getBackgroundColor()}`}
      >
        {/* Server Authority Indicator */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1">
            <Shield className="w-3 h-3 text-blue-600" />
            <span className="text-xs text-blue-700 font-medium">Server Protected</span>
          </div>
          <div className="flex items-center space-x-1">
            {isOnline ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            <span className="text-xs text-gray-600">
              {isOnline ? 'Synced' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Clock className={`w-5 h-5 ${getTimerColor()}`} />
          <span className={`text-xl font-mono font-bold ${getTimerColor()}`}>
            {formatTime(timeRemaining)}
          </span>

          {(timerStatus === 'WARNING' || timerStatus === 'EXPIRED') && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </motion.div>
          )}
        </div>

        {timerStatus === 'WARNING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-red-600 font-medium"
          >
            ⚠️ Less than 5 minutes remaining!
          </motion.div>
        )}

        {timerStatus === 'EXPIRED' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-red-700 font-bold"
          >
            🚨 TIME UP - Submitting automatically
          </motion.div>
        )}

        {!isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-orange-600"
          >
            Server sync paused - timer continues
          </motion.div>
        )}

        {/* Debug info (remove in production) */}
        {serverTime && (
          <div className="mt-2 text-xs text-gray-500">
            Server: {new Date(serverTime).toLocaleTimeString()}
          </div>
        )}
      </motion.div>
    </div>
  )
}
