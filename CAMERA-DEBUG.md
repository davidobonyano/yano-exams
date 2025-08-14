# Camera Feed Debugging Guide

## Steps to Test Camera Streaming

1. **Open Two Different Browsers**
   - Chrome for Student
   - Firefox/Edge for Teacher

2. **Student Side (Chrome)**
   - Go to student portal
   - Join exam session  
   - Grant camera access when prompted
   - Check browser console for these logs:
     ```
     📸 Starting frame capture streaming for session: [session-id]
     📺 Channel subscribed for streaming
     📸 Frame sent successfully: [result]
     ```

3. **Teacher Side (Firefox/Edge)**
   - Go to admin dashboard
   - Open Camera Monitor for the session
   - Check console for these logs:
     ```
     👁️ Starting frame receiver for session: [session-id]
     📺 Channel subscription status: SUBSCRIBED
     📸 Teacher received frame from student: [student-id]
     ```

## Troubleshooting

### If No Frames Appear:

1. **Check Console Logs** - Look for error messages
2. **Check Network Tab** - Verify Supabase websocket connections
3. **Verify Camera Access** - Make sure camera permission is granted
4. **Check Session Settings** - Ensure `camera_monitoring_enabled` is true

### Console Commands to Debug:

```javascript
// Check if video element is ready
const video = document.querySelector('video');
console.log('Video ready state:', video?.readyState);
console.log('Video dimensions:', video?.videoWidth, 'x', video?.videoHeight);

// Check Supabase connection
console.log('Supabase client:', supabase);
```

## Expected Flow:

1. Student grants camera → creates video element
2. Frame streaming starts → creates canvas, captures frames every 3s
3. Frames sent via Supabase realtime → broadcast events
4. Teacher receives frames → displays in StudentFrameDisplay component

## Key Files Modified:

- `src/lib/camera-streaming.ts` - Fixed channel subscription
- `src/components/exam/SessionExamInterface.tsx` - Async frame streaming
- `src/components/admin/CameraMonitor.tsx` - Enhanced logging
