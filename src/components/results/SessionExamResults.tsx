'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '@/context/SimpleSessionContext'
import { supabase } from '@/lib/supabase'
import { Exam, Question, StudentExamAttempt, StudentAnswer, ExamResult } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Award, Download, Eye, EyeOff, CheckCircle, XCircle, Clock, User, FileText, ArrowLeft, Trophy, Target, Calendar, Timer } from 'lucide-react'
import ResultsBlocked from './ResultsBlocked'
import { generateResultsPDF, downloadPDF } from '@/lib/pdf-generator'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface SessionExamResultsProps {
  attemptId: string
}

interface QuestionWithAnswer extends Question {
  userAnswer?: StudentAnswer
  isCorrect: boolean
}

export default function SessionExamResults({ attemptId }: SessionExamResultsProps) {
  const router = useRouter()
  const { session, clearSession } = useSession()
  const [exam, setExam] = useState<Exam | null>(null)
  const [attempt, setAttempt] = useState<StudentExamAttempt | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([])
  const [studentInfo, setStudentInfo] = useState<any>(null)
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnswers, setShowAnswers] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [autoReturnCountdown, setAutoReturnCountdown] = useState(30)
  const [autoReturnActive, setAutoReturnActive] = useState(true)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadResults()
  }, [attemptId])

  // Auto-return countdown
  useEffect(() => {
    if (!loading && !error && autoReturnActive) {
      countdownIntervalRef.current = setInterval(() => {
        setAutoReturnCountdown(prev => {
          if (prev <= 1) {
            // Time's up, redirect to dashboard
            // Use setTimeout to avoid updating during render
            setTimeout(() => {
              router.push('/dashboard')
            }, 0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [loading, error, autoReturnActive, router])

  const cancelAutoReturn = () => {
    setAutoReturnActive(false)
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
  }

  const returnToDashboard = () => {
    // Navigate to dashboard (keeping session data for dashboard display)
    router.push('/dashboard')
  }

  const loadResults = async () => {
    try {
      setLoading(true)

      // Fetch attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from('student_exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .single()

      if (attemptError) throw attemptError

      setAttempt(attemptData)

      // Fetch exam
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', attemptData.exam_id)
        .single()

      if (examError) throw examError
      setExam(examData)

      // Fetch student information
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', attemptData.student_id)
        .single()

      if (studentError) {
        console.error('Error fetching student:', studentError)
      } else {
        setStudentInfo(studentData)
      }

      // Fetch session information
      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('id', attemptData.session_id)
        .single()

      if (sessionError) {
        console.error('Error fetching session:', sessionError)
      } else {
        setSessionInfo(sessionData)
      }

      // Check if results already exist and if student is allowed to see them
      const { data: existingResult, error: resultError } = await supabase
        .from('exam_results')
        .select('*, exam_sessions!inner(allow_student_results_view)')
        .eq('attempt_id', attemptId)
        .single()

      if (resultError && resultError.code !== 'PGRST116') {
        throw resultError
      }

      // Check if this is a student trying to access results
      if (session && existingResult && !existingResult.results_visible_to_student) {
        // Show blocked results page instead of error
        setError('RESULTS_BLOCKED')
        return
      }

      if (existingResult) {
        setResult(existingResult)
        await loadQuestionsWithAnswers(attemptData.exam_id, attemptId)
      } else {
        // Calculate and save results (but don't make them visible to students by default)
        await calculateResults(attemptData, examData)
      }

    } catch (err: any) {
      console.error('Error loading results:', err)
      setError(err.message || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const loadQuestionsWithAnswers = async (examId: string, attemptId: string) => {
    try {
      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at')

      if (questionsError) throw questionsError

      // Fetch user answers
      const { data: answersData, error: answersError } = await supabase
        .from('student_answers')
        .select('*')
        .eq('attempt_id', attemptId)

      if (answersError) throw answersError

      // Combine questions with answers
      const questionsWithAnswers: QuestionWithAnswer[] = questionsData.map(question => {
        const userAnswer = answersData.find(answer => answer.question_id === question.id)
        const isCorrect = userAnswer ? (userAnswer.is_correct || false) : false

        return {
          ...question,
          userAnswer,
          isCorrect
        }
      })

      setQuestions(questionsWithAnswers)
    } catch (err) {
      console.error('Error loading questions with answers:', err)
    }
  }

  const calculateResults = async (attempt: StudentExamAttempt, exam: Exam) => {
    try {
      // Fetch all questions and answers for this attempt
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', exam.id)

      if (questionsError) throw questionsError

      const { data: answersData, error: answersError } = await supabase
        .from('student_answers')
        .select('*')
        .eq('attempt_id', attempt.id)

      if (answersError) throw answersError

      // Calculate scores
      let correctAnswers = 0
      let totalPoints = 0
      let pointsEarned = 0

      const updatedAnswers = []

      for (const question of questionsData) {
        const userAnswer = answersData.find(answer => answer.question_id === question.id)
        totalPoints += question.points

        if (userAnswer) {
          // Use the already calculated is_correct value, or calculate if not available
          const isCorrect = userAnswer.is_correct !== null ? userAnswer.is_correct : (userAnswer.answer === question.correct_answer)
          const points = isCorrect ? question.points : 0

          if (isCorrect) correctAnswers++
          pointsEarned += points

          // Update answer with correctness and points only if not already set
          if (userAnswer.is_correct === null) {
            updatedAnswers.push({
              id: userAnswer.id,
              is_correct: isCorrect,
              points_earned: points
            })
          }
        }
      }

      // Update student answers with correctness and points
      for (const answer of updatedAnswers) {
        await supabase
          .from('student_answers')
          .update({
            is_correct: answer.is_correct,
            points_earned: answer.points_earned
          })
          .eq('id', answer.id)
      }

      const percentageScore = totalPoints > 0 ? (pointsEarned / totalPoints) * 100 : 0
      const passed = percentageScore >= exam.passing_score

      // Save exam result with UPSERT to handle duplicates (hidden from students by default)
      const { data: resultData, error: resultError } = await supabase
        .from('exam_results')
        .upsert([{
          attempt_id: attempt.id,
          student_id: attempt.student_id,
          session_id: attempt.session_id,
          exam_id: exam.id,
          total_questions: questionsData.length,
          correct_answers: correctAnswers,
          total_points: totalPoints,
          points_earned: pointsEarned,
          percentage_score: percentageScore,
          passed: passed,
          results_visible_to_student: false, // Hidden by default
          teacher_can_email_results: true
        }], {
          onConflict: 'attempt_id'
        })
        .select()
        .single()

      if (resultError) throw resultError

      setResult(resultData)
      await loadQuestionsWithAnswers(exam.id, attempt.id)

    } catch (err: any) {
      console.error('Error calculating results:', err)
      setError(err.message || 'Failed to calculate results')
    }
  }

  const handleDownloadPDF = async () => {
    if (!exam || !attempt || !result || !studentInfo || !sessionInfo) return

    try {
      setDownloadingPDF(true)
      toast.loading('Generating PDF...', { id: 'pdf-generation' })

      const pdf = await generateResultsPDF({
        exam,
        attempt,
        result,
        studentName: studentInfo.full_name,
        sessionCode: sessionInfo.session_code
      })

      const filename = `${exam.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results_${studentInfo.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
      
      downloadPDF(pdf, filename)
      
      toast.success('PDF downloaded successfully!', { id: 'pdf-generation' })
    } catch (err) {
      console.error('Error generating PDF:', err)
      toast.error('Failed to generate PDF', { id: 'pdf-generation' })
    } finally {
      setDownloadingPDF(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto w-16 h-16 border-4 border-primary border-t-transparent rounded-full mb-6"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg font-medium text-muted-foreground flex items-center space-x-2"
          >
            <Trophy className="w-5 h-5" />
            <span>Calculating results...</span>
          </motion.p>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-4 h-1 bg-primary/20 rounded-full overflow-hidden max-w-xs mx-auto"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="h-full w-1/3 bg-primary rounded-full"
            />
          </motion.div>
        </motion.div>
      </div>
    )
  }

  if (error) {
    // Show blocked results page for students
    if (error === 'RESULTS_BLOCKED') {
      return (
        <ResultsBlocked
          studentName={studentInfo?.full_name}
          examTitle={exam?.title}
          sessionCode={sessionInfo?.session_code}
          submittedAt={attempt?.submitted_at}
        />
      )
    }
    
    // Show regular error page for other errors
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <Card className="border-destructive/20 bg-white/80 backdrop-blur">
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2"
              >
                <XCircle className="w-6 h-6 text-destructive" />
              </motion.div>
              <CardTitle className="text-destructive">Results Loading Error</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                onClick={returnToDashboard}
                className="w-full"
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (!exam || !attempt || !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">No results available</p>
        </div>
      </div>
    )
  }

  const scorePercentage = result.percentage_score
  const correctPercentage = (result.correct_answers / result.total_questions) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Auto-return notification */}
      <AnimatePresence>
        {autoReturnActive && !loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-3 h-3 bg-blue-500 rounded-full"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Auto-returning to dashboard in {autoReturnCountdown}s
                      </p>
                      <p className="text-xs text-gray-500">
                        You can stay longer or return now
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={returnToDashboard}
                      size="sm"
                      className="text-xs"
                    >
                      Return Now
                    </Button>
                    <Button
                      onClick={cancelAutoReturn}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Stay
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <Progress 
                    value={((30 - autoReturnCountdown) / 30) * 100} 
                    className="h-1"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md shadow-lg border-b border-border sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
              >
                <Award className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Exam Results</h1>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  {studentInfo && (
                    <Badge variant="outline" className="flex items-center space-x-1">
                      <User className="w-3 h-3" />
                      <span>{studentInfo.full_name}</span>
                    </Badge>
                  )}
                  {sessionInfo && (
                    <Badge variant="outline">Session: {sessionInfo.session_code}</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {downloadingPDF ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                  />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Results Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pass/Fail Header */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur overflow-hidden">
                <div className={`h-2 ${result.passed ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-orange-500'}`} />
                <CardContent className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                    className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                      result.passed 
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100' 
                        : 'bg-gradient-to-r from-red-100 to-orange-100'
                    }`}
                  >
                    {result.passed ? (
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    ) : (
                      <XCircle className="w-10 h-10 text-red-600" />
                    )}
                  </motion.div>
                  
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-3xl font-bold mb-2"
                  >
                    {result.passed ? '🎉 Congratulations!' : '💪 Keep Trying!'}
                  </motion.h1>
                  
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-lg text-muted-foreground mb-6"
                  >
                    {exam.title}
                  </motion.p>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8, type: "spring" }}
                    className="relative mb-4"
                  >
                    <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {result.percentage_score.toFixed(1)}%
                    </div>
                    <Progress 
                      value={scorePercentage} 
                      className="mt-4 h-3"
                    />
                  </motion.div>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="text-sm text-muted-foreground"
                  >
                    {result.passed 
                      ? `Great job! You exceeded the ${exam.passing_score}% passing requirement.` 
                      : `You needed ${exam.passing_score}% to pass. You got ${result.percentage_score.toFixed(1)}%.`
                    }
                  </motion.p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Score Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>Score Breakdown</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200"
                    >
                      <div className="text-2xl font-bold text-green-600 mb-1">{result.correct_answers}</div>
                      <div className="text-xs text-green-600 font-medium">Correct</div>
                    </motion.div>
                    
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
                    >
                      <div className="text-2xl font-bold text-blue-600 mb-1">{result.total_questions}</div>
                      <div className="text-xs text-blue-600 font-medium">Total Questions</div>
                    </motion.div>
                    
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200"
                    >
                      <div className="text-2xl font-bold text-purple-600 mb-1">{result.points_earned}</div>
                      <div className="text-xs text-purple-600 font-medium">Points Earned</div>
                    </motion.div>
                    
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200"
                    >
                      <div className="text-2xl font-bold text-orange-600 mb-1">{result.total_points}</div>
                      <div className="text-xs text-orange-600 font-medium">Total Points</div>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Questions Review */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="w-5 h-5" />
                      <span>Review Your Answers</span>
                    </CardTitle>
                    <Button
                      onClick={() => setShowAnswers(!showAnswers)}
                      variant="outline"
                      size="sm"
                    >
                      {showAnswers ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Hide Answers
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Show Answers
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                
                <AnimatePresence>
                  {showAnswers && questions.length > 0 && (
                    <CardContent>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4 max-h-96 overflow-y-auto"
                      >
                        {questions.map((question, index) => (
                          <motion.div
                            key={question.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-4 border rounded-lg bg-gray-50/50"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <h4 className="font-medium text-sm">Question {index + 1}</h4>
                              <div className="flex items-center space-x-2">
                                <Badge variant={question.isCorrect ? "default" : "destructive"} className="text-xs">
                                  {question.isCorrect ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Correct
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Incorrect
                                    </>
                                  )}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {question.userAnswer?.points_earned || 0}/{question.points} pts
                                </span>
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-2">{question.question_text}</p>
                            
                            <div className="space-y-1 text-xs">
                              <div className="flex items-start space-x-2">
                                <span className="font-medium min-w-fit">Your Answer:</span>
                                <span className={question.isCorrect ? 'text-green-600' : 'text-red-600'}>
                                  {question.userAnswer?.answer || 'Not answered'}
                                </span>
                              </div>
                              
                              {!question.isCorrect && (
                                <div className="flex items-start space-x-2">
                                  <span className="font-medium min-w-fit">Correct:</span>
                                  <span className="text-green-600">{question.correct_answer}</span>
                                </div>
                              )}
                              
                              {question.explanation && (
                                <div className="flex items-start space-x-2">
                                  <span className="font-medium min-w-fit">Explanation:</span>
                                  <span className="text-muted-foreground">{question.explanation}</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </CardContent>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Exam Information */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Card className="border-0 shadow-xl bg-white/90 backdrop-blur sticky top-32">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>Exam Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-xs font-medium text-blue-600">Started</div>
                      <div className="text-xs text-blue-700">
                        {new Date(attempt.started_at!).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <div className="text-xs font-medium text-green-600">Completed</div>
                      <div className="text-xs text-green-700">
                        {new Date(attempt.completed_at!).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <Timer className="w-4 h-4 text-purple-600" />
                    <div>
                      <div className="text-xs font-medium text-purple-600">Duration</div>
                      <div className="text-xs text-purple-700">{exam.duration_minutes} minutes</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-muted-foreground mb-1">
                        {Math.round(correctPercentage)}%
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">Accuracy</div>
                      <Progress value={correctPercentage} className="h-2" />
                    </div>
                  </div>
                  
                  <Button
                    onClick={returnToDashboard}
                    className="w-full mt-6"
                    variant="outline"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Return to Dashboard
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}