// Nuclear camera shutdown utility for immediate camera turn-off
export function nuclearCameraShutdown() {
  console.log('💥 NUCLEAR CAMERA SHUTDOWN: Starting immediate shutdown...');
  
  try {
    // 1. Find and destroy ALL video elements on the page
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach((video, index) => {
      console.log(`💥 Destroying video element ${index}:`, (video as HTMLVideoElement).src || 'stream');
      
      if ((video as HTMLVideoElement).srcObject) {
        const stream = (video as HTMLVideoElement).srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('💥 NUCLEAR: Killed track:', track.kind, track.label);
        });
        (video as HTMLVideoElement).srcObject = null;
      }
      
      (video as HTMLVideoElement).src = '';
      (video as HTMLVideoElement).pause();
      (video as HTMLVideoElement).load();
      
      if (video.parentNode) {
        video.parentNode.removeChild(video);
        console.log('💥 NUCLEAR: Removed video element from DOM');
      }
    });
    
    // 2. Clear any getUserMedia streams that might still be active
    try {
      navigator.mediaDevices.getUserMedia({ video: false, audio: false }).catch(() => {
        console.log('💥 NUCLEAR: Permission reset attempted');
      });
    } catch {
      // Expected to fail, but forces browser to reconsider permissions
    }
    
    // 3. Try to clear any global media stream references
    const streamVars = ['localStream', 'cameraStream', 'mediaStream', 'videoStream'] as const;
    streamVars.forEach(varName => {
      try {
        const win = window as unknown as Record<string, unknown>;
        const stream = win[varName] as unknown as MediaStream | undefined;
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track: MediaStreamTrack) => {
            track.stop();
            console.log(`💥 NUCLEAR: Stopped global ${varName} track:`, track.kind);
          });
          (win as Record<string, unknown>)[varName] = null as unknown as undefined;
        }
      } catch {
        // Ignore errors for global vars that don't exist
      }
    });
    
    console.log('💥 NUCLEAR CAMERA SHUTDOWN: Complete - ALL camera resources destroyed');
    
  } catch (error) {
    console.error('💥 NUCLEAR SHUTDOWN ERROR:', error);
  }
}

// Emergency function to disable all cameras in a session via API
export async function emergencyDisableSessionCameras(sessionId: string) {
  try {
    const { supabase } = await import('@/lib/supabase');
    
    const { error } = await supabase
      .from('student_exam_attempts')
      .update({ camera_enabled: false })
      .eq('session_id', sessionId);
      
    if (error) throw error;
    
    console.log('💥 EMERGENCY: Disabled all cameras for session:', sessionId);
  } catch (error) {
    console.error('💥 EMERGENCY DISABLE FAILED:', error);
  }
}
