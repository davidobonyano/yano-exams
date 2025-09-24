'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { ClassLevel } from '@/types/database'

interface CentralizedStudent {
  student_id: string
  full_name: string
  class_level: ClassLevel
  section: string
  academic_year: number
  school_name: string
  teacher_name: string | null
  admission_date: string
  is_active: boolean
}

interface ClassStatistics {
  class_level: ClassLevel
  section: string
  academic_year: number
  total_students: number
  active_students: number
  teacher_name: string | null
}

interface CentralizedStudentManagementProps {
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

const SECTIONS = ['A', 'B', 'C', 'D', 'E']
const ACADEMIC_YEARS = [2024, 2023, 2022, 2021, 2020, 2019]

export default function CentralizedStudentManagement({ teacherId, onClose }: CentralizedStudentManagementProps) {
  const [students, setStudents] = useState<CentralizedStudent[]>([])
  const [classStats, setClassStats] = useState<ClassStatistics[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState<ClassLevel | 'all'>('all')
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)

  // Form states
  const [fullName, setFullName] = useState('')
  const [classLevel, setClassLevel] = useState<ClassLevel>('JSS1')
  const [section, setSection] = useState('A')
  const [academicYear, setAcademicYear] = useState(2024)
  const [schoolName, setSchoolName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [bulkText, setBulkText] = useState('')

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_all_students_for_admin', {
        p_academic_year: selectedYear === 'all' ? null : selectedYear,
        p_class_level: selectedClass === 'all' ? null : selectedClass,
        p_section: selectedSection === 'all' ? null : selectedSection
      })

      if (error) throw error
      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
      toast.error('Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedClass, selectedSection])

  const fetchClassStatistics = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_class_statistics')
      if (error) throw error
      setClassStats(data || [])
    } catch (error) {
      console.error('Error fetching class statistics:', error)
    }
  }, [])

  useEffect(() => {
    fetchStudents()
    fetchClassStatistics()
  }, [teacherId, fetchStudents, fetchClassStatistics])

  const resetForm = () => {
    setFullName('')
    setClassLevel('JSS1')
    setSection('A')
    setAcademicYear(2024)
    setSchoolName('')
    setEmail('')
    setPhone('')
    setParentName('')
    setParentPhone('')
  }

  const handleAddStudent = async () => {
    if (!fullName.trim() || !schoolName.trim()) {
      toast.error('Full name and school name are required')
      return
    }

    try {
      const { data, error } = await supabase.rpc('add_centralized_student', {
        p_full_name: fullName.trim(),
        p_class_level: classLevel,
        p_section: section,
        p_academic_year: academicYear,
        p_school_name: schoolName.trim(),
        p_teacher_id: teacherId,
        p_email: email.trim() || null,
        p_phone: phone.trim() || null,
        p_parent_name: parentName.trim() || null,
        p_parent_phone: parentPhone.trim() || null
      })

      if (error) throw error

      const result = data
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`Student added successfully! ID: ${result.student_id}`)
      fetchStudents()
      fetchClassStatistics()
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding student:', error)
      toast.error('Failed to add student')
    }
  }

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Please enter student data')
      return
    }

    const lines = bulkText.trim().split('\n').filter(line => line.trim())
    let successCount = 0
    let errorCount = 0

    for (const line of lines) {
      const parts = line.split(',').map(part => part.trim())
      if (parts.length < 4) {
        errorCount++
        continue
      }

      const [name, classLevel, section, schoolName, email = '', phone = '', parentName = '', parentPhone = ''] = parts

      try {
        const { data, error } = await supabase.rpc('add_centralized_student', {
          p_full_name: name,
          p_class_level: classLevel as ClassLevel,
          p_section: section,
          p_academic_year: academicYear,
          p_school_name: schoolName,
          p_teacher_id: teacherId,
          p_email: email || null,
          p_phone: phone || null,
          p_parent_name: parentName || null,
          p_parent_phone: parentPhone || null
        })

        if (error || !data.success) {
          errorCount++
        } else {
          successCount++
        }
      } catch (error) {
        errorCount++
      }
    }

    toast.success(`Bulk import completed: ${successCount} successful, ${errorCount} failed`)
    setBulkText('')
    setShowBulkImport(false)
    fetchStudents()
    fetchClassStatistics()
  }

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.school_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Note: previously had an unused helper getClassStats; removed to satisfy linter

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              🎓 Centralized Student Management
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-600 mt-2">
            Manage all students across all classes with year-based IDs and sections A-E
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value as ClassLevel | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes</option>
              {CLASS_LEVELS.map(level => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sections</option>
              {SECTIONS.map(section => (
                <option key={section} value={section}>Section {section}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Years</option>
              {ACADEMIC_YEARS.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              ➕ Add Student
            </button>
            <button
              onClick={() => setShowBulkImport(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              📥 Bulk Import
            </button>
            <button
              onClick={fetchStudents}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Class Statistics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">📊 Class Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classStats.slice(0, 9).map((stat, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                  <div className="font-semibold text-gray-800">
                    {stat.class_level} {stat.section} ({stat.academic_year})
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Students: {stat.active_students}/{stat.total_students}
                  </div>
                  {stat.teacher_name && (
                    <div className="text-xs text-gray-500 mt-1">
                      Teacher: {stat.teacher_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                👥 Students ({filteredStudents.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      School
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Loading students...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.student_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.class_level} {student.section} ({student.academic_year})
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.school_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.teacher_name || 'Unassigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            student.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {student.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Add Student Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Student</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value as ClassLevel)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CLASS_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SECTIONS.map(section => (
                    <option key={section} value={section}>Section {section}</option>
                  ))}
                </select>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACADEMIC_YEARS.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="School Name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Parent Name (optional)"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Parent Phone (optional)"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleAddStudent}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Student
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showBulkImport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Bulk Import Students</h3>
              <p className="text-sm text-gray-600 mb-4">
                Format: Name, Class, Section, School, Email, Phone, Parent Name, Parent Phone
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Alice Johnson, JSS1, A, Demo School, alice@demo.com, 08012345678, Mr. Johnson, 08087654321&#10;Bob Smith, JSS1, A, Demo School, bob@demo.com, 08023456789, Mrs. Smith, 08076543210"
                className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleBulkImport}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Import Students
                </button>
                <button
                  onClick={() => {
                    setShowBulkImport(false)
                    setBulkText('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
