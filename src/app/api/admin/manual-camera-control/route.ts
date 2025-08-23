import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { action, attemptId, sessionId } = await req.json()
    
    console.log('Manual camera control API called with:', { action, attemptId, sessionId })
    
    if (!action || (!attemptId && !sessionId)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create service role client to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let result

    if (action === 'disable_student' && attemptId) {
      // Disable camera for specific student
      const { data, error } = await supabase.rpc('manual_disable_student_camera', {
        p_attempt_id: attemptId
      })

      if (error) {
        console.error('Error disabling student camera:', error)
        return NextResponse.json(
          { error: 'Failed to disable camera' },
          { status: 500 }
        )
      }

      result = data
    } else if (action === 'disable_session' && sessionId) {
      // Disable all cameras in session
      const { data, error } = await supabase.rpc('manual_disable_session_cameras', {
        p_session_id: sessionId
      })

      if (error) {
        console.error('Error disabling session cameras:', error)
        return NextResponse.json(
          { error: 'Failed to disable cameras' },
          { status: 500 }
        )
      }

      result = data
    } else {
      return NextResponse.json(
        { error: 'Invalid action or missing parameters' },
        { status: 400 }
      )
    }

    console.log('Camera control result:', result)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in manual camera control:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
