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

    // WebRTC live monitoring disabled: show message and no connection
    setStatus("Live monitoring disabled");

    return () => {
      setStatus("Idle");
      setIsConnecting(false);
    };
  }, [open]);

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

        <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm">
          Live WebRTC stream disabled
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          Live streaming is turned off. Use on-device camera framing only.
        </div>
      </div>
    </div>
  );
}
