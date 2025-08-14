'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ModernBackground } from '@/components/ui/modern-background'
import { GradientText } from '@/components/ui/text-effects'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw,
  Trophy,
  Target,
  Zap,
  BookOpen,
  Home,
  Timer,
  Camera,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react'

interface DemoQuestion {
  id: string
  question: string
  options: { [key: string]: string }
  correctAnswer: string
  explanation: string
  type: 'multiple_choice' | 'true_false'
}

interface DemoExamProps {
  onExit: () => void
}

const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: '1',
    question: 'What is the capital of Nigeria?',
    options: {
      A: 'Lagos',
      B: 'Kano',
      C: 'Abuja',
      D: 'Port Harcourt'
    },
    correctAnswer: 'C',
    explanation: 'Abuja is the capital city of Nigeria, located in the Federal Capital Territory.',
    type: 'multiple_choice'
  },
  {
    id: '2',
    question: 'What is 15 × 8?',
    options: {
      A: '120',
      B: '125',
      C: '115',
      D: '130'
    },
    correctAnswer: 'A',
    explanation: '15 × 8 = 120. You can calculate this as (10 × 8) + (5 × 8) = 80 + 40 = 120.',
    type: 'multiple_choice'
  },
  {
    id: '3',
    question: 'The sun rises in the east.',
    options: {
      A: 'True',
      B: 'False'
    },
    correctAnswer: 'A',
    explanation: 'The sun rises in the east and sets in the west due to Earth\'s rotation.',
    type: 'true_false'
  },
  {
    id: '4',
    question: 'Which gas do plants absorb from the atmosphere during photosynthesis?',
    options: {
      A: 'Oxygen',
      B: 'Carbon Dioxide',
      C: 'Nitrogen',
      D: 'Hydrogen'
    },
    correctAnswer: 'B',
    explanation: 'Plants absorb carbon dioxide (CO₂) from the atmosphere and release oxygen during photosynthesis.',
    type: 'multiple_choice'
  },
  {
    id: '5',
    question: 'Water boils at 100°C at sea level.',
    options: {
      A: 'True',
      B: 'False'
    },
    correctAnswer: 'A',
    explanation: 'Water boils at 100°C (212°F) at standard atmospheric pressure (sea level).',
    type: 'true_false'
  }
]

export default function DemoExam({ onExit }: DemoExamProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeRemaining, setTimeRemaining] = useState(300) // 5 minutes
  const [examPhase, setExamPhase] = useState<'active' | 'review' | 'results'>('active')
  const [showExplanation, setShowExplanation] = useState(false)

  const currentQuestion = DEMO_QUESTIONS[currentQuestionIndex]
  const totalQuestions = DEMO_QUESTIONS.length
  const answeredCount = Object.keys(answers).length

  // Timer countdown
  useEffect(() => {
    if (examPhase !== 'active') return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setExamPhase('review')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [examPhase])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }))
  }

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      setExamPhase('review')
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmit = () => {
    setExamPhase('results')
  }

  const handleRestart = () => {
    setCurrentQuestionIndex(0)
    setAnswers({})
    setTimeRemaining(300)
    setExamPhase('active')
    setShowExplanation(false)
  }

  const calculateResults = () => {
    let correct = 0
    DEMO_QUESTIONS.forEach(question => {
      if (answers[question.id] === question.correctAnswer) {
        correct++
      }
    })
    return {
      correct,
      total: totalQuestions,
      percentage: Math.round((correct / totalQuestions) * 100)
    }
  }

  if (examPhase === 'results') {
    const results = calculateResults()
    
    return (
      <ModernBackground variant="default">
        <div className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl"
          >
            <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-md">
              <CardHeader className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 text-white text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                    <Trophy className="w-10 h-10" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold">Demo Exam Complete!</CardTitle>
                <p className="text-lg opacity-90">Great job practicing with our demo exam</p>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="text-center p-6 bg-blue-50 rounded-xl">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {results.percentage}%
                    </div>
                    <div className="text-blue-800 font-medium">Overall Score</div>
                  </div>
                  <div className="text-center p-6 bg-green-50 rounded-xl">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {results.correct}/{results.total}
                    </div>
                    <div className="text-green-800 font-medium">Correct Answers</div>
                  </div>
                  <div className="text-center p-6 bg-purple-50 rounded-xl">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {formatTime(300 - timeRemaining)}
                    </div>
                    <div className="text-purple-800 font-medium">Time Taken</div>
                  </div>
                </div>

                {/* Answer Review */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <BookOpen className="w-6 h-6 mr-2" />
                    Answer Review
                  </h3>
                  <div className="space-y-4">
                    {DEMO_QUESTIONS.map((question, index) => {
                      const userAnswer = answers[question.id]
                      const isCorrect = userAnswer === question.correctAnswer
                      
                      return (
                        <div key={question.id} className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-l-gray-300">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                                  Q{index + 1}
                                </span>
                                {isCorrect ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                )}
                              </div>
                              <h4 className="font-medium text-gray-900 mb-2">{question.question}</h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-2">
                                {Object.entries(question.options).map(([key, value]) => (
                                  <div 
                                    key={key} 
                                    className={`p-2 rounded ${
                                      key === question.correctAnswer 
                                        ? 'bg-green-100 text-green-800 border border-green-300' 
                                        : key === userAnswer && !isCorrect
                                        ? 'bg-red-100 text-red-800 border border-red-300'
                                        : 'bg-gray-50'
                                    }`}
                                  >
                                    <strong>{key}:</strong> {value}
                                    {key === question.correctAnswer && (
                                      <CheckCircle className="w-4 h-4 inline ml-2 text-green-600" />
                                    )}
                                    {key === userAnswer && !isCorrect && (
                                      <XCircle className="w-4 h-4 inline ml-2 text-red-600" />
                                    )}
                                  </div>
                                ))}
                              </div>
                              
                              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                                <strong>Explanation:</strong> {question.explanation}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={handleRestart}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                  <Button
                    onClick={onExit}
                    variant="outline"
                    className="flex-1"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </ModernBackground>
    )
  }

  if (examPhase === 'review') {
    return (
      <ModernBackground variant="default">
        <div className="min-h-screen flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-md">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-center">
                <CardTitle className="text-2xl font-bold">Review Your Answers</CardTitle>
                <p>You have answered {answeredCount} out of {totalQuestions} questions</p>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-5 gap-3 mb-6">
                  {DEMO_QUESTIONS.map((question, index) => (
                    <div
                      key={question.id}
                      className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-medium ${
                        answers[question.id]
                          ? 'bg-green-100 text-green-800 border-2 border-green-300'
                          : 'bg-red-100 text-red-800 border-2 border-red-300'
                      }`}
                    >
                      {index + 1}
                    </div>
                  ))}
                </div>

                <div className="text-center mb-6">
                  <p className="text-gray-600 mb-4">
                    {answeredCount === totalQuestions 
                      ? "All questions answered! Ready to see your results?"
                      : `You have ${totalQuestions - answeredCount} unanswered questions.`
                    }
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => {
                      setExamPhase('active')
                      setCurrentQuestionIndex(0)
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Continue Exam
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    View Results
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </ModernBackground>
    )
  }

  const progressPercentage = (answeredCount / totalQuestions) * 100

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
        <div className="absolute inset-0" 
             style={{
               backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)'
             }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 bg-white/90 backdrop-blur-lg border-b shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Demo Mathematics Exam</h1>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
                <Badge variant="outline" className="bg-white/50">
                  Session: DEMO-EXAM
                </Badge>
                <div className="flex items-center space-x-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Wifi className="w-3 h-3 text-green-500" />
                  </motion.div>
                  <span className="text-green-600">Demo Mode</span>
                </div>
              </div>
            </div>

            {/* Timer and Demo Status */}
            <div className="flex items-center space-x-4">
              {/* Demo Camera Indicator */}
              <div className="text-center p-4 border rounded-lg bg-blue-50">
                <Camera className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                <div className="flex items-center justify-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-blue-700">Demo Mode</span>
                </div>
              </div>
              
              <div className="text-center p-4 border rounded-lg bg-red-50">
                <Timer className="w-4 h-4 mx-auto text-red-500 mb-1" />
                <div className="text-lg font-mono font-bold text-red-600">
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-xs text-red-700">Time Left</div>
              </div>

              <Button
                onClick={onExit}
                variant="outline"
                size="sm"
              >
                <Home className="w-4 h-4 mr-2" />
                Exit Demo
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {answeredCount} of {totalQuestions} answered
              </span>
              <span>
                {Math.round(progressPercentage)}% complete
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-2"
            />
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Question Content */}
          <div className="xl:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.95 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              >
                <Card className="h-full bg-white/80 backdrop-blur">
                  <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-t-2xl" />
                  
                  <div className="p-8">
                    {/* Question Header */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-8"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <Badge variant="secondary" className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 px-4 py-2">
                            Question {currentQuestionIndex + 1} of {totalQuestions}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {currentQuestion.type === 'multiple_choice' ? 'Multiple Choice' : 'True/False'}
                          </Badge>
                        </div>
                      </div>
                      
                      <h2 className="text-2xl font-bold text-gray-900 leading-relaxed">
                        {currentQuestion.question}
                      </h2>
                    </motion.div>

                    {/* Options */}
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="space-y-4"
                    >
                      {Object.entries(currentQuestion.options).map(([key, value]) => (
                        <motion.div
                          key={key}
                          whileHover={{ scale: 1.01, x: 8 }}
                          whileTap={{ scale: 0.99 }}
                          className={`group relative p-6 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                            answers[currentQuestion.id] === key
                              ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-purple-50 shadow-lg'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md'
                          }`}
                          onClick={() => handleAnswer(key)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`relative w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              answers[currentQuestion.id] === key
                                ? 'border-blue-500 bg-blue-500 scale-110'
                                : 'border-gray-300 group-hover:border-blue-400'
                            }`}>
                              {answers[currentQuestion.id] === key && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 300 }}
                                >
                                  <CheckCircle className="w-4 h-4 text-white" />
                                </motion.div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className={`font-bold text-lg ${
                                  answers[currentQuestion.id] === key ? 'text-blue-700' : 'text-gray-700'
                                }`}>
                                  {key}.
                                </span>
                                <span className={`text-lg ${
                                  answers[currentQuestion.id] === key ? 'text-blue-900 font-medium' : 'text-gray-900'
                                }`}>
                                  {value}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Hover indicator */}
                          <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 transition-all ${
                            answers[currentQuestion.id] === key
                              ? 'opacity-100 text-blue-500'
                              : 'opacity-0 group-hover:opacity-50 text-gray-400'
                          }`}>
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Navigation */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="mt-12 pt-8 border-t border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <Button
                          onClick={handlePrevious}
                          disabled={currentQuestionIndex === 0}
                          variant="outline"
                          size="lg"
                          className="px-6"
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Previous
                        </Button>

                        <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                          {answeredCount} of {totalQuestions} answered
                        </div>

                        {currentQuestionIndex === totalQuestions - 1 ? (
                          <Button
                            onClick={() => setExamPhase('review')}
                            className="bg-green-600 hover:bg-green-700 px-6"
                            size="lg"
                          >
                            Review & Submit
                            <Target className="w-4 h-4 ml-2" />
                          </Button>
                        ) : (
                          <Button
                            onClick={handleNext}
                            className="bg-blue-600 hover:bg-blue-700 px-6"
                            size="lg"
                          >
                            Next Question
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="xl:col-span-1 space-y-6">
            {/* Question Navigator */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white/80 backdrop-blur">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                    Question Navigator
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2">
                    {DEMO_QUESTIONS.map((question, index) => (
                      <motion.button
                        key={question.id}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setCurrentQuestionIndex(index)}
                        className={`relative w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                          index === currentQuestionIndex
                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-110'
                            : answers[question.id]
                            ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-2 border-green-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
                        }`}
                      >
                        {index + 1}
                        {answers[question.id] && index !== currentQuestionIndex && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Answered:</span>
                      <span className="font-medium text-green-600">{answeredCount}/{totalQuestions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Remaining:</span>
                      <span className="font-medium text-orange-600">{totalQuestions - answeredCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Demo Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-500 rounded-full mx-auto mb-3 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold text-blue-900 mb-2">Demo Mode</h3>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      This is a practice exam. Your answers won't be saved, and there's no camera monitoring.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}