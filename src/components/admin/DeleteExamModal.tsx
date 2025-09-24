'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface DeleteExamModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  examTitle: string
}

export default function DeleteExamModal({
  isOpen,
  onClose,
  onConfirm,
  examTitle
}: DeleteExamModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error('Error in delete confirmation:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-red-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Delete Exam
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete this exam?
          </p>
          <p className="font-semibold text-gray-900 mb-4">
            {examTitle}
          </p>
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This action cannot be undone. All associated sessions, questions, and student data will be permanently deleted.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Exam'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
