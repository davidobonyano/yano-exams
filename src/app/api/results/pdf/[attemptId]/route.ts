import { NextRequest, NextResponse } from 'next/server'
import { generateResultsPDF } from '@/lib/pdf-generator'
import { getDetailedStudentResults } from '@/lib/auto-scoring'
import { Exam, StudentExamAttempt } from '@/types/database-v2'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params

    if (!attemptId) {
      return NextResponse.json(
        { error: 'Attempt ID is required' },
        { status: 400 }
      )
    }

    const detailedResults = await getDetailedStudentResults(attemptId)
    
    if (!detailedResults?.success) {
      return NextResponse.json(
        { error: 'Results not found' },
        { status: 404 }
      )
    }

    const attemptInfo = detailedResults.attempt_info

    const exam: Exam = {
      id: attemptInfo.exam_id,
      title: attemptInfo.exam_title,
      total_questions: attemptInfo.total_questions,
      passing_score: attemptInfo.passing_score,
      duration_minutes: 0,
      class_level: 'JSS1',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      description: undefined,
      created_by: undefined,
    }

    const attempt: StudentExamAttempt = {
      id: attemptInfo.attempt_id,
      student_id: attemptInfo.student_id,
      exam_id: attemptInfo.exam_id,
      session_id: attemptInfo.session_id,
      status: 'completed',
      started_at: attemptInfo.started_at,
      completed_at: attemptInfo.completed_at,
      submitted_at: attemptInfo.submitted_at,
      is_paused: false,
      created_at: new Date().toISOString()
    }

    const result = {
      id: attemptInfo.attempt_id,
      attempt_id: attemptInfo.attempt_id,
      student_id: attemptInfo.student_id,
      session_id: attemptInfo.session_id,
      exam_id: attemptInfo.exam_id,
      total_questions: attemptInfo.total_questions,
      correct_answers: attemptInfo.correct_answers,
      total_points: attemptInfo.total_points,
      points_earned: attemptInfo.points_earned,
      percentage_score: attemptInfo.percentage_score,
      passed: attemptInfo.passed,
      created_at: new Date().toISOString()
    }

    const pdf = await generateResultsPDF({
      exam,
      attempt,
      result,
      studentName: attemptInfo.student_name,
      sessionCode: attemptInfo.session_code || 'Unknown Session'
    })

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
    
    const filename = `${exam.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results_${attemptInfo.student_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache'
      }
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
