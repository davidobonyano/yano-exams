'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ClassLevel } from '@/types/database-v2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { EnhancedSelect } from '@/components/ui/enhanced-select'
import { 
  Plus, 
  Search, 
  Users, 
  GraduationCap, 
  Phone, 
  Mail, 
  Edit, 
  Trash2, 
  Eye,
  Download,
  Upload,
  UserPlus,
  BookOpen,
  Trophy,
  AlertTriangle,
  CheckCircle,
  X,
  School,
  User,
  Hash
} from 'lucide-react'
import toast from 'react-hot-toast'

interface TeacherStudent {
  id: string
  student_id: string
  full_name: string
  class_level: ClassLevel
  school_name: string
  email?: string
  phone?: string
  parent_name?: string
  parent_phone?: string
  is_active: boolean
  created_at: string
}

interface StudentManagementProps {
  teacherId: string
  onClose: () => void
}

const CLASS_LEVELS: { value: ClassLevel; label: string }[] = [
  { value: 'JSS1', label: '🎓 Junior Secondary School 1 (JSS1)' },
  { value: 'JSS2', label: '🎓 Junior Secondary School 2 (JSS2)' },
  { value: 'JSS3', label: '🎓 Junior Secondary School 3 (JSS3)' },
  { value: 'SS1', label: '🏆 Senior Secondary School 1 (SS1)' },
  { value: 'SS2', label: '🏆 Senior Secondary School 2 (SS2)' },
  { value: 'SS3', label: '🏆 Senior Secondary School 3 (SS3)' },
]

export default function StudentManagement({ teacherId, onClose }: StudentManagementProps) {
  const [students, setStudents] = useState<TeacherStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState<ClassLevel | 'all'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [editingStudent, setEditingStudent] = useState<TeacherStudent | null>(null)

  // Form states
  const [fullName, setFullName] = useState('')
  const [classLevel, setClassLevel] = useState<ClassLevel>('JSS1')
  const [schoolName, setSchoolName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [customSection, setCustomSection] = useState('A')

  useEffect(() => {
    fetchStudents()
  }, [teacherId])

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('teacher_students')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFullName('')
    setClassLevel('JSS1')
    setSchoolName('')
    setEmail('')
    setPhone('')
    setParentName('')
    setParentPhone('')
    setEditingStudent(null)
  }

  const handleAddStudent = async () => {
    if (!fullName.trim() || !schoolName.trim()) {
      toast.error('Full name and school name are required')
      return
    }

    try {
      const { data, error } = await supabase.rpc('add_student_to_class', {
        p_teacher_id: teacherId,
        p_full_name: fullName.trim(),
        p_class_level: classLevel,
        p_school_name: schoolName.trim(),
        p_email: email.trim() || null,
        p_phone: phone.trim() || null,
        p_parent_name: parentName.trim() || null,
        p_parent_phone: parentPhone.trim() || null,
        p_section: customSection || 'A'
      })

      if (error) throw error

      const result = data
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Student added successfully!')
      fetchStudents()
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding student:', error)
      toast.error('Failed to add student')
    }
  }

  const handleEditStudent = async () => {
    if (!editingStudent || !fullName.trim() || !schoolName.trim()) {
      toast.error('Full name and school name are required')
      return
    }

    try {
      const { error } = await supabase
        .from('teacher_students')
        .update({
          full_name: fullName.trim(),
          class_level: classLevel,
          school_name: schoolName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          parent_name: parentName.trim() || null,
          parent_phone: parentPhone.trim() || null
        })
        .eq('id', editingStudent.id)

      if (error) throw error

      toast.success('Student updated successfully!')
      fetchStudents()
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      console.error('Error updating student:', error)
      toast.error('Failed to update student')
    }
  }

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) return

    try {
      const { error } = await supabase
        .from('teacher_students')
        .delete()
        .eq('id', studentId)

      if (error) throw error

      toast.success('Student deleted successfully!')
      fetchStudents()
    } catch (error) {
      console.error('Error deleting student:', error)
      toast.error('Failed to delete student')
    }
  }

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Please paste student data')
      return
    }

    try {
      const studentsToImport = parseBulkStudents(bulkText)
      
      if (studentsToImport.length === 0) {
        toast.error('No valid students found. Please check the format.')
        return
      }

      let successCount = 0
      let errorCount = 0

      for (const student of studentsToImport) {
        try {
          const { data, error } = await supabase.rpc('add_student_to_class', {
            p_teacher_id: teacherId,
            p_full_name: student.full_name,
            p_class_level: student.class_level,
            p_school_name: student.school_name,
            p_email: student.email,
            p_phone: student.phone,
            p_parent_name: student.parent_name,
            p_parent_phone: student.parent_phone,
            p_section: customSection
          })

          if (error) throw error

          const result = data
          if (result.success) {
            successCount++
          } else {
            errorCount++
            console.error('Student import failed:', student.full_name, result.error)
          }
        } catch (error) {
          errorCount++
          console.error('Error importing student:', student.full_name, error)
        }
      }

      toast.success(`${successCount} students imported successfully! ${errorCount > 0 ? `${errorCount} failed.` : ''}`)
      fetchStudents()
      setBulkText('')
      setShowBulkImport(false)
    } catch (error) {
      console.error('Error importing students:', error)
      toast.error('Failed to import students')
    }
  }

  const parseBulkStudents = (text: string) => {
    const students: Omit<TeacherStudent, 'id' | 'student_id' | 'is_active' | 'created_at'>[] = []
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean)

    lines.forEach(line => {
      // Expected format: Name, Class, School, Email, Phone, Parent Name, Parent Phone
      const parts = line.split(',').map(part => part.trim())
      
      if (parts.length >= 3) {
        const [name, classLevel, school, email, phone, parentName, parentPhone] = parts
        
        if (name && classLevel && school) {
          const validClassLevel = CLASS_LEVELS.find(cl => 
            cl.value.toLowerCase() === classLevel.toLowerCase() || 
            cl.label.toLowerCase() === classLevel.toLowerCase()
          )

          if (validClassLevel) {
            students.push({
              full_name: name,
              class_level: validClassLevel.value,
              school_name: school,
              email: email || undefined,
              phone: phone || undefined,
              parent_name: parentName || undefined,
              parent_phone: parentPhone || undefined
            })
          }
        }
      }
    })

    return students
  }

  const startEdit = (student: TeacherStudent) => {
    setEditingStudent(student)
    setFullName(student.full_name)
    setClassLevel(student.class_level)
    setSchoolName(student.school_name)
    setEmail(student.email || '')
    setPhone(student.phone || '')
    setParentName(student.parent_name || '')
    setParentPhone(student.parent_phone || '')
    setShowAddForm(true)
  }

  const exportStudents = () => {
    const csvContent = [
      'Student ID,Full Name,Class Level,School Name,Email,Phone,Parent Name,Parent Phone,Created At',
      ...filteredStudents.map(student => 
        `${student.student_id},"${student.full_name}",${student.class_level},"${student.school_name}","${student.email || ''}","${student.phone || ''}","${student.parent_name || ''}","${student.parent_phone || ''}",${student.created_at}`
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.school_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesClass = selectedClass === 'all' || student.class_level === selectedClass
    return matchesSearch && matchesClass
  })

  const classStats = CLASS_LEVELS.reduce((acc, level) => {
    acc[level.value] = students.filter(s => s.class_level === level.value).length
    return acc
  }, {} as Record<ClassLevel, number>)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-7xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Users className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">Student Management</h2>
                  <p className="opacity-90">Manage your class roster and generate student IDs</p>
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

          {/* Stats Bar */}
          <div className="bg-gray-50 p-4 border-b">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Card className="p-3">
                <div className="text-center">
                  <Users className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                  <div className="font-bold text-lg">{students.length}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
              </Card>
              {CLASS_LEVELS.map(level => (
                <Card key={level.value} className="p-3">
                  <div className="text-center">
                    <GraduationCap className="w-6 h-6 mx-auto mb-1 text-purple-500" />
                    <div className="font-bold text-lg">{classStats[level.value]}</div>
                    <div className="text-sm text-gray-600">{level.value}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Actions Bar */}
          <div className="p-6 border-b bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                  />
                </div>
                
                <EnhancedSelect
                  options={[
                    { value: 'all', label: '📚 All Classes' },
                    ...CLASS_LEVELS
                  ]}
                  value={selectedClass}
                  onChange={(value) => setSelectedClass(value as ClassLevel | 'all')}
                  placeholder="Filter by class"
                  className="min-w-[200px]"
                />
              </div>

              <div className="flex items-center space-x-3">
                <MagneticButton
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Student
                </MagneticButton>
                
                <MagneticButton
                  onClick={() => setShowBulkImport(true)}
                  variant="outline"
                  className="px-4 py-2 rounded-xl"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk Import
                </MagneticButton>

                <MagneticButton
                  onClick={exportStudents}
                  variant="outline"
                  className="px-4 py-2 rounded-xl"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </MagneticButton>
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="p-6 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Loading students...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No students found. Start by adding your first student!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left p-3 font-semibold">Student ID</th>
                      <th className="text-left p-3 font-semibold">Full Name</th>
                      <th className="text-left p-3 font-semibold">Class</th>
                      <th className="text-left p-3 font-semibold">School</th>
                      <th className="text-left p-3 font-semibold">Contact</th>
                      <th className="text-center p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center">
                            <Hash className="w-4 h-4 mr-2 text-blue-500" />
                            <span className="font-mono font-medium">{student.student_id}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="font-medium">{student.full_name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm font-medium">
                            {student.class_level}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center">
                            <School className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="text-sm">{student.school_name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm space-y-1">
                            {student.email && (
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-1 text-gray-400" />
                                <span>{student.email}</span>
                              </div>
                            )}
                            {student.phone && (
                              <div className="flex items-center">
                                <Phone className="w-3 h-3 mr-1 text-gray-400" />
                                <span>{student.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => startEdit(student)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="Edit Student"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Delete Student"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add/Edit Student Modal */}
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
                      {editingStudent ? 'Edit Student' : 'Add New Student'}
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
                    {!editingStudent && (
                      <div className="bg-blue-50 p-4 rounded-xl">
                        <h4 className="font-medium mb-2 flex items-center">
                          <Hash className="w-4 h-4 mr-2" />
                          Student ID Settings
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class Section</label>
                            <select
                              value={customSection}
                              onChange={(e) => setCustomSection(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="A">Section A</option>
                              <option value="B">Section B</option>
                              <option value="C">Section C</option>
                              <option value="D">Section D</option>
                              <option value="E">Section E</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ID Preview</label>
                            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg font-mono">
                              {classLevel}{customSection}-001
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          Students will get IDs like: {classLevel}{customSection}-001, {classLevel}{customSection}-002, etc.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        label="Full Name *"
                        icon={<User className="w-5 h-5" />}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter student's full name"
                      />

                      <EnhancedSelect
                        label="Class Level *"
                        options={CLASS_LEVELS}
                        value={classLevel}
                        onChange={(value) => setClassLevel(value as ClassLevel)}
                        placeholder="Select class level"
                      />
                    </div>

                    <FloatingInput
                      label="School Name *"
                      icon={<School className="w-5 h-5" />}
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Enter school name"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        label="Email (Optional)"
                        icon={<Mail className="w-5 h-5" />}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="student@email.com"
                      />

                      <FloatingInput
                        label="Phone (Optional)"
                        icon={<Phone className="w-5 h-5" />}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Student's phone number"
                      />
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-4 text-gray-700">Parent/Guardian Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FloatingInput
                          label="Parent Name (Optional)"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          placeholder="Parent/Guardian name"
                        />

                        <FloatingInput
                          label="Parent Phone (Optional)"
                          icon={<Phone className="w-5 h-5" />}
                          value={parentPhone}
                          onChange={(e) => setParentPhone(e.target.value)}
                          placeholder="Parent's phone number"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <MagneticButton
                        onClick={editingStudent ? handleEditStudent : handleAddStudent}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl"
                      >
                        {editingStudent ? 'Update Student' : 'Add Student'}
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
                    <h3 className="text-xl font-bold">Bulk Import Students</h3>
                    <button
                      onClick={() => setShowBulkImport(false)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Class Section for All Students</label>
                        <select
                          value={customSection}
                          onChange={(e) => setCustomSection(e.target.value)}
                          className="w-full max-w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="A">Section A</option>
                          <option value="B">Section B</option>
                          <option value="C">Section C</option>
                          <option value="D">Section D</option>
                          <option value="E">Section E</option>
                        </select>
                        <p className="text-sm text-gray-600 mt-1">
                          All imported students will be assigned to this section
                        </p>
                      </div>
                      
                      <label className="block text-sm font-medium mb-2">Paste Student Data</label>
                      <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="Paste student data here..."
                        className="w-full h-80 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Expected Format</label>
                      <div className="bg-gray-50 p-4 rounded-xl h-80 overflow-y-auto font-mono text-sm">
                        <div className="mb-4">
                          <p className="font-medium mb-2">One student per line, comma-separated:</p>
                          <p className="text-xs text-gray-600 mb-4">
                            Name, Class, School, Email, Phone, Parent Name, Parent Phone
                          </p>
                        </div>
                        <pre className="text-xs">{`John Doe, JSS1, Green Valley School, john@email.com, 08012345678, Jane Doe, 08087654321
Mary Smith, JSS2, Blue Ridge Academy, mary@email.com, 08023456789, Bob Smith, 08098765432
David Johnson, SS1, Hill Top College, david@email.com, 08034567890, Lisa Johnson, 08076543210
Sarah Wilson, SS2, Valley High School
Mike Brown, JSS3, Oak Tree Academy, mike@email.com`}</pre>
                        
                        <div className="mt-4 p-3 bg-blue-50 rounded">
                          <p className="text-xs text-blue-800">
                            <strong>Note:</strong> Only Name, Class, and School are required. 
                            Other fields are optional.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <MagneticButton
                      onClick={handleBulkImport}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Import Students
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
        </motion.div>
      </div>
    </div>
  )
}