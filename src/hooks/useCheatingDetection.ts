'use client'

import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface CheatingDetectionConfig {
  attemptId: string
  studentId: string
  sessionId: string
  onViolationDetected?: (violationType: string, details: any) => void
}

interface ViolationDetails {
  timestamp: number
  userAgent: string
  url: string
  additionalData?: any
}

export function useCheatingDetection({
  attemptId,
  studentId,
  sessionId,
  onViolationDetected
}: CheatingDetectionConfig) {
  const lastActivityRef = useRef<number>(Date.now())
  const tabSwitchCountRef = useRef<number>(0)
  const copyAttemptCountRef = useRef<number>(0)
  const rightClickCountRef = useRef<number>(0)
  const suspiciousKeyCountRef = useRef<number>(0)

  // Log cheating incident to database
  const logCheatingIncident = useCallback(async (
    violationType: string, 
    violationDetails: any, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
  ) => {
    try {
      const { error } = await supabase.rpc('log_cheating_incident', {
        p_attempt_id: attemptId,
        p_violation_type: violationType,
        p_violation_details: violationDetails,
        p_severity: severity,
        p_browser_data: {
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          url: window.location.href
        }
      })

      if (error) {
        console.error('Failed to log cheating incident:', error)
      }

      // Notify parent component
      onViolationDetected?.(violationType, violationDetails)
    } catch (error) {
      console.error('Error logging cheating incident:', error)
    }
  }, [attemptId, onViolationDetected])

  // Update last activity timestamp
  const updateActivity = useCallback(async () => {
    lastActivityRef.current = Date.now()
    try {
      await supabase
        .from('student_exam_attempts')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', attemptId)
    } catch (error) {
      console.error('Failed to update activity:', error)
    }
  }, [attemptId])

  // Tab/window focus change detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCountRef.current += 1
        const severity = tabSwitchCountRef.current > 3 ? 'high' : 
                        tabSwitchCountRef.current > 2 ? 'medium' : 'low'
        
        logCheatingIncident('tab_switch', {
          count: tabSwitchCountRef.current,
          timestamp: Date.now(),
          duration: Date.now() - lastActivityRef.current
        }, severity)
      } else {
        updateActivity()
      }
    }

    const handleWindowBlur = () => {
      tabSwitchCountRef.current += 1
      const severity = tabSwitchCountRef.current > 3 ? 'high' : 
                      tabSwitchCountRef.current > 2 ? 'medium' : 'low'
      
      logCheatingIncident('window_blur', {
        count: tabSwitchCountRef.current,
        timestamp: Date.now()
      }, severity)
    }

    const handleWindowFocus = () => {
      updateActivity()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [logCheatingIncident, updateActivity])

  // Keyboard event detection (copy/paste attempts, suspicious keys)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      updateActivity()

      // Detect copy/paste attempts
      if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'v' || event.key === 'a')) {
        copyAttemptCountRef.current += 1
        const severity = copyAttemptCountRef.current > 5 ? 'high' : 
                        copyAttemptCountRef.current > 3 ? 'medium' : 'low'
        
        logCheatingIncident('copy_paste_attempt', {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          count: copyAttemptCountRef.current,
          timestamp: Date.now()
        }, severity)
      }

      // Detect suspicious key combinations
      if (event.key === 'F12' || 
          (event.ctrlKey && event.shiftKey && event.key === 'I') ||
          (event.ctrlKey && event.shiftKey && event.key === 'J') ||
          (event.ctrlKey && event.key === 'u')) {
        suspiciousKeyCountRef.current += 1
        
        logCheatingIncident('developer_tools_attempt', {
          key: event.key,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          count: suspiciousKeyCountRef.current,
          timestamp: Date.now()
        }, 'high')
      }

      // Detect print screen
      if (event.key === 'PrintScreen') {
        logCheatingIncident('screenshot_attempt', {
          timestamp: Date.now()
        }, 'medium')
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [logCheatingIncident, updateActivity])

  // Right-click detection
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      rightClickCountRef.current += 1
      
      const severity = rightClickCountRef.current > 5 ? 'medium' : 'low'
      
      logCheatingIncident('right_click_attempt', {
        count: rightClickCountRef.current,
        timestamp: Date.now(),
        target: (event.target as Element)?.tagName || 'unknown'
      }, severity)
      
      updateActivity()
    }

    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [logCheatingIncident, updateActivity])

  // Mouse movement and click tracking for activity
  useEffect(() => {
    const handleMouseActivity = () => {
      updateActivity()
    }

    const throttledMouseActivity = throttle(handleMouseActivity, 5000) // Update every 5 seconds

    document.addEventListener('mousemove', throttledMouseActivity)
    document.addEventListener('click', throttledMouseActivity)

    return () => {
      document.removeEventListener('mousemove', throttledMouseActivity)
      document.removeEventListener('click', throttledMouseActivity)
    }
  }, [updateActivity])

  // Detect text selection (potential copying)
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().length > 20) {
        logCheatingIncident('text_selection', {
          selectedText: selection.toString().substring(0, 100), // First 100 chars only
          selectionLength: selection.toString().length,
          timestamp: Date.now()
        }, 'low')
      }
      updateActivity()
    }

    const throttledSelectionChange = throttle(handleSelectionChange, 2000)
    document.addEventListener('selectionchange', throttledSelectionChange)

    return () => {
      document.removeEventListener('selectionchange', throttledSelectionChange)
    }
  }, [logCheatingIncident, updateActivity])

  // Detect resize events (potential window manipulation)
  useEffect(() => {
    const handleResize = () => {
      logCheatingIncident('window_resize', {
        width: window.innerWidth,
        height: window.innerHeight,
        timestamp: Date.now()
      }, 'low')
      updateActivity()
    }

    const throttledResize = throttle(handleResize, 3000)
    window.addEventListener('resize', throttledResize)

    return () => {
      window.removeEventListener('resize', throttledResize)
    }
  }, [logCheatingIncident, updateActivity])

  // Return violation counts for display
  return {
    tabSwitchCount: tabSwitchCountRef.current,
    copyAttemptCount: copyAttemptCountRef.current,
    rightClickCount: rightClickCountRef.current,
    suspiciousKeyCount: suspiciousKeyCountRef.current,
    updateActivity
  }
}

// Throttle utility function
function throttle<T extends (...args: any[]) => any>(func: T, limit: number): T {
  let inThrottle: boolean
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(null, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }) as T
}