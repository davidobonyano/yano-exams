'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  BookOpen, 
  HelpCircle, 
  CheckCircle, 
  X,
  Upload,
  FileText,
  Shuffle,
  Eye,
  Image as ImageIcon,
  Trash
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_gap' | 'subjective'
  options: { [key: string]: string } | null
  correct_answer: string
  points: number
  explanation?: string
  image_data?: string
}

interface QuestionManagerProps {
  examId: string
  examTitle: string
  totalQuestions: number
  onClose: () => void
}

export default function QuestionManager({ examId, examTitle, totalQuestions, onClose }: QuestionManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null)

  // Form states
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_gap' | 'subjective'>('multiple_choice')
  const [options, setOptions] = useState<{ [key: string]: string }>({ A: '', B: '', C: '', D: '' })
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [points, setPoints] = useState(1)
  const [explanation, setExplanation] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [processingImage, setProcessingImage] = useState(false)

  // Add function to update database question types
  const updateDatabaseQuestionTypes = async () => {
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        toast.error('Please log in to update database types')
        return
      }

      const response = await fetch('/api/admin/run-sql-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Show detailed status information
        if (result.status) {
          const status = result.status
          let message = ''
          
          if (status.database_status === 'fully_updated') {
            message = '✅ All question types are working!'
            toast.success(message)
          } else if (status.database_status === 'partially_updated') {
            message = '⚠️ Some question types need database updates'
            toast(message, { icon: '⚠️' })
          } else if (status.database_status === 'needs_update') {
            message = '❌ Database needs to be updated'
            toast.error(message)
          }
          
          // Log detailed status to console
          console.log('Database Status:', status)
          console.log('Recommendations:', status.recommendations)
          
          // Show recommendations in a more detailed way
          if (status.recommendations.length > 0) {
            setTimeout(() => {
              toast.success(`Status: ${status.recommendations.join(' | ')}`)
            }, 1000)
          }
        } else {
          toast.success('Database status checked successfully!')
        }
      } else {
        toast.error('Failed to check database: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error updating database:', error)
      toast.error('Failed to update database question types')
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [examId])

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('created_at')

      if (error) throw error
      setQuestions(data || [])
    } catch (error) {
      console.error('Error fetching questions:', error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setQuestionText('')
    setQuestionType('multiple_choice')
    setOptions({ A: '', B: '', C: '', D: '' })
    setCorrectAnswer('')
    setPoints(1)
    setExplanation('')
    setImageFile(null)
    setImagePreview('')
    setEditingQuestion(null)
  }

  const processImageToBase64 = async (file: File): Promise<string | null> => {
    try {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result)
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
    } catch (error) {
      console.error('Error processing image:', error)
      toast.error('Failed to process image')
      return null
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Image size must be less than 5MB')
        return
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file')
        return
      }
      
      setImageFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview('')
  }

  const handleAddQuestion = async () => {
    if (!questionText.trim() || !correctAnswer.trim()) {
      toast.error('Question text and correct answer are required')
      return
    }

    try {
      setProcessingImage(true)
      
      let imageData = null
      if (imageFile) {
        imageData = await processImageToBase64(imageFile)
        if (!imageData) return // Processing failed
      }

      const questionData = {
        exam_id: examId,
        question_text: questionText.trim(),
        question_type: questionType,
        options: questionType === 'multiple_choice' ? options : null,
        correct_answer: correctAnswer.trim(),
        points,
        explanation: explanation.trim() || null,
        image_data: imageData
      }

      const { error } = await supabase
        .from('questions')
        .insert([questionData])

      if (error) throw error

      toast.success('Question added successfully!')
      fetchQuestions()
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding question:', error)
      toast.error('Failed to add question')
    } finally {
      setProcessingImage(false)
    }
  }

  const handleEditQuestion = async () => {
    if (!editingQuestion || !questionText.trim() || !correctAnswer.trim()) {
      toast.error('Question text and correct answer are required')
      return
    }

    try {
      setProcessingImage(true)
      
      let imageData: string | undefined = editingQuestion.image_data || undefined
      if (imageFile) {
        imageData = await processImageToBase64(imageFile) || undefined
        if (!imageData) return // Processing failed
      }

      const { error } = await supabase
        .from('questions')
        .update({
          question_text: questionText.trim(),
          question_type: questionType,
          options: questionType === 'multiple_choice' ? options : null,
          correct_answer: correctAnswer.trim(),
          points,
          explanation: explanation.trim() || null,
          image_data: imageData
        })
        .eq('id', editingQuestion.id)

      if (error) throw error

      toast.success('Question updated successfully!')
      fetchQuestions()
      resetForm()
    } catch (error) {
      console.error('Error updating question:', error)
      toast.error('Failed to update question')
    } finally {
      setProcessingImage(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (error) {
        console.error('Supabase delete error:', error)
        throw error
      }

      toast.success('Question deleted successfully!')
      fetchQuestions()
    } catch (error) {
      console.error('Error deleting question:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to delete question: ${errorMessage}`)
    }
  }

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Please paste your questions')
      return
    }

    try {
      console.log('Starting bulk import with text:', bulkText.substring(0, 200) + '...')
      
      const questionsToImport = parseBulkQuestions(bulkText)
      
      console.log('Questions parsed:', questionsToImport)
      
      if (questionsToImport.length === 0) {
        toast.error('No valid questions found. Please check the format.')
        return
      }

      const questionsData = questionsToImport.map(q => ({
        exam_id: examId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        points: q.points,
        explanation: q.explanation
      }))

      console.log('Inserting questions data:', questionsData)

      const { data, error } = await supabase
        .from('questions')
        .insert(questionsData)
        .select()

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      console.log('Successfully inserted questions:', data)

      toast.success(`${questionsToImport.length} questions imported successfully!`)
      fetchQuestions()
      setBulkText('')
      setShowBulkImport(false)
    } catch (error) {
      console.error('Error importing questions:', error)
      toast.error('Failed to import questions: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const parseBulkQuestions = (text: string) => {
    const questions: Omit<Question, 'id'>[] = []
    
    // First try to split by --- separator
    let blocks = text.split(/---+/).map(block => block.trim()).filter(Boolean)
    
    // If no --- separators found, try to split by detecting Q: patterns
    if (blocks.length === 1) {
      // Split the text whenever we find a new "Q:" that's not at the beginning
      const lines = text.split('\n')
      let currentBlock: string[] = []
      const allBlocks = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // If we find a Q: and we already have content in currentBlock, start a new block
        if (line.startsWith('Q:') && currentBlock.length > 0) {
          if (currentBlock.some(l => l.trim())) { // Only add if block has content
            allBlocks.push(currentBlock.join('\n'))
          }
          currentBlock = [line]
        } else {
          currentBlock.push(line)
        }
      }
      
      // Add the last block
      if (currentBlock.length > 0 && currentBlock.some(l => l.trim())) {
        allBlocks.push(currentBlock.join('\n'))
      }
      
      blocks = allBlocks.map(block => block.trim()).filter(Boolean)
    }

    console.log(`Processing ${blocks.length} question blocks`)

    blocks.forEach((block, blockIndex) => {
      console.log(`Processing block ${blockIndex + 1}:`, block.substring(0, 100) + '...')
      
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
      let question_text = ''
      const options: { [key: string]: string } = {}
      let correct_answer = ''
      let points = 1
      let explanation = ''
      let question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_gap' | 'subjective' = 'multiple_choice'

      lines.forEach(line => {
        if (line.startsWith('Q:')) {
          question_text = line.substring(2).trim()
        } else if (line.match(/^[A-D]:/)) {
          const letter = line[0]
          options[letter] = line.substring(2).trim()
        } else if (line.startsWith('Correct:')) {
          correct_answer = line.substring(8).trim()
        } else if (line.startsWith('Points:')) {
          points = parseInt(line.substring(7).trim()) || 1
        } else if (line.startsWith('Explanation:')) {
          explanation = line.substring(12).trim()
        }
      })

      // Determine question type based on options and answers
      if (Object.keys(options).length > 0) {
        // Check if it's true/false with A: True, B: False format
        if (Object.keys(options).length === 2 && 
            (Object.values(options).includes('True') || Object.values(options).includes('False'))) {
          question_type = 'true_false'
        } else {
          question_type = 'multiple_choice'
        }
      } else if (correct_answer.toLowerCase() === 'true' || correct_answer.toLowerCase() === 'false') {
        question_type = 'true_false'
      } else if (question_text.toLowerCase().includes('fill in the gap') || 
                 question_text.toLowerCase().includes('fill in the blank') ||
                 question_text.toLowerCase().includes('_____')) {
        question_type = 'fill_in_gap'
      } else if (question_text.toLowerCase().includes('explain') || 
                 question_text.toLowerCase().includes('describe') ||
                 question_text.toLowerCase().includes('discuss') ||
                 question_text.toLowerCase().includes('write')) {
        question_type = 'subjective'
      } else {
        question_type = 'short_answer'
      }

      if (question_text && correct_answer) {
        const questionData = {
          question_text,
          question_type,
          options: Object.keys(options).length > 0 ? options : null,
          correct_answer,
          points,
          explanation: explanation || undefined
        }
        
        console.log(`Adding question ${blockIndex + 1}:`, questionData)
        questions.push(questionData)
      } else {
        console.log(`Skipping block ${blockIndex + 1} - missing question text or correct answer`)
        console.log('Question text:', question_text)
        console.log('Correct answer:', correct_answer)
      }
    })

    console.log(`Parsed ${questions.length} questions total`)
    return questions
  }

  const startEdit = (question: Question) => {
    setEditingQuestion(question)
    setQuestionText(question.question_text)
    setQuestionType(question.question_type)
    setOptions(question.options || { A: '', B: '', C: '', D: '' })
    setCorrectAnswer(question.correct_answer)
    setPoints(question.points)
    setExplanation(question.explanation || '')
    setImagePreview(question.image_data || '')
    setImageFile(null) // Clear any new file selection
    setShowAddForm(true)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <BookOpen className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">{examTitle}</h2>
                  <p className="opacity-90">Manage Questions ({questions.length}/{totalQuestions})</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 border-b">
            <div className="flex flex-wrap gap-4">
              <MagneticButton
                onClick={() => setShowAddForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Question
              </MagneticButton>
              
              <MagneticButton
                onClick={() => setShowBulkImport(true)}
                variant="outline"
                className="px-6 py-3 rounded-xl"
              >
                <Upload className="w-5 h-5 mr-2" />
                Bulk Import
              </MagneticButton>

              <MagneticButton
                onClick={updateDatabaseQuestionTypes}
                variant="outline"
                className="px-6 py-3 rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                <HelpCircle className="w-5 h-5 mr-2" />
                Update DB Types
              </MagneticButton>

              <div className="ml-auto text-sm text-gray-600 flex items-center">
                <Shuffle className="w-4 h-4 mr-2" />
                Questions will be shuffled per student
              </div>
            </div>
          </div>

          {/* Questions List */}
          <div className="p-6">
            {/* Database Update Notice */}
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-orange-800">
                    <strong>Database Update Required:</strong> New question types (fill-in-gap, subjective) need database functions to be added.
                  </span>
                </div>
                <MagneticButton
                  onClick={updateDatabaseQuestionTypes}
                  variant="outline"
                  size="sm"
                  className="px-3 py-1 text-xs border-orange-300 text-orange-600 hover:bg-orange-100"
                >
                  Fix Now
                </MagneticButton>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No questions added yet. Start by adding your first question!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <Card key={question.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                              Q{index + 1}
                            </span>
                            <span className="text-sm text-gray-500">
                              {question.question_type === 'fill_in_gap' ? 'Fill in Gap' : 
                               question.question_type === 'subjective' ? 'Subjective' :
                               question.question_type.replace('_', ' ')} • {question.points} pts
                            </span>
                          </div>
                          <div className="mb-2">
                            <p className="font-medium">{question.question_text}</p>
                            {question.image_data && (
                              <div className="mt-2 p-2 bg-blue-50 rounded border">
                                <img
                                  src={question.image_data}
                                  alt="Question image"
                                  className="max-w-full max-h-24 rounded object-contain mx-auto"
                                />
                                <p className="text-xs text-blue-600 mt-1 text-center">📊 Includes visual element</p>
                              </div>
                            )}
                          </div>
                          
                          {question.options && (
                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                              {Object.entries(question.options).map(([key, value]) => (
                                <div key={key} className={`p-2 rounded ${question.correct_answer === key ? 'bg-green-100 text-green-800' : 'bg-gray-50'}`}>
                                  <strong>{key}:</strong> {value}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center text-sm text-green-700 bg-green-100 px-2 py-1 rounded w-fit">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Correct: {question.correct_answer}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => setPreviewQuestion(question)}
                            className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                            title="Preview how students see this question"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startEdit(question)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Edit question"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Delete question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            </div>
          </div>

          {/* Add/Edit Question Modal */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">
                      {editingQuestion ? 'Edit Question' : 'Add New Question'}
                    </h3>
                    <button
                      onClick={() => {
                        setShowAddForm(false)
                        resetForm()
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <FloatingInput
                      label="Question Text"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Enter your question here..."
                    />

                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-2">
                        <strong>💡 Tip:</strong> Choose the question type that best fits your question format
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>
                          <span className="font-medium">📋 Multiple Choice:</span> A, B, C, D options
                        </div>
                        <div>
                          <span className="font-medium">✅ True/False:</span> True or False answer
                        </div>
                        <div>
                          <span className="font-medium">🕳️ Fill in Gap:</span> Blank space (_____) to fill
                        </div>
                        <div>
                          <span className="font-medium">📝 Subjective:</span> Essay/explanation questions
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Question Type</Label>
                        <Select value={questionType} onValueChange={(value: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_gap' | 'subjective') => {
                          setQuestionType(value)
                          setCorrectAnswer('') // Reset correct answer when type changes
                          if (value === 'multiple_choice') {
                            setOptions({ A: '', B: '', C: '', D: '' }) // Reset options for multiple choice
                          }
                        }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select question type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple_choice">📋 Multiple Choice</SelectItem>
                            <SelectItem value="true_false">✅ True/False</SelectItem>
                            <SelectItem value="short_answer">✍️ Short Answer</SelectItem>
                            <SelectItem value="fill_in_gap">🕳️ Fill in the Gap</SelectItem>
                            <SelectItem value="subjective">📝 Subjective/Essay</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <FloatingInput
                        label="Points"
                        type="number"
                        min="1"
                        value={points.toString()}
                        onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                      />
                    </div>

                    {questionType === 'multiple_choice' && (
                      <div className="space-y-4">
                        <h4 className="font-medium">Answer Options</h4>
                        {['A', 'B', 'C', 'D'].map(letter => (
                          <FloatingInput
                            key={letter}
                            label={`Option ${letter}`}
                            value={options[letter] || ''}
                            onChange={(e) => setOptions(prev => ({ ...prev, [letter]: e.target.value }))}
                            placeholder={`Enter option ${letter}...`}
                          />
                        ))}
                      </div>
                    )}

                    {questionType === 'multiple_choice' ? (
                      <div className="space-y-2">
                        <Label>Correct Answer</Label>
                        <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select the correct answer option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A - {options.A || 'Option A'}</SelectItem>
                            <SelectItem value="B">B - {options.B || 'Option B'}</SelectItem>
                            <SelectItem value="C">C - {options.C || 'Option C'}</SelectItem>
                            <SelectItem value="D">D - {options.D || 'Option D'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : questionType === 'true_false' ? (
                      <div className="space-y-2">
                        <Label>Correct Answer</Label>
                        <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select True or False" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="True">✅ True</SelectItem>
                            <SelectItem value="False">❌ False</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : questionType === 'fill_in_gap' ? (
                      <div className="space-y-2">
                        <Label>Correct Answer</Label>
                        <FloatingInput
                          label="Correct Answer"
                          value={correctAnswer}
                          onChange={(e) => setCorrectAnswer(e.target.value)}
                          placeholder="Enter the correct word/phrase to fill the gap..."
                        />
                        <p className="text-xs text-gray-500">
                          Enter the exact word or phrase that should fill the blank in your question.
                        </p>
                      </div>
                    ) : questionType === 'subjective' ? (
                      <div className="space-y-2">
                        <Label>Sample Answer (Optional)</Label>
                        <textarea
                          value={correctAnswer}
                          onChange={(e) => setCorrectAnswer(e.target.value)}
                          placeholder="Enter a sample answer or key points for manual grading..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          rows={3}
                        />
                        <p className="text-xs text-gray-500">
                          This is for reference only. Subjective questions require manual grading.
                        </p>
                      </div>
                    ) : (
                      <FloatingInput
                        label="Correct Answer"
                        value={correctAnswer}
                        onChange={(e) => setCorrectAnswer(e.target.value)}
                        placeholder="Enter correct answer..."
                      />
                    )}

                    {/* Image Upload Section */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 flex items-center">
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Add Image/Diagram (Optional)
                      </h4>
                      <p className="text-sm text-gray-500">
                        Upload graphs, tables, diagrams, or other visual elements to enhance your question.
                      </p>
                      
                      {imagePreview ? (
                        <div className="relative p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="text-sm text-green-600 mb-2 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Image ready - will be integrated into question display
                          </div>
                          <img
                            src={imagePreview}
                            alt="Question image preview"
                            className="max-w-full max-h-32 rounded border object-contain mx-auto"
                          />
                          <button
                            onClick={removeImage}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            title="Remove image"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                            id="image-upload"
                          />
                          <label htmlFor="image-upload" className="cursor-pointer">
                            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-500 mb-1">
                              Click to upload an image
                            </p>
                            <p className="text-xs text-gray-400">
                              Supports JPG, PNG, GIF up to 5MB<br/>
                              Perfect for math diagrams, charts, graphs, etc.
                            </p>
                          </label>
                        </div>
                      )}
                    </div>

                    <FloatingInput
                      label="Explanation (Optional)"
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="Explain why this is the correct answer..."
                    />

                    <div className="flex gap-4 pt-4">
                      <MagneticButton
                        onClick={editingQuestion ? handleEditQuestion : handleAddQuestion}
                        disabled={processingImage}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingImage ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                            {imageFile ? 'Processing image...' : 'Saving...'}
                          </div>
                        ) : (
                          editingQuestion ? 'Update Question' : 'Add Question'
                        )}
                      </MagneticButton>
                      <MagneticButton
                        onClick={() => {
                          setShowAddForm(false)
                          resetForm()
                        }}
                        variant="outline"
                        className="flex-1 py-3 rounded-xl"
                      >
                        Cancel
                      </MagneticButton>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bulk Import Modal */}
          <AnimatePresence>
            {showBulkImport && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Bulk Import Questions</h3>
                    <button
                      onClick={() => setShowBulkImport(false)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-3">📚 Question Type Guide</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
                      <div>
                        <p className="font-medium">📋 Multiple Choice:</p>
                        <p className="text-xs">Include A:, B:, C:, D: options</p>
                        <p className="font-medium">✅ True/False:</p>
                        <p className="text-xs">Use &quot;Correct: True&quot; or &quot;Correct: False&quot;</p>
                        <p className="font-medium">🕳️ Fill in the Gap:</p>
                        <p className="text-xs">Include &quot;_____&quot; or &quot;fill in the gap&quot; in question</p>
                      </div>
                      <div>
                        <p className="font-medium">✍️ Short Answer:</p>
                        <p className="text-xs">Simple text questions without options</p>
                        <p className="font-medium">📝 Subjective/Essay:</p>
                        <p className="text-xs">Include &quot;explain&quot;, &quot;describe&quot;, &quot;discuss&quot; in question</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Paste Questions</label>
                      <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="Paste your questions here. You can use '---' to separate questions or just start each new question with 'Q:'"
                        className="w-full h-80 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Expected Format</label>
                      <div className="bg-gray-50 p-4 rounded-xl h-80 overflow-y-auto font-mono text-sm">
                        <div className="mb-4 text-xs text-blue-600 font-semibold">Option 1: With separators (recommended)</div>
                        <pre className="mb-6">{`Q: What is 2 + 2?
A: 3
B: 4
C: 5
D: 6
Correct: B
Points: 1
Explanation: Basic addition
---
Q: Is the earth round?
Correct: True
Points: 1
---
Q: Fill in the gap: The capital of Nigeria is _____.
Correct: Abuja
Points: 2
---
Q: Explain the importance of education in personal development.
Correct: Education provides knowledge, critical thinking skills, and opportunities for career advancement.
Points: 3
---`}</pre>
                        <div className="mb-4 text-xs text-green-600 font-semibold">Option 2: Without separators (auto-detect)</div>
                        <pre>{`Q: What gas do plants absorb?
A: Oxygen
B: Carbon Dioxide
C: Nitrogen
D: Hydrogen
Correct: B
Points: 1
Q: Capital of Nigeria?
Correct: Abuja
Points: 2
Q: Is water wet?
Correct: True
Points: 1
Q: Fill in the blank: Water boils at _____ degrees Celsius.
Correct: 100
Points: 1
Q: Describe the water cycle process.
Correct: The water cycle involves evaporation, condensation, precipitation, and collection.
Points: 2`}</pre>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <MagneticButton
                      onClick={handleBulkImport}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Import Questions
                    </MagneticButton>
                    <MagneticButton
                      onClick={() => setShowBulkImport(false)}
                      variant="outline"
                      className="flex-1 py-3 rounded-xl"
                    >
                      Cancel
                    </MagneticButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question Preview Modal */}
          <AnimatePresence>
            {previewQuestion && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold flex items-center">
                      <Eye className="w-6 h-6 text-purple-600 mr-2" />
                      Student Preview
                    </h3>
                    <button
                      onClick={() => setPreviewQuestion(null)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Exam Interface Preview */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6 mb-4">
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">Question Preview</span>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {previewQuestion.points} {previewQuestion.points === 1 ? 'point' : 'points'}
                        </span>
                      </div>
                      
                      <h2 className="text-lg font-semibold text-gray-900 mb-6">
                        {previewQuestion.question_text}
                      </h2>

                      {previewQuestion.question_type === 'multiple_choice' && previewQuestion.options && (
                        <div className="space-y-3">
                          {Object.entries(previewQuestion.options).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
                            >
                              <div className="flex items-center justify-center w-8 h-8 border-2 border-gray-300 rounded-full mr-4">
                                <span className="text-sm font-medium text-gray-600">{key}</span>
                              </div>
                              <span className="text-gray-700">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {previewQuestion.question_type === 'true_false' && (
                        <div className="space-y-3">
                          <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer">
                            <div className="flex items-center justify-center w-8 h-8 border-2 border-gray-300 rounded-full mr-4">
                              <span className="text-sm font-medium text-gray-600">A</span>
                            </div>
                            <span className="text-gray-700">True</span>
                          </div>
                          <div className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer">
                            <div className="flex items-center justify-center w-8 h-8 border-2 border-gray-300 rounded-full mr-4">
                              <span className="text-sm font-medium text-gray-600">B</span>
                            </div>
                            <span className="text-gray-700">False</span>
                          </div>
                        </div>
                      )}

                      {previewQuestion.question_type === 'short_answer' && (
                        <div className="mt-4">
                          <div className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50">
                            <span className="text-gray-500 italic">Student will type their answer here...</span>
                          </div>
                        </div>
                      )}

                      {previewQuestion.question_type === 'fill_in_gap' && (
                        <div className="mt-4">
                          <div className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50">
                            <span className="text-gray-500 italic">Student will fill in the blank space...</span>
                          </div>
                        </div>
                      )}

                      {previewQuestion.question_type === 'subjective' && (
                        <div className="mt-4">
                          <div className="w-full p-4 border-2 border-gray-200 rounded-xl bg-gray-50">
                            <span className="text-gray-500 italic">Student will write their essay/explanation here...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Answer Information for Teacher */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Answer Information (Teacher Only)
                    </h4>
                    <div className="text-sm text-green-700">
                      <p><strong>Correct Answer:</strong> {previewQuestion.correct_answer}</p>
                      <p><strong>Question Type:</strong> {previewQuestion.question_type.replace('_', ' ')}</p>
                      {previewQuestion.explanation && (
                        <p><strong>Explanation:</strong> {previewQuestion.explanation}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <MagneticButton
                      onClick={() => setPreviewQuestion(null)}
                      variant="outline"
                      className="px-6 py-2"
                    >
                      Close Preview
                    </MagneticButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}