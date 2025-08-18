"use client";
import { useEffect, useRef, useState } from "react";
import { signalingChannelFor } from "@/utils/signaling";
import { supabase } from "@/lib/supabase";

// Optional: add your own TURN if you have one
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // free STUN
    // { urls: "turn:YOUR_TURN_HOST", username: "...", credential: "..." },
  ],
};

interface StudentWebRTCProps {
  studentId: string;
  onStreamReady?: (stream: MediaStream) => void;
  onCleanupRef?: (cleanupFn: () => void) => void;
  onStreamStopped?: () => void;
}

export default function StudentWebRTC({ studentId, onStreamReady, onCleanupRef, onStreamStopped }: StudentWebRTCProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setupRef = useRef(false);
  const offerSentRef = useRef(false);
  const nuclearChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!studentId) return;
    
    const setup = async () => {
      if (setupRef.current) {
        console.log('WebRTC already setting up, skipping');
        return;
      }
      
      setupRef.current = true;
      setError(null);
      
      try {
        // 1) Get camera + mic
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        localStreamRef.current = stream;
        setReady(true);
        
        // Notify parent component that stream is ready
        if (onStreamReady) {
          onStreamReady(stream);
        }

        // 2) Set up peer connection
        const pc = new RTCPeerConnection(rtcConfig);
        pcRef.current = pc;
        
        // Monitor connection state changes
        pc.onconnectionstatechange = () => {
          console.log('🔗 Student connection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            console.log('✅ WebRTC connection established with teacher');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.log('⚠️ WebRTC connection lost, resetting offer flag');
            offerSentRef.current = false; // Allow new offers when connection is lost
          }
        };

        // Send tracks to teacher
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // 3) ICE Candidates from student → teacher
        const chan = signalingChannelFor(studentId);
        
        // Listen for nuclear camera shutdown notifications
        nuclearChannelRef.current = supabase
          .channel('camera-nuclear-shutdown')
          .on('broadcast', { event: 'camera_nuclear_shutdown' }, (payload) => {
            console.log('💥 NUCLEAR CAMERA SHUTDOWN RECEIVED:', payload);
            if (payload.payload.student_id === studentId) {
              console.log('💥 NUCLEAR SHUTDOWN - Force cleaning up camera immediately');
              cleanup();
              onStreamStopped?.();
            }
          })
          .subscribe();
          
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            chan.send({
              type: "broadcast",
              event: "student-ice",
              payload: { candidate: e.candidate },
            });
          }
        };

        // 4) Listen for teacher "call-start" to generate & send OFFER
        chan
          .on("broadcast", { event: "call-start" }, async () => {
            try {
              // Only create offer if we're in stable state
              if (pc.signalingState !== 'stable') {
                console.log('⚠️ Ignoring call-start - connection not ready:', pc.signalingState);
                return;
              }
              
              // Reset flag for new offer attempt
              offerSentRef.current = false;
              
              const offer = await pc.createOffer({ 
                offerToReceiveAudio: false, 
                offerToReceiveVideo: false 
              });
              await pc.setLocalDescription(offer);
              
              offerSentRef.current = true;
              
              chan.send({
                type: "broadcast",
                event: "student-offer",
                payload: { sdp: offer.sdp, type: offer.type },
              });
              console.log('✅ Student sent offer to teacher');
            } catch (error) {
              console.error('❌ Student failed to create offer:', error);
              offerSentRef.current = false; // Reset on error so we can try again
            }
          })
          // 5) Teacher ANSWER → setRemoteDescription
          .on("broadcast", { event: "teacher-answer" }, async ({ payload }) => {
            try {
              // Only process answer if we're expecting one
              if (pc.signalingState !== 'have-local-offer') {
                console.log('⚠️ Student ignoring answer - wrong state:', pc.signalingState);
                return;
              }
              
              const answer = new RTCSessionDescription(payload);
              await pc.setRemoteDescription(answer);
              console.log('✅ Student received answer from teacher');
            } catch (error) {
              console.error('❌ Student failed to set remote description:', error);
            }
          })
          // 6) Teacher ICE → addIceCandidate
          .on("broadcast", { event: "teacher-ice" }, async ({ payload }) => {
            try {
              await pc.addIceCandidate(payload.candidate);
            } catch {}
          })
          .subscribe();

        const cleanup = () => {
          console.log('🧹 Starting AGGRESSIVE WebRTC cleanup...');
          
          // FORCE stop all media tracks immediately
          if (localStreamRef.current) {
            console.log('🛑 FORCE stopping all media tracks');
            localStreamRef.current.getTracks().forEach((track) => {
              console.log('🔴 Stopping track:', track.kind, track.label, 'enabled:', track.enabled, 'state:', track.readyState);
              track.stop();
              // Double-check it's really stopped
              setTimeout(() => {
                console.log('🔍 Track state after stop:', track.kind, track.readyState);
              }, 100);
            });
            localStreamRef.current = null;
          }
          
          // Close peer connection with all senders
          if (pcRef.current) {
            console.log('🔴 Closing peer connection and stopping senders');
            pcRef.current.getSenders().forEach(sender => {
              if (sender.track) {
                sender.track.stop();
                console.log('🛑 Stopped sender track:', sender.track.kind);
              }
            });
            pcRef.current.close();
            pcRef.current = null;
          }
          
          // Unsubscribe from channels
          chan.unsubscribe();
          if (nuclearChannelRef.current) {
            nuclearChannelRef.current.unsubscribe();
            nuclearChannelRef.current = null;
          }
          
          // Reset all flags
          setupRef.current = false;
          offerSentRef.current = false;
          setReady(false);
          
          // Notify parent that stream stopped
          if (onStreamStopped) {
            onStreamStopped();
          }
          
          console.log('✅ Student WebRTC AGGRESSIVELY cleaned up - camera should be OFF');
        };
        
        // Provide cleanup function to parent
        if (onCleanupRef) {
          onCleanupRef(cleanup);
        }
        
        return cleanup;
      } catch (error) {
        console.error('❌ Student WebRTC setup failed:', error);
        setError(error instanceof Error ? error.message : 'WebRTC setup failed');
        setupRef.current = false;
      }
    };

    setup();
  }, [studentId]);

  if (error) {
    return (
      <div className="text-sm text-red-600">
        WebRTC Error: {error}
      </div>
    );
  }

  return (
    <div className="text-sm">
      {ready ? "Camera & mic ready ✅" : "Preparing camera & mic…"}
    </div>
  );
}
