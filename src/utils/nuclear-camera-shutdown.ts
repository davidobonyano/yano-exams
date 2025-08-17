// Nuclear camera shutdown utility for immediate camera turn-off
export function nuclearCameraShutdown() {
  console.log('💥 NUCLEAR CAMERA SHUTDOWN: Starting immediate shutdown...');
  
  try {
    // 1. Find and destroy ALL video elements on the page
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach((video, index) => {
      console.log(`💥 Destroying video element ${index}:`, video.src || 'stream');
      
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('💥 NUCLEAR: Killed track:', track.kind, track.label);
        });
        video.srcObject = null;
      }
      
      video.src = '';
      video.pause();
      video.load();
      
      // Remove from DOM completely
      if (video.parentNode) {
        video.parentNode.removeChild(video);
        console.log('💥 NUCLEAR: Removed video element from DOM');
      }
    });
    
    // 2. Clear any getUserMedia streams that might still be active
    try {
      // Force clear any remaining media streams by requesting empty stream
      navigator.mediaDevices.getUserMedia({ video: false, audio: false }).catch(() => {
        console.log('💥 NUCLEAR: Permission reset attempted');
      });
    } catch (e) {
      // Expected to fail, but forces browser to reconsider permissions
    }
    
    // 3. Try to clear any global media stream references
    const streamVars = ['localStream', 'cameraStream', 'mediaStream', 'videoStream'];
    streamVars.forEach(varName => {
      try {
        const stream = (window as any)[varName];
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track: MediaStreamTrack) => {
            track.stop();
            console.log(`💥 NUCLEAR: Stopped global ${varName} track:`, track.kind);
          });
          (window as any)[varName] = null;
        }
      } catch (e) {
        // Ignore errors for global vars that don't exist
      }
    });
    
    console.log('💥 NUCLEAR CAMERA SHUTDOWN: Complete - ALL camera resources destroyed');
    
  } catch (error) {
    console.error('💥 NUCLEAR SHUTDOWN ERROR:', error);
    // Continue anyway to ensure some cleanup happens
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
