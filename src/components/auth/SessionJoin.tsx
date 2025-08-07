'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { useSession } from '@/context/SessionContext'
import { ClassLevel } from '@/types/database-v2'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FloatingInput } from '@/components/ui/floating-input'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { ModernBackground } from '@/components/ui/modern-background'
import { EnhancedSelect } from '@/components/ui/enhanced-select'
import { TextReveal, GradientText } from '@/components/ui/text-effects'
import { BookOpen, Users, GraduationCap, Loader2, User, Hash, School, Award } from 'lucide-react'
import toast from 'react-hot-toast'

const CLASS_LEVELS: { value: ClassLevel; label: string }[] = [
  { value: 'JSS1', label: '🎓 Junior Secondary School 1 (JSS1)' },
  { value: 'JSS2', label: '🎓 Junior Secondary School 2 (JSS2)' },
  { value: 'JSS3', label: '🎓 Junior Secondary School 3 (JSS3)' },
  { value: 'SS1', label: '🏆 Senior Secondary School 1 (SS1)' },
  { value: 'SS2', label: '🏆 Senior Secondary School 2 (SS2)' },
  { value: 'SS3', label: '🏆 Senior Secondary School 3 (SS3)' },
]

const formSchema = z.object({
  sessionCode: z.string().regex(/^\d{6}$/, 'Session code must be exactly 6 digits'),
  studentId: z.string().min(1, 'Student ID is required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  classLevel: z.enum(['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3']),
  schoolName: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export default function SessionJoin() {
  const { joinSession } = useSession()
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sessionCode: '',
      studentId: '',
      fullName: '',
      classLevel: 'JSS1',
      schoolName: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const result = await joinSession(
        data.sessionCode,
        data.studentId,
        data.fullName,
        data.classLevel,
        data.schoolName || undefined
      )

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Successfully joined exam session!')
      }
    } catch (err) {
      toast.error('An unexpected error occurred')
    }
  }

  return (
    <ModernBackground variant="default">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-4xl"
        >
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-center mb-12"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 20 }}
              className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-full flex items-center justify-center mb-8 shadow-2xl"
            >
              <Award className="w-10 h-10 text-white" />
            </motion.div>
            
            <TextReveal
              text="Join Your Exam Session"
              className="text-5xl md:text-6xl font-bold mb-4"
              delay={0.6}
            />
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="text-xl text-gray-600 max-w-2xl mx-auto"
            >
              Enter your credentials to access your personalized exam experience
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Features Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="lg:col-span-1 space-y-4"
            >
              {[
                {
                  icon: <BookOpen className="w-6 h-6" />,
                  title: 'Secure Testing',
                  description: 'Advanced anti-cheating protection',
                  color: 'from-blue-500 to-cyan-500'
                },
                {
                  icon: <Users className="w-6 h-6" />,
                  title: 'Live Monitoring',
                  description: 'Real-time session tracking',
                  color: 'from-purple-500 to-pink-500'
                },
                {
                  icon: <Award className="w-6 h-6" />,
                  title: 'Instant Results',
                  description: 'Immediate feedback & certificates',
                  color: 'from-green-500 to-emerald-500'
                }
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4 + index * 0.1, duration: 0.6 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  className="group"
                >
                  <div className="p-6 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 hover:bg-white/30 transition-all duration-300">
                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <div className="text-white">
                        {feature.icon}
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Main Form */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.6, duration: 0.8 }}
              className="lg:col-span-2"
            >
              <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />
                
                <CardHeader className="text-center p-8">
                  <CardTitle className="text-3xl font-bold mb-2">
                    <GradientText 
                      text="Student Access Portal"
                      gradient="from-blue-600 via-purple-600 to-cyan-600"
                    />
                  </CardTitle>
                  <CardDescription className="text-lg">
                    Fill in your details to begin your examination
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-8 pt-0">
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {/* Session Code */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.8, duration: 0.6 }}
                    >
                      <FloatingInput
                        label="Session Code"
                        icon={<Hash className="w-5 h-5" />}
                        className="text-center text-xl font-mono tracking-widest h-14"
                        maxLength={6}
                        {...form.register('sessionCode')}
                        error={form.formState.errors.sessionCode?.message}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                          form.setValue('sessionCode', value)
                        }}
                      />
                      <p className="text-sm text-gray-500 mt-2 text-center">
                        Get the 6-digit code from your teacher
                      </p>
                    </motion.div>

                    {/* Student Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2, duration: 0.6 }}
                      >
                        <FloatingInput
                          label="Student ID"
                          icon={<User className="w-5 h-5" />}
                          {...form.register('studentId')}
                          error={form.formState.errors.studentId?.message}
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2.1, duration: 0.6 }}
                      >
                        <FloatingInput
                          label="Full Name"
                          icon={<User className="w-5 h-5" />}
                          {...form.register('fullName')}
                          error={form.formState.errors.fullName?.message}
                        />
                      </motion.div>
                    </div>

                    {/* Class Level and School */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2.2, duration: 0.6 }}
                        className="space-y-2"
                      >
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <GraduationCap className="w-4 h-4" />
                          Class Level
                        </label>
                        <EnhancedSelect
                          options={CLASS_LEVELS}
                          value={form.watch('classLevel')}
                          onChange={(value) => form.setValue('classLevel', value as ClassLevel)}
                          placeholder="Select your class level"
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2.3, duration: 0.6 }}
                      >
                        <FloatingInput
                          label="School Name (Optional)"
                          icon={<School className="w-5 h-5" />}
                          {...form.register('schoolName')}
                        />
                      </motion.div>
                    </div>

                    {/* Submit Button */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 2.4, duration: 0.6 }}
                      className="pt-4"
                    >
                      <button
                        type="submit"
                        disabled={form.formState.isSubmitting}
                        className="w-full h-16 text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {form.formState.isSubmitting ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-6 h-6 border-2 border-white border-t-transparent rounded-full mr-3"
                            />
                            Joining Session...
                          </>
                        ) : (
                          <>
                            <Award className="w-6 h-6 mr-3" />
                            Join Exam Session
                          </>
                        )}
                      </button>
                    </motion.div>
                  </form>

                  {/* Instructions */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.6, duration: 0.6 }}
                    className="mt-8 p-6 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20"
                  >
                    <h3 className="font-bold text-center mb-4 flex items-center justify-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      How to Join
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      {[
                        { step: '1', text: 'Get session code', color: 'bg-blue-500' },
                        { step: '2', text: 'Enter your details', color: 'bg-purple-500' },
                        { step: '3', text: 'Select class level', color: 'bg-cyan-500' },
                        { step: '4', text: 'Start your exam', color: 'bg-green-500' }
                      ].map((item, index) => (
                        <motion.div
                          key={item.step}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 2.8 + index * 0.1, duration: 0.4 }}
                          className="flex flex-col items-center space-y-2"
                        >
                          <div className={`w-8 h-8 ${item.color} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                            {item.step}
                          </div>
                          <span className="text-xs text-gray-600">{item.text}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </ModernBackground>
  )
}