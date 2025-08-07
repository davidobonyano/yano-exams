'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { StudentExamAttempt } from '@/types/database-v2'

interface SessionExamTimerProps {
  duration: number // in seconds
  attempt: StudentExamAttempt
  onTimeUp: () => void
  isPaused?: boolean
  isOffline?: boolean
}

export default function SessionExamTimer({ duration, attempt, onTimeUp, isPaused = false, isOffline = false }: SessionExamTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(attempt.time_remaining || duration)
  const [isRunning, setIsRunning] = useState(attempt.status === 'in_progress')
  const [offlineStartTime, setOfflineStartTime] = useState<Date | null>(null)

  useEffect(() => {
    if (!isRunning || isPaused) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1
        
        // Save time remaining to database every 30 seconds (only when online)
        if (newTime % 30 === 0 && !isOffline) {
          supabase
            .from('student_exam_attempts')
            .update({ 
              time_remaining: newTime,
              last_activity_at: new Date().toISOString()
            })
            .eq('id', attempt.id)
            .then()
        }

        if (newTime <= 0) {
          setIsRunning(false)
          onTimeUp()
          return 0
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, isPaused, attempt.id, onTimeUp])

  // Track offline periods
  useEffect(() => {
    if (isOffline && !offlineStartTime) {
      // Going offline - record start time
      setOfflineStartTime(new Date())
    } else if (!isOffline && offlineStartTime) {
      // Coming back online - save offline duration
      const offlineDuration = (new Date().getTime() - offlineStartTime.getTime()) / 1000
      
      supabase
        .from('student_exam_attempts')
        .update({
          offline_duration: supabase.sql`COALESCE(offline_duration, 0) + ${offlineDuration}`,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', attempt.id)
        .then()
      
      setOfflineStartTime(null)
    }
  }, [isOffline, offlineStartTime, attempt.id])

  // Update pause status in database  
  useEffect(() => {
    if (isOffline) return // Don't update database when offline
    
    const updateStatus = async () => {
      await supabase
        .from('student_exam_attempts')
        .update({
          is_paused: isPaused,
          pause_reason: isPaused ? 'Paused by teacher' : null,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', attempt.id)
    }

    updateStatus()
  }, [isPaused, isOffline, attempt.id])

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
    if (isPaused) return 'text-yellow-600'
    if (isOffline) return 'text-red-500' // Red when offline but still running
    if (timeRemaining <= 300) return 'text-red-600' // Last 5 minutes
    if (timeRemaining <= 900) return 'text-orange-600' // Last 15 minutes
    return 'text-green-600'
  }

  return (
    <div className="flex items-center space-x-2">
      {isPaused && (
        <div className="flex items-center text-yellow-600">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">Paused</span>
        </div>
      )}

      {isOffline && !isPaused && (
        <div className="flex items-center text-red-500">
          <svg className="w-4 h-4 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            <path d="M16 7L9 2v3L3 0l6 5v3l7-5z" />
          </svg>
          <span className="text-sm">Offline</span>
        </div>
      )}
      
      <div className={`text-xl font-mono font-semibold ${getTimerColor()}`}>
        {formatTime(timeRemaining)}
      </div>

      {timeRemaining <= 300 && timeRemaining > 0 && (
        <div className="animate-pulse">
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  )
}