'use client'

import { useState, useEffect, useRef } from 'react'
import { Camera, CameraOff, Wifi, WifiOff } from 'lucide-react'

interface StudentFrameDisplayProps {
  studentId: string
  studentName: string
  frameData?: string
  className?: string
}

export default function StudentFrameDisplay({ studentId, studentName, frameData, className }: StudentFrameDisplayProps) {
  const [currentFrame, setCurrentFrame] = useState<string | null>(null)
  const [lastFrameTime, setLastFrameTime] = useState<number>(0)
  const [isConnected, setIsConnected] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Update frame when frameData prop changes
  useEffect(() => {
    if (frameData) {
      setCurrentFrame(frameData)
      setLastFrameTime(Date.now())
      setIsConnected(true)
      console.log(`📸 Frame updated for student ${studentId}`)
    }
  }, [frameData, studentId])

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set connection timeout - if no frame received in 10 seconds, mark as disconnected
    timeoutRef.current = setTimeout(() => {
      setIsConnected(false)
      console.log(`📴 Student ${studentId} connection timeout - no frames received`)
    }, 10000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [lastFrameTime, studentId])

  // Function to update frame (called by parent component)
  const updateFrame = (frameData: string) => {
    setCurrentFrame(frameData)
    setLastFrameTime(Date.now())
    setIsConnected(true)
    
    console.log(`📸 Frame updated for student ${studentId}`)

    // Reset timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsConnected(false)
      console.log(`📴 Student ${studentId} connection timeout`)
    }, 10000)
  }

  // Expose updateFrame method to parent
  useEffect(() => {
    ;(updateFrame as typeof updateFrame & { studentId: string }).studentId = studentId
  }, [studentId])

  const timeAgo = lastFrameTime ? Math.floor((Date.now() - lastFrameTime) / 1000) : 0

  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative ${className}`}>
      {currentFrame ? (
        <>
          {/* Display the captured frame */}
          <img 
            src={currentFrame} 
            alt={`${studentName} camera feed`}
            className="w-full h-full object-cover"
          />
          
          {/* Connection status overlay */}
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${
              isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  LIVE
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  OFFLINE
                </>
              )}
            </div>
          </div>

          {/* Frame timestamp */}
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
            {timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`}
          </div>

          {/* Quality indicator */}
          <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
            Frame
          </div>
        </>
      ) : (
        // No frame received yet
        <div className="text-white text-center">
          <div className="relative mb-3">
            <Camera className="w-12 h-12 mx-auto opacity-50" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full animate-pulse flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
          <p className="text-sm font-medium">Waiting for frames...</p>
          <p className="text-xs opacity-75 mt-1">{studentName}</p>
          <div className="mt-2 text-xs bg-yellow-600/20 px-2 py-1 rounded">
            Camera Setup in Progress
          </div>
        </div>
      )}
    </div>
  )
}

// Export type for the updateFrame function reference
export type StudentFrameDisplayRef = {
  updateFrame: (frameData: string) => void
  studentId: string
}
