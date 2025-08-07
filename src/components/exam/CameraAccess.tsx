'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MagneticButton } from '@/components/ui/magnetic-button'
import { 
  Camera, 
  CameraOff, 
  AlertTriangle, 
  CheckCircle, 
  Shield,
  Eye,
  Lock
} from 'lucide-react'

interface CameraAccessProps {
  onCameraGranted: (stream: MediaStream) => void
  onCameraDeclined: () => void
  sessionName: string
  cameraRequired: boolean
}

export default function CameraAccess({ 
  onCameraGranted, 
  onCameraDeclined, 
  sessionName, 
  cameraRequired 
}: CameraAccessProps) {
  const [status, setStatus] = useState<'requesting' | 'granted' | 'denied' | 'error'>('requesting')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const requestCameraAccess = async () => {
    try {
      setStatus('requesting')
      setError('')

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      })

      setStream(mediaStream)
      setStatus('granted')

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }

      // Call the callback after a short delay to show the preview
      setTimeout(() => {
        onCameraGranted(mediaStream)
      }, 2000)

    } catch (err: any) {
      console.error('Camera access error:', err)
      setStatus('denied')
      
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access to continue.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera to continue.')
      } else if (err.name === 'NotReadableError') {
        setError('Camera is being used by another application.')
      } else {
        setError('Unable to access camera. Please check your permissions.')
      }
    }
  }

  const handleDecline = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    onCameraDeclined()
  }

  useEffect(() => {
    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-indigo-900/90 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="relative w-full max-w-lg"
        >
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden">
            {/* Header */}
            <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500" />
            
            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="w-16 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                {status === 'granted' ? (
                  <CheckCircle className="w-8 h-8 text-white" />
                ) : status === 'denied' ? (
                  <CameraOff className="w-8 h-8 text-white" />
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </motion.div>
              
              <CardTitle className="text-2xl font-bold">
                {status === 'granted' ? 'Camera Access Granted' : 'Camera Access Required'}
              </CardTitle>
              <p className="text-muted-foreground">
                For exam session: <strong>{sessionName}</strong>
              </p>
            </CardHeader>

            <CardContent className="p-6">
              <AnimatePresence mode="wait">
                {status === 'requesting' && (
                  <motion.div
                    key="requesting"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center space-y-6"
                  >
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-left">
                          <h4 className="font-medium text-blue-900">Why we need camera access:</h4>
                          <ul className="mt-2 text-sm text-blue-700 space-y-1">
                            <li>• Ensure exam integrity and prevent cheating</li>
                            <li>• Monitor student behavior during the exam</li>
                            <li>• Provide a secure testing environment</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <Eye className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="text-left">
                          <h4 className="font-medium text-yellow-900">Privacy Notice:</h4>
                          <p className="mt-1 text-sm text-yellow-700">
                            Your camera feed will only be visible to your teacher during the exam. 
                            It will not be recorded unless specified by your institution's policy.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <MagneticButton
                        onClick={requestCameraAccess}
                        className="flex-1 h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl"
                      >
                        <Camera className="w-5 h-5 mr-3" />
                        Allow Camera Access
                      </MagneticButton>

                      {!cameraRequired && (
                        <MagneticButton
                          onClick={handleDecline}
                          variant="outline"
                          className="flex-1 h-12 text-lg font-semibold bg-white/80 backdrop-blur-sm border-2 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300 rounded-xl"
                        >
                          Continue Without Camera
                        </MagneticButton>
                      )}
                    </div>

                    {cameraRequired && (
                      <div className="flex items-center justify-center space-x-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <Lock className="w-4 h-4" />
                        <span>Camera access is required for this exam session</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {status === 'granted' && (
                  <motion.div
                    key="granted"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center space-y-6"
                  >
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full max-w-sm mx-auto rounded-xl border-2 border-green-200 shadow-lg"
                      />
                      <div className="absolute top-2 right-2">
                        <div className="flex items-center space-x-1 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          <span>Live</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center justify-center space-x-2 text-green-800">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Camera is working properly!</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        You'll be redirected to the exam shortly...
                      </p>
                    </div>
                  </motion.div>
                )}

                {status === 'denied' && (
                  <motion.div
                    key="denied"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center space-y-6"
                  >
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div className="text-left">
                          <h4 className="font-medium text-red-900">Camera Access Denied</h4>
                          <p className="mt-1 text-sm text-red-700">{error}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                      <h4 className="font-medium text-blue-900 mb-2">To enable camera access:</h4>
                      <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>Click the camera icon in your browser's address bar</li>
                        <li>Select "Allow" for camera access</li>
                        <li>Refresh the page and try again</li>
                      </ol>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <MagneticButton
                        onClick={requestCameraAccess}
                        className="flex-1 h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl"
                      >
                        <Camera className="w-5 h-5 mr-3" />
                        Try Again
                      </MagneticButton>

                      {!cameraRequired && (
                        <MagneticButton
                          onClick={handleDecline}
                          variant="outline"
                          className="flex-1 h-12 text-lg font-semibold bg-white/80 backdrop-blur-sm border-2 border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300 rounded-xl"
                        >
                          Continue Without Camera
                        </MagneticButton>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}