'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FloatingInput } from '@/components/ui/floating-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle, X, Send, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface StudentAttempt {
  id: string
  student_id: string
  students?: {
    id: string
    student_id: string
    full_name: string
    class_level: string
  }
}

interface SendWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onSent: () => void
  attempt: StudentAttempt
  sessionId: string
  teacherId: string
}

const warningPresets = [
  {
    severity: 'low' as const,
    message: 'Please stay focused on your exam and avoid distractions.',
    label: 'Focus Reminder'
  },
  {
    severity: 'medium' as const,
    message: 'Tab switching has been detected. Please remain on the exam page.',
    label: 'Tab Switch Warning'
  },
  {
    severity: 'high' as const,
    message: 'Multiple violations detected. Please follow exam rules strictly.',
    label: 'Multiple Violations'
  },
  {
    severity: 'critical' as const,
    message: 'Serious exam violation detected. This is your final warning before disqualification.',
    label: 'Final Warning'
  }
]

export default function SendWarningModal({
  isOpen,
  onClose,
  onSent,
  attempt,
  sessionId,
  teacherId
}: SendWarningModalProps) {
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [sending, setSending] = useState(false)
  const [usePreset, setUsePreset] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState(warningPresets[1])

  const getSeverityConfig = (sev: string) => {
    switch (sev) {
      case 'low':
        return { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: '⚠️' }
      case 'medium':
        return { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: '🟠' }
      case 'high':
        return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: '🔴' }
      case 'critical':
        return { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-300', icon: '🚨' }
      default:
        return { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', icon: '⚠️' }
    }
  }

  const sendWarning = async () => {
    console.log('=== SEND WARNING DEBUG ===')
    console.log('Attempt object:', attempt)
    console.log('Student info:', attempt.students)
    console.log('Session ID:', sessionId)
    console.log('Teacher ID:', teacherId)

    if (!attempt.students?.id) {
      console.error('Student ID missing from attempt.students:', attempt.students)
      toast.error('Student information not found')
      return
    }

    const warningMessage = usePreset ? selectedPreset.message : message
    const warningSeverity = usePreset ? selectedPreset.severity : severity

    if (!warningMessage.trim()) {
      toast.error('Please enter a warning message')
      return
    }

    try {
      setSending(true)

      const warningData = {
        attempt_id: attempt.id,
        session_id: sessionId,
        student_id: attempt.students.id,
        teacher_id: teacherId,
        message: warningMessage,
        severity: warningSeverity,
        sent_at: new Date().toISOString()
      }

      console.log('Sending warning via broadcast:', warningData)

      // Send warning via Supabase Broadcast (real-time, no DB storage)
      const channel = supabase.channel(`session_${sessionId}_warnings`)
      
      await channel.send({
        type: 'broadcast',
        event: 'student_warning',
        payload: warningData
      })

      console.log('Warning broadcast sent successfully!')

      toast.success(`Warning sent to ${attempt.students.full_name}`)
      onSent()
      onClose()
      
      // Reset form
      setMessage('')
      setSeverity('medium')
      setSelectedPreset(warningPresets[1])
      setUsePreset(true)
    } catch (error) {
      console.error('Error sending warning:', error)
      toast.error(`Failed to send warning: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
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
              <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
                {/* Header */}
                <div className="h-2 bg-gradient-to-r from-orange-500 to-red-500" />
                
                <CardHeader className="relative">
                  {/* Close Button - Top Right */}
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  {/* Title Section */}
                  <div className="text-center pr-16">
                    <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <AlertTriangle className="w-8 h-8 text-white" />
                    </div>
                    
                    <CardTitle className="text-xl font-bold">Send Warning</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {attempt.students?.full_name} ({attempt.students?.student_id})
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Warning Type Toggle */}
                  <div className="flex gap-2">
                    <Button
                      variant={usePreset ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUsePreset(true)}
                      className="flex-1"
                    >
                      Quick Warnings
                    </Button>
                    <Button
                      variant={!usePreset ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUsePreset(false)}
                      className="flex-1"
                    >
                      Custom Message
                    </Button>
                  </div>

                  {usePreset ? (
                    <div className="space-y-3">
                      <Label>Select Warning Type</Label>
                      <div className="space-y-2">
                        {warningPresets.map((preset, index) => (
                          <motion.button
                            key={index}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedPreset(preset)}
                            className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                              selectedPreset === preset
                                ? `${getSeverityConfig(preset.severity).border} ${getSeverityConfig(preset.severity).bg}`
                                : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <span className="text-lg">{getSeverityConfig(preset.severity).icon}</span>
                              <div className="flex-1">
                                <div className="font-medium text-sm">{preset.label}</div>
                                <div className={`text-xs mt-1 ${selectedPreset === preset ? getSeverityConfig(preset.severity).color : 'text-gray-600'}`}>
                                  {preset.message}
                                </div>
                                <div className="text-xs mt-1 opacity-75 uppercase font-medium">
                                  {preset.severity} severity
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label>Severity Level</Label>
                        <Select value={severity} onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => setSeverity(value)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">🟡 Low - General reminder</SelectItem>
                            <SelectItem value="medium">🟠 Medium - Rule violation</SelectItem>
                            <SelectItem value="high">🔴 High - Serious violation</SelectItem>
                            <SelectItem value="critical">🚨 Critical - Final warning</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Warning Message</Label>
                        <Textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Enter your warning message to the student..."
                          className="mt-1 min-h-[80px]"
                          maxLength={500}
                        />
                        <div className="text-xs text-gray-500 mt-1 text-right">
                          {message.length}/500 characters
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  <div className={`p-4 rounded-lg border ${getSeverityConfig(usePreset ? selectedPreset.severity : severity).border} ${getSeverityConfig(usePreset ? selectedPreset.severity : severity).bg}`}>
                    <div className="text-sm font-medium mb-2">Preview:</div>
                    <div className={`text-sm ${getSeverityConfig(usePreset ? selectedPreset.severity : severity).color}`}>
                      {usePreset ? selectedPreset.message : message || 'Enter your message above...'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={onClose}
                      variant="outline"
                      className="flex-1"
                      disabled={sending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={sendWarning}
                      disabled={sending || (!usePreset && !message.trim())}
                      className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                    >
                      {sending ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                          />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Warning
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}