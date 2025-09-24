import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { generateResultsPDF } from '@/lib/pdf-generator'
import { getDetailedStudentResults } from '@/lib/auto-scoring'
import { Exam, StudentExamAttempt, ExamResult } from '@/types/database-v2'

interface ResultRow {
  id: string
  correct_answers: number
  total_questions: number
  percentage_score: number
  passed: boolean
  created_at: string
  students: {
    full_name: string
    student_id: string
    class_level: string
  }
  exams: {
    title: string
  }
  exam_sessions: {
    session_name: string
    session_code: string
    teacher_id: string
  }
  student_exam_attempts: {
    id: string
  } | null
  attempt_id?: string
}

export async function POST(req: NextRequest) {
  try {
    const { resultId, email, studentName } = await req.json()
    
    console.log('Email API called with:', { resultId, email, studentName })
    
    if (!resultId || !email || !studentName) {
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

    // Check environment variables
    console.log('Email env vars:', {
      user: process.env.SCHOOL_GMAIL_USER,
      passExists: !!process.env.SCHOOL_GMAIL_APP_PASSWORD,
      schoolName: process.env.SCHOOL_NAME
    })

    // Get the detailed result data for the email
    const { data: resultData, error: resultError } = await supabase
      .from('exam_results')
      .select(`
        *,
        students (
          full_name,
          student_id,
          class_level
        ),
        exams (
          title
        ),
        exam_sessions (
          session_name,
          session_code,
          teacher_id
        ),
        student_exam_attempts (
          id
        )
      `)
      .eq('id', resultId)
      .single<ResultRow>()

    console.log('Result data:', { resultData, resultError })

    if (resultError || !resultData) {
      console.log('Result not found error:', resultError)
      return NextResponse.json(
        { error: 'Result not found' },
        { status: 404 }
      )
    }

    // Create email transporter with better error handling
    console.log('Creating email transporter...')
    
    if (!process.env.SCHOOL_GMAIL_USER || !process.env.SCHOOL_GMAIL_APP_PASSWORD) {
      console.error('Missing Gmail credentials')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      )
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SCHOOL_GMAIL_USER,
        pass: process.env.SCHOOL_GMAIL_APP_PASSWORD,
      },
    })

    console.log('Testing transporter connection...')
    try {
      await transporter.verify()
      console.log('SMTP connection verified successfully')
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError)
      throw new Error('Gmail authentication failed. Please check credentials.')
    }

    // Generate PDF attachment
    console.log('Generating PDF attachment...')
    const attemptId = resultData.student_exam_attempts?.id || resultData.attempt_id
    console.log('Attempt ID for PDF:', attemptId)
    
    // Get detailed results for PDF
    const detailedResults = await getDetailedStudentResults(attemptId!)
    console.log('Detailed results for PDF:', { 
      success: detailedResults?.success, 
      hasAttemptInfo: !!detailedResults?.attempt_info,
      error: detailedResults?.error 
    })
    
    let pdfBuffer: Buffer | null = null
    let filename = `exam_results_${studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
    
    if (detailedResults?.success) {
      const attemptInfo = detailedResults.attempt_info!
      
      // Create data objects for PDF generation
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

      const result: ExamResult = {
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

      try {
        console.log('Starting PDF generation with data:', {
          examTitle: exam.title,
          studentName: attemptInfo.student_name,
          sessionCode: attemptInfo.session_code || resultData.exam_sessions.session_code
        })
        
        const pdf = await generateResultsPDF({
          exam,
          attempt,
          result,
          studentName: attemptInfo.student_name,
          sessionCode: attemptInfo.session_code || resultData.exam_sessions.session_code
        })

        pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
        filename = `${exam.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_detailed_results_${studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
        console.log('PDF generated successfully for attachment, buffer size:', pdfBuffer.length)
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError)
        console.error('PDF Error stack:', pdfError instanceof Error ? pdfError.stack : 'No stack')
        // Continue without PDF attachment
      }
    } else {
      console.log('⚠️ Detailed results failed, skipping PDF generation:', {
        success: detailedResults?.success,
        error: detailedResults?.error
      })
    }

    // Create email content
    const subject = `Exam Results - ${resultData.exams.title}`
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000;">
        <h1 style="color: #000; padding-bottom: 10px; text-align: center;">
          EXAM RESULTS
        </h1>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td colspan="2" style="border: 1px solid #000; padding: 10px; background-color: #f9f9f9;">
              <strong>STUDENT INFORMATION</strong>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px; width: 30%;"><strong>Name:</strong></td>
            <td style="border: 1px solid #000; padding: 8px;">${resultData.students.full_name}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px;"><strong>Student ID:</strong></td>
            <td style="border: 1px solid #000; padding: 8px;">${resultData.students.student_id}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px;"><strong>Class:</strong></td>
            <td style="border: 1px solid #000; padding: 8px;">${resultData.students.class_level}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="border: 1px solid #000; padding: 8px; width: 30%;"><strong>Exam:</strong></td>
            <td style="border: 1px solid #000; padding: 8px;">${resultData.exams.title}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px;"><strong>Session Code:</strong></td>
            <td style="border: 1px solid #000; padding: 8px;">${resultData.exam_sessions.session_code}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px;"><strong>Score:</strong></td>
            <td style="border: 1px solid #000; padding: 8px;">${resultData.correct_answers}/${resultData.total_questions}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px;"><strong>Percentage:</strong></td>
            <td style="border: 1px solid #000; padding: 8px;">${resultData.percentage_score.toFixed(1)}%</td>
          </tr>
         
          <tr>
            <td style="border: 1px solid #000; padding: 8px;"><strong>Status:</strong></td>
            <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">
              ${resultData.passed ? 'PASSED' : 'FAILED'}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px;"><strong>Date:</strong></td>
            <td style="border: 1px solid #000; padding: 8px;">${new Date(resultData.created_at).toLocaleDateString()}</td>
          </tr>
        </table>

        <div style="margin: 30px 0; padding: 20px; text-align: center;">
          <h3 style="margin: 0 0 10px 0; color: #000;">DETAILED RESULTS</h3>
          <p style="margin: 0 0 15px 0; color: #000;">
            Your detailed question-by-question breakdown is attached as a PDF file to this email.
          </p>
        </div>

        <hr style="border: none; height: 1px; background-color: #000; margin: 30px 0;">
        
        <p style="color: #000; font-size: 12px; text-align: center;">
          This email was sent automatically by ${process.env.SCHOOL_NAME || 'School'} Examination System
        </p>
      </div>
    `

    // Prepare email options
    const emailOptions: nodemailer.SendMailOptions = {
      from: `"${process.env.SCHOOL_NAME || 'School'}" <${process.env.SCHOOL_GMAIL_USER}>`,
      to: email,
      subject,
      html: htmlContent,
    }

    // Add PDF attachment if generated successfully
    if (pdfBuffer) {
      emailOptions.attachments = [{
        filename: filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
      console.log('✅ PDF attachment added to email:', filename, 'Size:', pdfBuffer.length)
    } else {
      console.log('❌ No PDF buffer available - email will be sent without PDF attachment')
    }

    // Send the email
    console.log('Sending email to:', email)
    const emailResult = await transporter.sendMail(emailOptions)

    console.log('Email sent successfully:', emailResult.messageId)

    return NextResponse.json({ 
      success: true, 
      message: `Result email sent to ${email}` 
    })

  } catch (error) {
    console.error('Email sending error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
