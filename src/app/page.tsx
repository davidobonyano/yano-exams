'use client'

import { motion } from 'framer-motion'
import { useSession } from '@/context/SimpleSessionContext'
import StudentPortal from '@/components/student/StudentPortal'
import SessionDashboard from '@/components/session/SessionDashboard'

export default function Home() {
  const { session, loading } = useSession()

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
            className="text-lg font-medium text-muted-foreground"
          >
            Initializing YANO Platform...
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

  // For the simplified student flow, we always show StudentPortal
  // SessionDashboard is not used in this flow

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen"
    >
      <StudentPortal />
    </motion.div>
  )
}
