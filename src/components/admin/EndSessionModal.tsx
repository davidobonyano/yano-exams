'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, X } from 'lucide-react'

interface EndSessionModalProps {
  isOpen: boolean
  sessionName: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function EndSessionModal({
  isOpen,
  sessionName,
  onConfirm,
  onCancel,
  loading = false
}: EndSessionModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md"
        >
          <Card className="border-0 shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-red-50 border-b border-red-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-red-800">
                  <AlertTriangle className="w-5 h-5" />
                  <span>End Session</span>
                </CardTitle>
                <button
                  onClick={onCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-4">
                <p className="text-gray-700">
                  Are you sure you want to end the session <strong>&quot;{sessionName}&quot;</strong>?
                </p>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-700">
                    Students will no longer be able to access this exam once ended.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onCancel}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Ending...' : 'End Session'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
