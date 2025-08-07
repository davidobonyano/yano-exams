'use client'

import { useEffect, useRef } from 'react'

interface VideoStreamProps {
  stream: MediaStream | null
  className?: string
  muted?: boolean
  autoPlay?: boolean
  playsInline?: boolean
}

export function VideoStream({ 
  stream, 
  className = '', 
  muted = true, 
  autoPlay = true,
  playsInline = true 
}: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playAttemptRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return

    // Cancel any pending play attempts
    if (playAttemptRef.current) {
      playAttemptRef.current.catch(() => {
        // Ignore cancelled play attempts
      })
    }

    // Only update if the stream has changed
    if (video.srcObject !== stream) {
      video.srcObject = stream

      // Wait for the video to be ready before playing
      const handleCanPlay = () => {
        if (video.srcObject === stream) {
          playAttemptRef.current = video.play().catch(() => {
            // Silently handle play errors - they're common during development
          })
        }
      }

      video.addEventListener('canplay', handleCanPlay, { once: true })
      
      // Cleanup function
      return () => {
        video.removeEventListener('canplay', handleCanPlay)
      }
    }
  }, [stream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const video = videoRef.current
      if (video) {
        video.srcObject = null
      }
    }
  }, [])

  return (
    <video
      ref={videoRef}
      className={className}
      muted={muted}
      autoPlay={autoPlay}
      playsInline={playsInline}
    />
  )
}