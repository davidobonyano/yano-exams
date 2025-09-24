import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SimpleSessionProvider } from '@/context/SimpleSessionContext'
import { Toaster } from '@/components/ui/toaster'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YANO Exam Platform",
  description: "Nigerian exam platform for JSS and SS students",
  icons: {
    icon: "/yano-logo.png",
    shortcut: "/yano-logo.png",
    apple: "/yano-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/yano-logo.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SimpleSessionProvider>
          {children}
        </SimpleSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
