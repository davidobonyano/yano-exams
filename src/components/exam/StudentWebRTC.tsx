"use client";
import { useEffect, useRef, useState } from "react";
import { signalingChannelFor } from "@/utils/signaling";
import { getRtcConfiguration } from "@/lib/rtcConfig";
import { supabase } from "@/lib/supabase";

// Centralized RTC configuration (STUN/TURN)
const rtcConfig: RTCConfiguration = getRtcConfiguration();

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
        // 1) Get camera only (no audio)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
          audio: false,
        });
        localStreamRef.current = stream;
        setReady(true);
        
        // Notify parent component that stream is ready
        if (onStreamReady) {
          onStreamReady(stream);
        }

        // 2) Disable WebRTC live streaming and signaling

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
          
          // No peer connections or channels in this mode
          
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
      {ready ? "Camera ready ✅" : "Preparing camera…"}
    </div>
  );
}
