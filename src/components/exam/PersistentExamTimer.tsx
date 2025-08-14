'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Clock, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface PersistentExamTimerProps {
  attemptId: string
  initialTimeRemaining: number
  onTimeUp: () => void
  onTimeUpdate?: (timeRemaining: number) => void
  tableName?: 'student_exam_attempts' | 'user_exam_attempts'
}

export default function PersistentExamTimer({ 
  attemptId, 
  initialTimeRemaining, 
  onTimeUp,
  onTimeUpdate,
  tableName = 'student_exam_attempts'
}: PersistentExamTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncTimeWithServer()
      toast.success('Connection restored')
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

  const syncTimeWithServer = async () => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('time_remaining, started_at, status')
        .eq('id', attemptId)
        .single()

      if (error) throw error

      if (data && data.status === 'in_progress' && data.started_at) {
        const serverStartTime = new Date(data.started_at).getTime()
        const now = Date.now()
        const elapsedSeconds = Math.floor((now - serverStartTime) / 1000)
        const serverTimeRemaining = Math.max(0, data.time_remaining - elapsedSeconds)
        
        setTimeRemaining(serverTimeRemaining)
        
        localStorage.setItem(`exam_timer_${attemptId}`, JSON.stringify({
          timeRemaining: serverTimeRemaining,
          lastUpdate: now,
          serverStartTime
        }))
      }
    } catch (error) {
      console.error('Failed to sync time with server:', error)
    }
  }

  const updateServerTime = async (newTimeRemaining: number) => {
    if (!isOnline) return

    try {
      await supabase
        .from(tableName)
        .update({ 
          time_remaining: newTimeRemaining,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', attemptId)
    } catch (error) {
      console.error('Failed to update server time:', error)
    }
  }

  useEffect(() => {
    // Don't use localStorage on refresh - let server be the source of truth
    syncTimeWithServer()
    syncIntervalRef.current = setInterval(syncTimeWithServer, 30000)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [attemptId])

  useEffect(() => {
    if (timeRemaining <= 0) {
      onTimeUp()
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = Math.max(0, prev - 1)
        
        localStorage.setItem(`exam_timer_${attemptId}`, JSON.stringify({
          timeRemaining: newTime,
          lastUpdate: Date.now()
        }))

        if (onTimeUpdate) {
          onTimeUpdate(newTime)
        }

        if (newTime % 10 === 0 && isOnline) {
          updateServerTime(newTime)
        }

        if (newTime <= 0) {
          onTimeUp()
        }

        return newTime
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [timeRemaining, onTimeUp, onTimeUpdate, attemptId, isOnline])

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
    const totalTime = initialTimeRemaining
    const percentage = (timeRemaining / totalTime) * 100

    if (percentage > 50) return 'text-green-600'
    if (percentage > 25) return 'text-yellow-600'
    if (percentage > 10) return 'text-orange-600'
    return 'text-red-600'
  }

  const getBackgroundColor = () => {
    const totalTime = initialTimeRemaining
    const percentage = (timeRemaining / totalTime) * 100

    if (percentage > 50) return 'bg-green-50 border-green-200'
    if (percentage > 25) return 'bg-yellow-50 border-yellow-200'
    if (percentage > 10) return 'bg-orange-50 border-orange-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl border-2 shadow-lg backdrop-blur-sm ${getBackgroundColor()}`}
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-gray-600">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className={`w-5 h-5 ${getTimerColor()}`} />
            <span className={`text-xl font-mono font-bold ${getTimerColor()}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>

          {timeRemaining <= 300 && (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </motion.div>
          )}
        </div>

        {timeRemaining <= 60 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-red-600 font-medium"
          >
            ⚠️ Less than 1 minute remaining!
          </motion.div>
        )}

        {!isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-orange-600"
          >
            Timer continues offline
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}