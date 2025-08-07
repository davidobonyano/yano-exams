'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X, Shield, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface Warning {
  id: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  sent_at: string
  acknowledged: boolean
}

interface StudentWarningDisplayProps {
  sessionId: string
  studentId: string
  attemptId: string
}

export default function StudentWarningDisplay({ 
  sessionId, 
  studentId, 
  attemptId 
}: StudentWarningDisplayProps) {
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [activeWarning, setActiveWarning] = useState<Warning | null>(null)

  useEffect(() => {
    // Fetch existing warnings
    fetchWarnings()

    // Set up real-time subscription for new warnings
    const channel = supabase
      .channel(`student_warnings_${attemptId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'student_warnings',
          filter: `attempt_id=eq.${attemptId}`
        },
        (payload) => {
          const newWarning = payload.new as Warning
          setWarnings(prev => [newWarning, ...prev])
          setActiveWarning(newWarning)
          
          // Show toast notification
          const severityColors = {
            low: '🟡',
            medium: '🟠', 
            high: '🔴',
            critical: '🚨'
          }
          
          toast.error(`${severityColors[newWarning.severity]} Warning from teacher: ${newWarning.message}`, {
            duration: 8000,
            position: 'top-center',
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [attemptId])

  const fetchWarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('student_warnings')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('sent_at', { ascending: false })

      if (error) throw error
      setWarnings(data || [])
      
      // Show the most recent unacknowledged warning
      const unacknowledged = data?.find(w => !w.acknowledged)
      if (unacknowledged) {
        setActiveWarning(unacknowledged)
      }
    } catch (error) {
      console.error('Error fetching warnings:', error)
    }
  }

  const acknowledgeWarning = async (warningId: string) => {
    try {
      const { error } = await supabase
        .from('student_warnings')
        .update({ acknowledged: true })
        .eq('id', warningId)

      if (error) throw error

      setWarnings(prev => prev.map(w => 
        w.id === warningId ? { ...w, acknowledged: true } : w
      ))
      setActiveWarning(null)
    } catch (error) {
      console.error('Error acknowledging warning:', error)
    }
  }

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'low':
        return {
          color: 'from-yellow-500 to-orange-500',
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: '⚠️'
        }
      case 'medium':
        return {
          color: 'from-orange-500 to-red-500',
          bg: 'bg-orange-50',
          border: 'border-orange-200', 
          text: 'text-orange-800',
          icon: '🟠'
        }
      case 'high':
        return {
          color: 'from-red-500 to-red-600',
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: '🔴'
        }
      case 'critical':
        return {
          color: 'from-red-600 to-red-700',
          bg: 'bg-red-100',
          border: 'border-red-300',
          text: 'text-red-900',
          icon: '🚨'
        }
      default:
        return {
          color: 'from-gray-500 to-gray-600',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: '⚠️'
        }
    }
  }

  return (
    <>
      {/* Active Warning Modal */}
      <AnimatePresence>
        {activeWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] overflow-y-auto"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal */}
            <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="relative w-full max-w-md"
              >
                <Card className={`border-0 shadow-2xl ${getSeverityConfig(activeWarning.severity).bg} backdrop-blur-md overflow-hidden`}>
                  {/* Header Bar */}
                  <div className={`h-2 bg-gradient-to-r ${getSeverityConfig(activeWarning.severity).color}`} />
                  
                  <CardContent className="p-6 space-y-4">
                    <div className="text-center">
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
                        className="text-4xl mb-4"
                      >
                        {getSeverityConfig(activeWarning.severity).icon}
                      </motion.div>
                      
                      <h3 className={`text-xl font-bold mb-2 ${getSeverityConfig(activeWarning.severity).text}`}>
                        Warning from Teacher
                      </h3>
                      
                      <div className={`p-4 rounded-lg border ${getSeverityConfig(activeWarning.severity).border} ${getSeverityConfig(activeWarning.severity).bg} mb-4`}>
                        <p className={`text-base ${getSeverityConfig(activeWarning.severity).text}`}>
                          {activeWarning.message}
                        </p>
                      </div>
                      
                      <div className={`text-sm ${getSeverityConfig(activeWarning.severity).text} mb-4 opacity-75`}>
                        Severity: <span className="font-medium">{activeWarning.severity.toUpperCase()}</span>
                      </div>
                      
                      <Button
                        onClick={() => acknowledgeWarning(activeWarning.id)}
                        className={`w-full bg-gradient-to-r ${getSeverityConfig(activeWarning.severity).color} hover:opacity-90 text-white`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        I Understand
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning History Indicator */}
      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed top-4 right-4 z-50"
        >
          <div className="relative">
            <button
              onClick={() => {
                const unacknowledged = warnings.find(w => !w.acknowledged)
                if (unacknowledged) {
                  setActiveWarning(unacknowledged)
                }
              }}
              className="bg-red-500 text-white rounded-full p-2 shadow-lg hover:bg-red-600 transition-colors"
              title="View warnings"
            >
              <AlertTriangle className="w-5 h-5" />
            </button>
            
            {warnings.filter(w => !w.acknowledged).length > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {warnings.filter(w => !w.acknowledged).length}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </>
  )
}