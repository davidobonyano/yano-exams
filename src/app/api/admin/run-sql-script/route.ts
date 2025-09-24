import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface QuestionRow {
  id: string
  question_type: string
  question_text: string
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '')
    
    // Create Supabase client with the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // Check current database state
    const status: {
      fill_in_gap_available: boolean
      subjective_available: boolean
      existing_questions: QuestionRow[]
      recommendations: string[]
      database_status: 'checking' | 'fully_updated' | 'partially_updated' | 'needs_update'
    } = {
      fill_in_gap_available: false,
      subjective_available: false,
      existing_questions: [],
      recommendations: [],
      database_status: 'checking'
    }

    try {
      // Check if fill_in_gap type is available by trying to query it
      const { error: fillInGapError } = await supabase
        .from('questions')
        .select('question_type')
        .eq('question_type', 'fill_in_gap')
        .limit(1)
      
      // If no error, the type exists and is queryable
      status.fill_in_gap_available = !fillInGapError
      
      if (fillInGapError) {
        status.recommendations.push('fill_in_gap type not available or not queryable in database')
        console.log('fill_in_gap error:', fillInGapError)
      } else {
        console.log('fill_in_gap type is available and queryable')
      }
    } catch (e) {
      status.recommendations.push('Error testing fill_in_gap type')
      console.log('fill_in_gap exception:', e)
    }

    try {
      // Check if subjective type is available by trying to query it
      const { error: subjectiveError } = await supabase
        .from('questions')
        .select('question_type')
        .eq('question_type', 'subjective')
        .limit(1)
      
      // If no error, the type exists and is queryable
      status.subjective_available = !subjectiveError
      
      if (subjectiveError) {
        status.recommendations.push('subjective type not available or not queryable in database')
        console.log('subjective error:', subjectiveError)
      } else {
        console.log('subjective type is available and queryable')
      }
    } catch (e) {
      status.recommendations.push('Error testing subjective type')
      console.log('subjective exception:', e)
    }

    // Check existing questions with these types
    try {
      const { data: existingQuestions, error: existingError } = await supabase
        .from('questions')
        .select('id, question_type, question_text')
        .in('question_type', ['fill_in_gap', 'subjective'])
        .limit(10)
      
      if (!existingError && existingQuestions) {
        status.existing_questions = existingQuestions as QuestionRow[]
        console.log('Found existing questions with new types:', existingQuestions.length)
      }
    } catch (e) {
      status.recommendations.push('Error checking existing questions')
      console.log('existing questions exception:', e)
    }

    // Determine overall database status
    if (status.fill_in_gap_available && status.subjective_available) {
      status.database_status = 'fully_updated'
      status.recommendations.push('✅ Both new question types are available and working!')
    } else if (status.fill_in_gap_available || status.subjective_available) {
      status.database_status = 'partially_updated'
      status.recommendations.push('⚠️ Some question types are available, but not all')
      if (!status.fill_in_gap_available) {
        status.recommendations.push('fill_in_gap type needs to be added to database enum')
      }
      if (!status.subjective_available) {
        status.recommendations.push('subjective type needs to be added to database enum')
      }
    } else {
      status.database_status = 'needs_update'
      status.recommendations.push('❌ Database enum needs to be updated to include new question types')
      status.recommendations.push('Use Supabase dashboard SQL editor to run:')
      status.recommendations.push('ALTER TYPE question_type ADD VALUE \'fill_in_gap\';')
      status.recommendations.push('ALTER TYPE question_type ADD VALUE \'subjective\';')
    }

    if (status.existing_questions.length > 0) {
      status.recommendations.push(`📝 Found ${status.existing_questions.length} existing questions with new types`)
    }

    return NextResponse.json({ 
      success: true, 
      status,
      message: 'Database status checked successfully. Check status object for details.' 
    })

  } catch (error) {
    console.error('Error checking database status:', error)
    return NextResponse.json({ 
      error: 'Failed to check database status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
