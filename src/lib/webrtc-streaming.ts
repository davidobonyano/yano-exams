'use client'

import { supabase } from './supabase'

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-request'
  from: string
  to: string
  data: any
  timestamp: string
}

export class StudentWebRTC {
  public peerConnection: RTCPeerConnection
  public localStream: MediaStream | null = null
  private sessionId: string
  private studentId: string
  private signalChannel: any

  constructor(sessionId: string, studentId: string) {
    this.sessionId = sessionId
    this.studentId = studentId
    
    // Create peer connection with STUN servers for NAT traversal
    this.peerConnection = new RTCPeerConnection(getRtcConfiguration())

    // WebRTC disabled
  }

  private setupPeerConnection() {
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📡 Student sending ICE candidate')
        this.sendSignal({
          type: 'ice-candidate',
          from: this.studentId,
          to: 'teacher',
          data: event.candidate,
          timestamp: new Date().toISOString()
        })
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Student connection state:', this.peerConnection.connectionState)
    }
  }

  private setupSignaling() {
    // Listen for signaling messages from teacher
    this.signalChannel = supabase
      .channel(`webrtc_${this.sessionId}`)
      .on('broadcast', { event: 'signal' }, async (payload) => {
        const message = payload.payload as SignalingMessage
        
        if (message.to === this.studentId || message.to === 'all') {
          console.log('📨 Student received signal:', message.type, 'from', message.from)
          
          switch (message.type) {
            case 'call-request':
              await this.handleCallRequest()
              break
            case 'answer':
              await this.handleAnswer(message.data)
              break
            case 'ice-candidate':
              await this.handleIceCandidate(message.data)
              break
          }
        }
      })
      .subscribe()
  }

  async startCamera() {
    try {
      console.log('📹 Student starting camera (audio disabled)...')
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      })

      // WebRTC disabled: do not add tracks to any peer connection

      return this.localStream
    } catch (error) {
      console.error('❌ Student camera/mic access failed:', error)
      throw error
    }
  }

  private async handleCallRequest() {
    try {
      console.log('📞 Student handling call request from teacher')
      
      if (!this.localStream) {
        await this.startCamera()
      }

      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      })

      await this.peerConnection.setLocalDescription(offer)

      // Send offer to teacher
      this.sendSignal({
        type: 'offer',
        from: this.studentId,
        to: 'teacher',
        data: offer,
        timestamp: new Date().toISOString()
      })

      console.log('📤 Student sent offer to teacher')
    } catch (error) {
      console.error('❌ Student failed to create offer:', error)
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    try {
      console.log('📩 Student received answer from teacher')
      await this.peerConnection.setRemoteDescription(answer)
      console.log('✅ Student WebRTC connection established')
    } catch (error) {
      console.error('❌ Student failed to handle answer:', error)
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      await this.peerConnection.addIceCandidate(candidate)
      console.log('🧊 Student added ICE candidate')
    } catch (error) {
      console.error('❌ Student failed to add ICE candidate:', error)
    }
  }

  private sendSignal(message: SignalingMessage) {
    this.signalChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: message
    })
  }

  destroy() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
    }
    this.peerConnection.close()
    this.signalChannel.unsubscribe()
  }
}

export class TeacherWebRTCNew {
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private sessionId: string
  private teacherId: string
  private signalChannel: any
  public onStudentStreamReceived?: (studentId: string, stream: MediaStream) => void
  public onConnectionStateChange?: (studentId: string, state: string) => void

  constructor(sessionId: string, teacherId: string) {
    this.sessionId = sessionId
    this.teacherId = teacherId
    this.setupSignaling()
  }

  private setupSignaling() {
    // Listen for signaling messages from students
    this.signalChannel = supabase
      .channel(`webrtc_${this.sessionId}`)
      .on('broadcast', { event: 'signal' }, async (payload) => {
        const message = payload.payload as SignalingMessage
        
        if (message.to === 'teacher') {
          console.log('📨 Teacher received signal:', message.type, 'from', message.from)
          
          switch (message.type) {
            case 'offer':
              await this.handleOffer(message.from, message.data)
              break
            case 'ice-candidate':
              await this.handleIceCandidate(message.from, message.data)
              break
          }
        }
      })
      .subscribe()
  }

  async requestCallFromStudent(studentId: string) {
    console.log('📞 Teacher requesting call from student:', studentId)
    
    this.sendSignal({
      type: 'call-request',
      from: 'teacher',
      to: studentId,
      data: null,
      timestamp: new Date().toISOString()
    })
  }

  private async handleOffer(studentId: string, offer: RTCSessionDescriptionInit) {
    try {
      console.log('📩 Teacher received offer from student:', studentId)
      
      // Create new peer connection for this student
      const peerConnection = new RTCPeerConnection(getRtcConfiguration())

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        console.log('🎥 Teacher received track from student:', studentId, event.track.kind)
        const stream = event.streams[0]
        if (stream && this.onStudentStreamReceived) {
          this.onStudentStreamReceived(studentId, stream)
        }
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('📡 Teacher sending ICE candidate to student:', studentId)
          this.sendSignal({
            type: 'ice-candidate',
            from: 'teacher',
            to: studentId,
            data: event.candidate,
            timestamp: new Date().toISOString()
          })
        }
      }

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState
        console.log(`🔗 Teacher connection state with ${studentId}:`, state)
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(studentId, state)
        }
      }

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(offer)
      
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)

      // Send answer back to student
      this.sendSignal({
        type: 'answer',
        from: 'teacher',
        to: studentId,
        data: answer,
        timestamp: new Date().toISOString()
      })

      // Store the peer connection
      this.peerConnections.set(studentId, peerConnection)
      
      console.log('✅ Teacher sent answer to student:', studentId)
    } catch (error) {
      console.error('❌ Teacher failed to handle offer from student:', studentId, error)
    }
  }

  private async handleIceCandidate(studentId: string, candidate: RTCIceCandidateInit) {
    try {
      const peerConnection = this.peerConnections.get(studentId)
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate)
        console.log('🧊 Teacher added ICE candidate for student:', studentId)
      }
    } catch (error) {
      console.error('❌ Teacher failed to add ICE candidate for student:', studentId, error)
    }
  }

  private sendSignal(message: SignalingMessage) {
    this.signalChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: message
    })
  }

  destroy() {
    this.peerConnections.forEach((pc, studentId) => {
      console.log('🔥 Closing peer connection for student:', studentId)
      pc.close()
    })
    this.peerConnections.clear()
    this.signalChannel.unsubscribe()
  }
}
