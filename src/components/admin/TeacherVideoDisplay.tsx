'use client'

import { useEffect, useRef } from 'react'

interface TeacherVideoDisplayProps {
  stream: MediaStream
  studentId: string
  className?: string
}

export default function TeacherVideoDisplay({ stream, studentId, className }: TeacherVideoDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      console.log(`❌ TEACHER: No video element for ${studentId}`)
      return
    }
    
    if (!stream) {
      console.log(`❌ TEACHER: No stream for ${studentId}`)
      return
    }

    // Check if stream tracks are still live
    const videoTracks = stream.getVideoTracks()
    if (videoTracks.length === 0) {
      console.log(`❌ TEACHER: Stream has no video tracks for ${studentId}`)
      return
    }

    const hasLiveTracks = videoTracks.some(track => track.readyState === 'live')
    if (!hasLiveTracks) {
      console.log(`❌ TEACHER: All video tracks are ended for ${studentId}`)
      return
    }

    // Don't re-set if it's the same stream
    if (video.srcObject === stream) {
      console.log(`🔄 TEACHER: Same stream already set for ${studentId}, checking if playing...`)
      
      if (video.paused) {
        video.play().catch(error => {
          console.error(`❌ TEACHER: Resume play error for ${studentId}:`, error)
        })
      }
      return
    }

    console.log(`🎥 TEACHER: Setting video for student ${studentId} with ${stream.getVideoTracks().length} tracks`)

    // Clear existing stream first
    video.srcObject = null
    
    setTimeout(() => {
      if (video.srcObject === null) {
        // Force set stream properties
        video.srcObject = stream
        video.muted = true
        video.autoplay = true
        video.playsInline = true

        let playPromise: Promise<void> | null = null
        
        // Force play with promise protection
        const forcePlay = () => {
          if (playPromise) return
          
          playPromise = video.play()
            .then(() => {
              console.log(`✅ TEACHER: Video playing for student ${studentId}!`)
              console.log(`Video size: ${video.videoWidth}x${video.videoHeight}`)
              playPromise = null
            })
            .catch(error => {
              console.error(`❌ TEACHER: Play error for ${studentId}:`, error)
              playPromise = null
            })
        }

        // Try when ready
        if (video.readyState >= 3) {
          forcePlay()
        }
        
        video.onloadedmetadata = () => {
          console.log(`📹 TEACHER: Metadata loaded for ${studentId}`)
          forcePlay()
        }

        video.onplaying = () => {
          console.log(`🎬 TEACHER: Video is playing for ${studentId}!`)
        }

        video.onerror = (error) => {
          console.error(`❌ TEACHER: Video error for ${studentId}:`, error)
        }

        // Health check for teacher video too
        const healthCheck = setInterval(() => {
          if (video.srcObject && video.paused) {
            console.log(`🔧 TEACHER: Video paused for ${studentId}, attempting to resume`)
            video.play().catch(error => {
              console.error(`❌ TEACHER: Health check play error for ${studentId}:`, error)
            })
          }
          
          // Check if tracks are still live for teacher video
          const currentStream = video.srcObject as MediaStream
          if (currentStream) {
            const tracks = currentStream.getVideoTracks()
            const deadTracks = tracks.filter(track => track.readyState === 'ended')
            if (deadTracks.length > 0) {
              console.warn(`⚠️ TEACHER: Camera tracks ended for ${studentId}, clearing video element`)
              video.srcObject = null
              clearInterval(healthCheck)
            }
          }
        }, 3000)

        return () => clearInterval(healthCheck)
      }
    }, 50)

    return () => {
      if (video) {
        video.srcObject = null
      }
    }
  }, [stream, studentId])

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={className}
      style={{ minHeight: '150px' }}
    />
  )
}
