"use client";
import { useEffect, useRef, useState } from "react";
import { signalingChannelFor } from "@/utils/signaling";

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    // { urls: "turn:YOUR_TURN_HOST", username: "...", credential: "..." },
  ],
};

export default function TeacherStudentModal({
  studentId,
  studentName,
  open,
  onClose,
}: {
  studentId: string;
  studentName: string;
  open: boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const [status, setStatus] = useState("Idle");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const start = async () => {
      if (isConnecting) {
        console.log('⚠️ Already connecting, ignoring duplicate start');
        return;
      }
      
      setIsConnecting(true);
      setStatus("Connecting…");
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      // Remote stream from student → attach to video
      const remoteStream = new MediaStream();
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
      }
      pc.ontrack = (e) => {
        console.log('🎥 Teacher received track:', e.track.kind);
        e.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
        setStatus("Streaming");
        setIsConnecting(false);
      };

      // Teacher ICE → to student
      const chan = signalingChannelFor(studentId);
      channelRef.current = chan;
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          chan.send({
            type: "broadcast",
            event: "teacher-ice",
            payload: { candidate: e.candidate },
          });
        }
      };

      // Receive STUDENT OFFER → create ANSWER
      chan
      .on("broadcast", { event: "student-offer" }, async ({ payload }) => {
      try {
        // Only process if we're in the right state
        if (pc.signalingState !== 'stable') {
          console.log('⚠️ Ignoring offer - connection not in stable state:', pc.signalingState);
          return;
      }
      
      const offer = new RTCSessionDescription(payload);
        await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              chan.send({
                type: "broadcast",
                event: "teacher-answer",
                payload: { sdp: answer.sdp, type: answer.type },
              });
              console.log('✅ Teacher sent answer to student');
            } catch (error) {
              console.error('❌ Teacher failed to handle offer:', error);
            }
          })
        // Student ICE → add
        .on("broadcast", { event: "student-ice" }, async ({ payload }) => {
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {}
        })
        .subscribe();

      // Kick off the call
      chan.send({ type: "broadcast", event: "call-start", payload: {} });

      // Autoplay policy: play after metadata loads
      videoRef.current?.addEventListener("loadedmetadata", () => {
        videoRef.current?.play().catch(() => {});
      });
    };

    start();

    return () => {
      const pc = pcRef.current;
      pc?.getSenders().forEach((s) => s.track?.stop());
      pc?.close();
      pcRef.current = null;
      
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      
      setStatus("Idle");
      setIsConnecting(false);
    };
  }, [open, studentId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="max-w-4xl mx-auto bg-white rounded-xl p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold">Monitoring {studentName}</h3>
            <p className="text-sm text-gray-500">ID: {studentId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{status}</span>
            <button
              className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <video
          ref={videoRef}
          playsInline
          // don't set muted here— you want to HEAR the student
          autoPlay
          className="w-full aspect-video bg-black rounded-lg"
          controls={false}
        />

        <div className="mt-4 text-center text-sm text-gray-500">
          Live video and audio from student
        </div>
      </div>
    </div>
  );
}
