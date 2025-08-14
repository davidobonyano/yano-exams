'use client'

import { supabase } from './supabase'

export class CameraFrameStreaming {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private intervalId: NodeJS.Timeout | null = null
  private isStreaming = false
  private channel: any = null

  constructor(
    private sessionId: string,
    private studentId: string,
    private videoElement: HTMLVideoElement
  ) {
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')!
  }

  async startStreaming() {
    if (this.isStreaming) return

    console.log('📸 Starting frame capture streaming for session:', this.sessionId)
    this.isStreaming = true

    // Create and subscribe to channel once
    this.channel = supabase.channel(`camera_frames_${this.sessionId}`)
    await this.channel.subscribe()
    console.log('📺 Channel subscribed for streaming')

    // Capture and send frame every 3 seconds
    this.intervalId = setInterval(() => {
      this.captureAndSendFrame()
    }, 3000)

    // Send initial frame
    setTimeout(() => this.captureAndSendFrame(), 1000)
  }

  stopStreaming() {
    if (!this.isStreaming) return

    console.log('🛑 Stopping frame capture streaming')
    this.isStreaming = false
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    // Send final "stream ended" message
    this.sendStreamStatus('ended')

    // Clean up channel
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }
  }

  private async captureAndSendFrame() {
    try {
      if (!this.videoElement || this.videoElement.readyState < 2) {
        console.log('⏳ Video not ready for frame capture, readyState:', this.videoElement?.readyState)
        return
      }

      // Check video dimensions
      const videoWidth = this.videoElement.videoWidth || 320
      const videoHeight = this.videoElement.videoHeight || 240
      
      console.log('📹 Capturing frame:', {
        videoWidth,
        videoHeight,
        readyState: this.videoElement.readyState,
        currentTime: this.videoElement.currentTime
      })

      // Set canvas size to match video
      this.canvas.width = videoWidth
      this.canvas.height = videoHeight

      // Draw current video frame to canvas
      this.context.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height)

      // Convert to base64 with reduced quality for performance
      const frameData = this.canvas.toDataURL('image/jpeg', 0.6)
      console.log('📸 Frame data length:', frameData.length, 'bytes')

      // Send frame via existing channel
      if (!this.channel) {
        console.error('❌ No channel available for sending frame')
        return
      }
      
      // Send frame using Supabase channel broadcast
      console.log('📤 Broadcasting frame to channel:', `camera_frames_${this.sessionId}`)
      
      // Use the proper Supabase broadcast API
      const broadcastResult = await this.channel.send({
        type: 'broadcast',
        event: 'camera_frame',
        payload: {
          student_id: this.studentId,
          frame_data: frameData,
          timestamp: Date.now(),
          width: this.canvas.width,
          height: this.canvas.height
        }
      })
      
      console.log('📤 Broadcast result:', broadcastResult)

      console.log('📸 Frame sent successfully:', broadcastResult)
    } catch (error) {
      console.error('❌ Error capturing/sending frame:', error)
    }
  }

  private async sendStreamStatus(status: 'started' | 'ended') {
    try {
      if (!this.channel) {
        console.error('❌ No channel available for sending stream status')
        return
      }
      
      const result = await this.channel.send({
        type: 'broadcast', 
        event: 'stream_status',
        payload: {
          student_id: this.studentId,
          status,
          timestamp: Date.now()
        }
      })
      
      console.log('📺 Stream status broadcast result:', result)
    } catch (error) {
      console.error('❌ Error sending stream status:', error)
    }
  }
}

// Teacher-side frame receiver
export class CameraFrameReceiver {
  private channel: any
  private frameCallbacks = new Map<string, (frameData: string) => void>()

  constructor(private sessionId: string) {}

  startReceiving(onFrame: (studentId: string, frameData: string) => void) {
    console.log('👁️ Starting frame receiver for session:', this.sessionId)
    
    this.channel = supabase
      .channel(`camera_frames_${this.sessionId}`)
      .on('broadcast', { event: 'camera_frame' }, (payload) => {
        const { student_id, frame_data } = payload.payload
        console.log('📸 Teacher received frame from student:', student_id)
        onFrame(student_id, frame_data)
      })
      .on('broadcast', { event: 'stream_status' }, (payload) => {
        const { student_id, status } = payload.payload
        console.log('📺 Stream status update:', student_id, status)
      })
      .subscribe((status) => {
        console.log('📺 Channel subscription status:', status)
      })
  }

  stopReceiving() {
    if (this.channel) {
      console.log('🛑 Stopping frame receiver')
      this.channel.unsubscribe()
    }
  }
}
