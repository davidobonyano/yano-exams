import { supabase } from './supabase'

export interface WebRTCOffer {
  id: string
  session_id: string
  student_id: string
  teacher_id: string
  offer_data: RTCSessionDescriptionInit
  answer_data?: RTCSessionDescriptionInit
  ice_candidates: RTCIceCandidateInit[]
  status: 'pending' | 'connected' | 'failed'
  created_at: string
}

export class StudentWebRTC {
  private peerConnection: RTCPeerConnection
  private localStream: MediaStream | null = null
  private sessionId: string
  private studentId: string
  private teacherId: string
  private channel: ReturnType<typeof supabase.channel> | null = null

  constructor(sessionId: string, studentId: string, teacherId: string) {
    this.sessionId = sessionId
    this.studentId = studentId
    this.teacherId = teacherId
    
    // Create peer connection with free STUN servers
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })

    this.setupPeerConnection()
  }

  private setupPeerConnection() {
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(event.candidate)
      }
    }

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState)
    }
  }

  async startStreaming(stream: MediaStream) {
    this.localStream = stream
    
    // Add stream to peer connection
    stream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, stream)
    })

    // Create offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false
    })
    
    await this.peerConnection.setLocalDescription(offer)

    // Store offer in database
    const { error } = await supabase
      .from('webrtc_offers')
      .insert([{
        session_id: this.sessionId,
        student_id: this.studentId,
        teacher_id: this.teacherId,
        offer_data: offer,
        status: 'pending'
      }])

    if (error) {
      console.error('Error storing WebRTC offer:', error)
      console.error('Make sure to run the WebRTC database migration first')
      // Don't throw error, continue without database signaling for now
      return
    }

    // Listen for answers
    this.setupSignaling()
  }

  private setupSignaling() {
    this.channel = supabase
      .channel(`webrtc_${this.sessionId}_${this.studentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'webrtc_offers',
          filter: `student_id=eq.${this.studentId}`
        },
        async (payload) => {
          const offer = payload.new as WebRTCOffer
          if (offer.answer_data && !this.peerConnection.remoteDescription) {
            await this.peerConnection.setRemoteDescription(offer.answer_data)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_ice_candidates',
          filter: `student_id=eq.${this.studentId}`
        },
        async (payload) => {
          const candidate = payload.new
          if (candidate.candidate_data) {
            await this.peerConnection.addIceCandidate(candidate.candidate_data)
          }
        }
      )
      .subscribe()
  }

  private async sendIceCandidate(candidate: RTCIceCandidate) {
    const { error } = await supabase
      .from('webrtc_ice_candidates')
      .insert([{
        session_id: this.sessionId,
        student_id: this.studentId,
        teacher_id: this.teacherId,
        candidate_data: candidate.toJSON()
      }])
    
    if (error) {
      console.error('Error storing ICE candidate:', error)
    }
  }

  destroy() {
    if (this.channel) {
      this.channel.unsubscribe()
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
    }
    this.peerConnection.close()
  }
}

export class TeacherWebRTC {
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private remoteStreams: Map<string, MediaStream> = new Map()
  private sessionId: string
  private teacherId: string
  private channel: ReturnType<typeof supabase.channel> | null = null
  
  // Callback for when student stream is received
  onStudentStreamReceived?: (studentId: string, stream: MediaStream) => void

  constructor(sessionId: string, teacherId: string) {
    this.sessionId = sessionId
    this.teacherId = teacherId
    this.setupSignaling()
  }

  private setupSignaling() {
    this.channel = supabase
      .channel(`webrtc_teacher_${this.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_offers',
          filter: `session_id=eq.${this.sessionId}`
        },
        async (payload) => {
          const offer = payload.new as WebRTCOffer
          await this.handleStudentOffer(offer)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_ice_candidates',
          filter: `session_id=eq.${this.sessionId}`
        },
        async (payload) => {
          const candidate = payload.new
          await this.handleIceCandidate(candidate as { student_id: string; candidate_data?: RTCIceCandidate })
        }
      )
      .subscribe()
  }

  private async handleStudentOffer(offer: WebRTCOffer) {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams
      this.remoteStreams.set(offer.student_id, remoteStream)
      
      // Trigger callback for UI update
      if (this.onStudentStreamReceived) {
        this.onStudentStreamReceived(offer.student_id, remoteStream)
      }
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(offer.student_id, event.candidate)
      }
    }

    // Set remote description (student's offer)
    await peerConnection.setRemoteDescription(offer.offer_data)

    // Create answer
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    // Store answer in database
    await supabase
      .from('webrtc_offers')
      .update({ answer_data: answer })
      .eq('id', offer.id)

    this.peerConnections.set(offer.student_id, peerConnection)
  }

  private async handleIceCandidate(candidate: { student_id: string; candidate_data?: RTCIceCandidate }) {
    const peerConnection = this.peerConnections.get(candidate.student_id)
    if (peerConnection && candidate.candidate_data) {
      await peerConnection.addIceCandidate(candidate.candidate_data)
    }
  }

  private async sendIceCandidate(studentId: string, candidate: RTCIceCandidate) {
    await supabase
      .from('webrtc_ice_candidates')
      .insert([{
        session_id: this.sessionId,
        student_id: studentId,
        teacher_id: this.teacherId,
        candidate_data: candidate.toJSON(),
        direction: 'teacher_to_student'
      }])
  }

  getStudentStream(studentId: string): MediaStream | null {
    return this.remoteStreams.get(studentId) || null
  }

  destroy() {
    if (this.channel) {
      this.channel.unsubscribe()
    }
    this.peerConnections.forEach(pc => pc.close())
    this.peerConnections.clear()
    this.remoteStreams.clear()
  }
}