import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'

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
      .single()

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

        <div style="margin: 30px 0; padding: 20px;  text-align: center;">
          <h3 style="margin: 0 0 10px 0; color: #000;">DETAILED RESULTS</h3>
          <p style="margin: 0 0 15px 0; color: #000;">
            For a complete question-by-question breakdown of your exam performance:
          </p>
          <a 
            href="https://yano-exams-o6re.vercel.app/admin/results/${resultData.student_exam_attempts?.id || resultData.attempt_id}" 
            style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border: 1px solid #000;"
          >
            📄 View Detailed Results
          </a>
        </div>

        <hr style="border: none; height: 1px; background-color: #000; margin: 30px 0;">
        
        <p style="color: #000; font-size: 12px; text-align: center;">
          This email was sent automatically by ${process.env.SCHOOL_NAME || 'School'} Examination System
        </p>
      </div>
    `

    // Send the email
    console.log('Sending email to:', email)
    const emailResult = await transporter.sendMail({
      from: `"${process.env.SCHOOL_NAME || 'School'}" <${process.env.SCHOOL_GMAIL_USER}>`,
      to: email,
      subject,
      html: htmlContent,
    })

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
