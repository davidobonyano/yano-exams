"use client";
import { useEffect, useRef, useState } from "react";

// Centralized RTC configuration (STUN/TURN)
// Removed unused rtcConfig and imports to satisfy lints

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
  const nuclearChannelRef = useRef<RTCDataChannel | null>(null);

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

        const cleanup = () => {
          console.log('🧹 Starting AGGRESSIVE WebRTC cleanup...');
          
          if (localStreamRef.current) {
            console.log('🛑 FORCE stopping all media tracks');
            localStreamRef.current.getTracks().forEach((track) => {
              console.log('🔴 Stopping track:', track.kind, track.label, 'enabled:', track.enabled, 'state:', track.readyState);
              track.stop();
              setTimeout(() => {
                console.log('🔍 Track state after stop:', track.kind, track.readyState);
              }, 100);
            });
            localStreamRef.current = null;
          }
          
          pcRef.current = null;
          nuclearChannelRef.current = null;
          
          setupRef.current = false;
          offerSentRef.current = false;
          setReady(false);
          
          if (onStreamStopped) {
            onStreamStopped();
          }
          
          console.log('✅ Student WebRTC AGGRESSIVELY cleaned up - camera should be OFF');
        };
        
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
  }, [studentId, onCleanupRef, onStreamReady, onStreamStopped]);

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
