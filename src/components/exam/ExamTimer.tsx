'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { UserExamAttempt } from '@/types/database'

interface ExamTimerProps {
  duration: number // in seconds
  attempt: UserExamAttempt
  onTimeUp: () => void
  isPaused?: boolean
}

export default function ExamTimer({ duration, attempt, onTimeUp, isPaused = false }: ExamTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(attempt.time_remaining || duration)
  const [isRunning, setIsRunning] = useState(attempt.status === 'in_progress')

  useEffect(() => {
    if (!isRunning || isPaused) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1
        
        // Save time remaining to database every 30 seconds
        if (newTime % 30 === 0) {
          supabase
            .from('user_exam_attempts')
            .update({ time_remaining: newTime })
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

  // Update pause status in database
  useEffect(() => {
    const updatePauseStatus = async () => {
      await supabase
        .from('user_exam_attempts')
        .update({
          is_paused: isPaused,
          pause_reason: isPaused ? 'Network connectivity issue' : null
        })
        .eq('id', attempt.id)
    }

    updatePauseStatus()
  }, [isPaused, attempt.id])

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