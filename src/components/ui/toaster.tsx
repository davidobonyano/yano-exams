'use client'

import { Toaster as HotToaster } from 'react-hot-toast'

export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '0.75rem',
          fontSize: '14px',
        },
        success: {
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(142.1 76.2% 36.3%)',
          },
          iconTheme: {
            primary: 'hsl(142.1 76.2% 36.3%)',
            secondary: 'hsl(var(--background))',
          },
        },
        error: {
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--destructive))',
          },
          iconTheme: {
            primary: 'hsl(var(--destructive))',
            secondary: 'hsl(var(--background))',
          },
        },
      }}
    />
  )
}