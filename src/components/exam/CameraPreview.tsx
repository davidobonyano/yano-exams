'use client'

import { useEffect, useRef } from 'react'

interface CameraPreviewProps {
  stream: MediaStream | null
}

export default function CameraPreview({ stream }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      console.log('❌ No video element')
      return
    }

    if (!stream) {
      console.log('❌ No stream provided')
      // Don't clear existing stream unless explicitly null
      return
    }

    // Check if stream tracks are still live
    const videoTracks = stream.getVideoTracks()
    if (videoTracks.length === 0) {
      console.log('❌ Stream has no video tracks')
      return
    }

    const hasLiveTracks = videoTracks.some(track => track.readyState === 'live')
    if (!hasLiveTracks) {
      console.log('❌ All video tracks are ended')
      return
    }

    // Don't re-set if it's the same stream
    if (video.srcObject === stream) {
      console.log('🔄 Same stream already set, checking if playing...')
      
      // Ensure video is playing even with same stream
      if (video.paused) {
        video.play().catch(error => {
          console.error('❌ STUDENT PREVIEW: Resume play error:', error)
        })
      }
      return
    }

    console.log('🎥 STUDENT PREVIEW: Setting NEW stream with', stream.getVideoTracks().length, 'video tracks')
    
    // Verify tracks are active (using existing videoTracks from above)
    videoTracks.forEach((track, i) => {
      console.log(`Track ${i}: enabled=${track.enabled}, readyState=${track.readyState}`)
    })
    
    // Clear any existing stream first
    video.srcObject = null
    
    // Set new stream after a brief delay to avoid interruption
    setTimeout(() => {
      if (video.srcObject === null) { // Only if not replaced by another stream
        video.srcObject = stream
        video.muted = true
        video.autoplay = true
        video.playsInline = true

        let playPromise: Promise<void> | null = null
        
        // Force play with proper promise handling
        const forcePlay = () => {
          if (playPromise) return // Prevent multiple concurrent play attempts
          
          playPromise = video.play()
            .then(() => {
              console.log('✅ STUDENT PREVIEW: Video playing successfully!')
              console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight)
              playPromise = null
            })
            .catch(error => {
              console.error('❌ STUDENT PREVIEW: Play error:', error)
              playPromise = null
            })
        }

        // Try to play when ready
        if (video.readyState >= 3) { // HAVE_FUTURE_DATA
          forcePlay()
        }

        // Also try when metadata loads
        video.onloadedmetadata = () => {
          console.log('📹 STUDENT PREVIEW: Metadata loaded')
          forcePlay()
        }

        // Check if video is actually playing
        video.onplaying = () => {
          console.log('🎬 STUDENT PREVIEW: Video is playing!')
        }

        video.onerror = (error) => {
          console.error('❌ STUDENT PREVIEW: Video error:', error)
        }

        // Periodic health check to ensure video stays active
        const healthCheck = setInterval(() => {
          if (video.srcObject && video.paused) {
            console.log('🔧 STUDENT PREVIEW: Video paused, attempting to resume')
            video.play().catch(error => {
              console.error('❌ STUDENT PREVIEW: Health check play error:', error)
            })
          }
          
          // Check if tracks are still live (but don't spam errors)
          const currentStream = video.srcObject as MediaStream
          if (currentStream) {
            const tracks = currentStream.getVideoTracks()
            const deadTracks = tracks.filter(track => track.readyState === 'ended')
            if (deadTracks.length > 0) {
              // Only log once per dead track detection, then clear the stream
              console.warn('⚠️ STUDENT PREVIEW: Camera tracks ended, clearing video element')
              video.srcObject = null
              clearInterval(healthCheck) // Stop health check if tracks are dead
            }
          }
        }, 3000) // Check every 3 seconds (less frequent)

        // Cleanup health check when component unmounts or stream changes
        return () => clearInterval(healthCheck)
      }
    }, 50) // Small delay to prevent rapid re-renders

    return () => {
      if (video) {
        video.srcObject = null
      }
    }
  }, [stream])

  if (!stream) {
    return (
      <div className="w-full rounded-xl border-2 border-red-200 shadow-lg bg-red-50 flex items-center justify-center h-32">
        <p className="text-red-600">No camera stream</p>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full rounded-xl border-2 border-green-200 shadow-lg"
      style={{ minHeight: '200px' }}
    />
  )
}
