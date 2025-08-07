'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface ModernBackgroundProps {
  variant?: 'default' | 'gradient' | 'dots' | 'waves'
  children?: React.ReactNode
  className?: string
}

export function ModernBackground({ 
  variant = 'default', 
  children, 
  className = '' 
}: ModernBackgroundProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const backgroundVariants = {
    default: (
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.1), transparent 40%)`
            }}
          />
        </div>
        
        {/* Floating geometric shapes */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-blue-200/20 rounded-full"
            style={{
              width: Math.random() * 300 + 100,
              height: Math.random() * 300 + 100,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              x: [0, Math.random() * 100 - 50],
              y: [0, Math.random() * 100 - 50],
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
        ))}
        
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-5">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px'
            }}
          />
        </div>
      </div>
    ),
    
    gradient: (
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
          animate={{
            background: [
              'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            ]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>
    ),
    
    dots: (
      <div className="absolute inset-0 overflow-hidden bg-white">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(59, 130, 246, 0.2) 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
          }}
          animate={{
            backgroundPosition: ['0px 0px', '30px 30px'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        
        {/* Animated dots */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
    ),
    
    waves: (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100" />
        
        {/* Animated waves */}
        <svg className="absolute bottom-0 left-0 w-full h-full" viewBox="0 0 1200 400">
          <motion.path
            d="M0,400 C300,300 600,200 1200,300 L1200,400 Z"
            fill="rgba(59, 130, 246, 0.1)"
            animate={{
              d: [
                "M0,400 C300,300 600,200 1200,300 L1200,400 Z",
                "M0,400 C300,250 600,350 1200,250 L1200,400 Z",
                "M0,400 C300,300 600,200 1200,300 L1200,400 Z"
              ]
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.path
            d="M0,400 C400,250 800,350 1200,250 L1200,400 Z"
            fill="rgba(147, 51, 234, 0.1)"
            animate={{
              d: [
                "M0,400 C400,250 800,350 1200,250 L1200,400 Z",
                "M0,400 C400,300 800,200 1200,350 L1200,400 Z",
                "M0,400 C400,250 800,350 1200,250 L1200,400 Z"
              ]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
          />
        </svg>
      </div>
    )
  }

  return (
    <div className={`relative min-h-screen ${className}`}>
      {backgroundVariants[variant]}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

// Preset layouts inspired by motion-primitives and ui-layouts
export function HeroSection({ 
  title, 
  subtitle, 
  children 
}: { 
  title: string
  subtitle?: string
  children?: React.ReactNode 
}) {
  return (
    <ModernBackground variant="default">
      <div className="flex items-center justify-center min-h-screen p-8">
        <motion.div
          className="text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.h1
            className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            {title}
          </motion.h1>
          
          {subtitle && (
            <motion.p
              className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              {subtitle}
            </motion.p>
          )}
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            {children}
          </motion.div>
        </motion.div>
      </div>
    </ModernBackground>
  )
}

export function GridBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-white">
      {/* Animated grid */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
          animate={{
            backgroundPosition: ['0px 0px', '40px 40px'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        
        {/* Spotlight effect */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(600px circle at 50% 50%, rgba(59, 130, 246, 0.1), transparent 70%)'
          }}
          animate={{
            background: [
              'radial-gradient(600px circle at 50% 50%, rgba(59, 130, 246, 0.1), transparent 70%)',
              'radial-gradient(800px circle at 30% 70%, rgba(147, 51, 234, 0.1), transparent 70%)',
              'radial-gradient(600px circle at 70% 30%, rgba(6, 182, 212, 0.1), transparent 70%)',
              'radial-gradient(600px circle at 50% 50%, rgba(59, 130, 246, 0.1), transparent 70%)'
            ]
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}