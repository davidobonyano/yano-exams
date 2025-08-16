'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '@/context/SimpleSessionContext'

import { Exam, Question, StudentExamAttempt, StudentAnswer, ExamResult } from '@/types/database-v2'
import { getDetailedStudentResults, DetailedStudentResult } from '@/lib/auto-scoring'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Award, Download, Eye, EyeOff, CheckCircle, XCircle, Clock, User, FileText, ArrowLeft, Trophy, Target, Calendar, Timer } from 'lucide-react'
import ResultsBlocked from './ResultsBlocked'
import { generateResultsPDF, downloadPDF } from '@/lib/pdf-generator'
import toast from 'react-hot-toast'


interface SessionExamResultsProps {
  attemptId: string
}

interface QuestionWithAnswer extends Question {
  userAnswer?: StudentAnswer
  isCorrect: boolean
}

export default function SessionExamResults({ attemptId }: SessionExamResultsProps) {
  const router = useRouter()
  const {} = useSession()
  const [exam, setExam] = useState<Exam | null>(null)
  const [attempt, setAttempt] = useState<StudentExamAttempt | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([])
  const [detailedResult, setDetailedResult] = useState<DetailedStudentResult | null>(null)
  const [studentInfo, setStudentInfo] = useState<{ id: string; name?: string; full_name?: string; email?: string } | null>(null)
  const [sessionInfo, setSessionInfo] = useState<{ id: string; session_name?: string; session_code?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnswers, setShowAnswers] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [autoReturnCountdown, setAutoReturnCountdown] = useState(30)
  const [autoReturnActive, setAutoReturnActive] = useState(true)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

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

  const loadResults = useCallback(async () => {
    try {
      setLoading(true)

      // Load detailed results using new SQL function
      const detailedResults = await getDetailedStudentResults(attemptId)
      
      if (!detailedResults || !detailedResults.success) {
        throw new Error(detailedResults?.error || 'Failed to load detailed results')
      }

      setDetailedResult(detailedResults)

      // Set basic info from detailed results
      const attemptInfo = detailedResults.attempt_info
      setAttempt({
        id: attemptInfo.attempt_id,
        student_id: attemptInfo.student_id,
        exam_id: attemptInfo.exam_id,
        session_id: attemptInfo.session_id,
        status: attemptInfo.status,
        started_at: attemptInfo.started_at,
        completed_at: attemptInfo.completed_at,
        submitted_at: attemptInfo.submitted_at
      } as StudentExamAttempt)

      // Set exam, student, and session info from detailed results
      setExam({
        id: attemptInfo.exam_id,
        title: attemptInfo.exam_title,
        total_questions: attemptInfo.total_questions,
        passing_score: attemptInfo.passing_score
      } as Exam)

      setStudentInfo({
        id: attemptInfo.student_id,
        name: attemptInfo.student_name,
        full_name: attemptInfo.student_name,
        email: attemptInfo.student_email
      })

      setSessionInfo({
        id: attemptInfo.session_id,
        session_name: attemptInfo.session_name,
        session_code: attemptInfo.session_code
      })

      // Set result from detailed results
      if (attemptInfo.total_questions > 0) {
        setResult({
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
        } as ExamResult)

        // Convert detailed answers to questions format
        const questionsWithAnswers: QuestionWithAnswer[] = detailedResults.detailed_answers.map(answer => ({
          id: answer.question_id,
          exam_id: attemptInfo.exam_id,
          question_text: answer.question_text,
          question_type: answer.question_type as 'multiple_choice' | 'true_false' | 'short_answer',
          options: answer.options,
          correct_answer: answer.correct_answer_key,
          points: answer.question_points,
          explanation: answer.explanation,
          created_at: new Date().toISOString(),
          userAnswer: {
            id: '',
            attempt_id: attemptInfo.attempt_id,
            question_id: answer.question_id,
            answer: answer.student_answer_key,
            is_correct: answer.is_correct,
            points_earned: answer.points_earned,
            answered_at: answer.answered_at || new Date().toISOString()
          },
          isCorrect: answer.is_correct
        }))

        setQuestions(questionsWithAnswers)
      }

    } catch (err: unknown) {
      console.error('Error loading results:', err)
      setError(err instanceof Error ? err.message : 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }, [attemptId])

  useEffect(() => {
    loadResults()
  }, [loadResults])





  const handleDownloadPDF = async () => {
    if (!exam || !attempt || !result || !studentInfo || !sessionInfo) return

    try {
      setDownloadingPDF(true)
      toast.loading('Generating PDF...', { id: 'pdf-generation' })

      const pdf = await generateResultsPDF({
        exam,
        attempt,
        result,
        studentName: studentInfo.full_name || 'Unknown Student',
        sessionCode: sessionInfo.session_code || 'Unknown Session'
      })

      const filename = `${exam.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results_${(studentInfo.full_name || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`
      
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
    <div className="min-h-screen bg-gray-50">
      {/* Auto-return notification */}
      <AnimatePresence>
        {autoReturnActive && !loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <Card className="border shadow-lg bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-gray-400 rounded-full" />
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

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow border-b sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
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
                className="bg-gray-800 hover:bg-gray-700"
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
            {/* Student Information Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Student Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Name</div>
                      <div className="text-lg font-semibold">{studentInfo?.full_name || 'Unknown Student'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Student ID</div>
                      <div className="text-sm text-gray-600">{detailedResult?.attempt_info?.student_school_id || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Class</div>
                      <div className="text-sm text-gray-600">{detailedResult?.attempt_info?.student_class || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">Session Code</div>
                      <div className="text-sm text-gray-600 font-mono">{sessionInfo?.session_code || 'Unknown Session'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            {/* Pass/Fail Header */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border shadow-lg bg-white">
                <div className={`h-1 ${result.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                <CardContent className="p-8 text-center">
                  <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
                    result.passed ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {result.passed ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-600" />
                    )}
                  </div>
                  
                  <h1 className="text-2xl font-bold mb-2">
                    {result.passed ? 'Congratulations!' : 'Keep Trying!'}
                  </h1>
                  
                  <p className="text-lg text-muted-foreground mb-6">
                    {exam.title}
                  </p>
                  
                  <div className="relative mb-4">
                    <div className="text-5xl font-bold text-gray-800">
                      {result.percentage_score.toFixed(1)}%
                    </div>
                    <Progress 
                      value={scorePercentage} 
                      className="mt-4 h-2"
                    />
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {result.passed 
                      ? `Great job! You exceeded the ${exam.passing_score}% passing requirement.` 
                      : `You needed ${exam.passing_score}% to pass. You got ${result.percentage_score.toFixed(1)}%.`
                    }
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Score Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="w-5 h-5" />
                    <span>Score Breakdown</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <div className="text-2xl font-bold text-gray-800 mb-1">{result.correct_answers}</div>
                      <div className="text-xs text-gray-600 font-medium">Correct</div>
                    </div>
                    
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <div className="text-2xl font-bold text-gray-800 mb-1">{result.total_questions}</div>
                      <div className="text-xs text-gray-600 font-medium">Total Questions</div>
                    </div>
                    
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <div className="text-2xl font-bold text-gray-800 mb-1">{result.points_earned}</div>
                      <div className="text-xs text-gray-600 font-medium">Points Earned</div>
                    </div>
                    
                    <div className="text-center p-4 bg-gray-50 rounded-lg border">
                      <div className="text-2xl font-bold text-gray-800 mb-1">{result.total_points}</div>
                      <div className="text-xs text-gray-600 font-medium">Total Points</div>
                    </div>
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
              <Card className="border shadow-lg bg-white">
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
                            {detailedResult && (
                            <>
                              <div className="flex items-start space-x-2">
                              <span className="font-medium min-w-fit">Your Answer:</span>
                                <span className={question.isCorrect ? 'text-green-600' : 'text-red-600'}>
                                    {detailedResult.detailed_answers[index]?.student_answer_text || 'Not answered'}
                                  </span>
                                </div>
                              
                            {!question.isCorrect && (
                              <div className="flex items-start space-x-2">
                                  <span className="font-medium min-w-fit">Correct:</span>
                                    <span className="text-green-600">{detailedResult.detailed_answers[index]?.correct_answer_text}</span>
                                     </div>
                                   )}
                                 </>
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
              <Card className="border shadow-lg bg-white sticky top-32">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>Exam Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <div>
                      <div className="text-xs font-medium text-gray-700">Started</div>
                      <div className="text-xs text-gray-600">
                        {new Date(attempt.started_at!).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-gray-600" />
                    <div>
                      <div className="text-xs font-medium text-gray-700">Completed</div>
                      <div className="text-xs text-gray-600">
                        {new Date(attempt.completed_at!).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Timer className="w-4 h-4 text-gray-600" />
                    <div>
                      <div className="text-xs font-medium text-gray-700">Duration</div>
                      <div className="text-xs text-gray-600">{exam.duration_minutes} minutes</div>
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