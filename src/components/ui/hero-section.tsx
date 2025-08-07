'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { GraduationCap, BookOpen, Users, Award, ArrowRight, Sparkles } from 'lucide-react'
import { GradientText, TextReveal, FloatingText } from './text-effects'
import { MagneticButton, GlowButton } from './magnetic-button'
import { AnimatedBackground, GlowingOrb } from './animated-background'
import { useRef } from 'react'

interface HeroSectionProps {
  onGetStarted: () => void
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start']
  })

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])

  const features = [
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: 'Smart Testing',
      description: 'AI-powered adaptive questioning',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Real-time Monitoring',
      description: 'Live session tracking & analytics',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: 'Instant Results',
      description: 'Immediate feedback & certificates',
      color: 'from-green-500 to-emerald-500'
    }
  ]

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden">
      <AnimatedBackground />
      
      {/* Floating orbs */}
      <GlowingOrb className="top-20 right-20 w-32 h-32 bg-blue-500" />
      <GlowingOrb className="bottom-20 left-20 w-24 h-24 bg-purple-500" />
      <GlowingOrb className="top-1/2 left-1/2 w-16 h-16 bg-cyan-500" />

      <motion.div 
        className="relative z-10 container mx-auto px-4 py-20"
        style={{ y, opacity }}
      >
        <div className="text-center space-y-8">
          {/* Main Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full border border-white/30"
            >
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium">Revolutionizing Education</span>
            </motion.div>

            {/* Main heading */}
            <div className="space-y-4">
              <h1 className="text-6xl md:text-8xl font-bold leading-tight">
                <TextReveal 
                  text="YANO" 
                  className="block"
                  delay={0.6}
                />
                <GradientText 
                  text="Exam Platform"
                  className="text-5xl md:text-7xl block mt-2"
                  gradient="from-blue-600 via-purple-600 to-cyan-600"
                />
              </h1>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.2 }}
                className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed"
              >
                Experience the future of digital assessments with our AI-powered exam platform designed for Nigerian schools
              </motion.p>
            </div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8"
            >
              <GlowButton
                onClick={onGetStarted}
                className="text-lg px-8 py-4"
              >
                Get Started Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </GlowButton>
              
              <MagneticButton
                variant="outline"
                size="lg"
                className="text-lg"
              >
                Watch Demo
              </MagneticButton>
            </motion.div>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.8 + index * 0.2 }}
                whileHover={{ scale: 1.05, y: -10 }}
                className="group"
              >
                <div className="relative p-8 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300">
                  {/* Icon with gradient background */}
                  <motion.div
                    className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${feature.color} mb-4`}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div className="text-white">
                      {feature.icon}
                    </div>
                  </motion.div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>

                  {/* Hover glow effect */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `linear-gradient(45deg, ${feature.color.includes('blue') ? 'rgba(59, 130, 246, 0.1)' : feature.color.includes('purple') ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)'})`,
                      filter: 'blur(20px)',
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 2.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 p-8 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20"
          >
            {[
              { value: '10,000+', label: 'Students' },
              { value: '500+', label: 'Schools' },
              { value: '50,000+', label: 'Exams Taken' },
              { value: '99.9%', label: 'Uptime' }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 2.6 + index * 0.1 }}
                className="text-center"
              >
                <FloatingText
                  text={stat.value}
                  className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                />
                <p className="text-gray-600 mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 3 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-gray-400 rounded-full mt-2"
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}