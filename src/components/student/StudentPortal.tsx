"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/SimpleSessionContext";
import { supabase } from "@/lib/supabase";
import SimpleStudentLogin from "@/components/auth/SimpleStudentLogin";
import DemoExam from "@/components/exam/DemoExam";
import SessionExamInterface from "@/components/exam/SessionExamInterface";

interface SessionData {
  student_name: string;
  student_class_level?: string;
  session_id: string;
  session_code?: string;
  exam_id: string;
  exam_title: string;
  duration_minutes: number;
  instructions?: string;
  participant_id: string;
  student_id: string;
  teacher_id?: string;
  camera_monitoring_enabled?: boolean;
  can_resume?: boolean;
  attempt_id?: string;
  time_remaining?: number;
}

type PortalStage = "login" | "demo" | "exam" | "completed";

function StudentPortalContent() {
  const router = useRouter();
  const [stage, setStage] = useState<PortalStage>("login");
  const [redirecting, setRedirecting] = useState(false);
  const { session, loading, setSessionData, clearSession } = useSession();

  // Determine stage based on restored session data
  useEffect(() => {
    if (!loading) {
      if (session) {
        // Check if there's an active exam attempt
        checkExamStatus();
      } else {
        setStage("login");
      }
    }
  }, [session, loading]);

  const checkExamStatus = async () => {
    if (!session?.participant_id) {
      setStage("exam");
      return;
    }

    try {
      // Check if there's an active exam attempt
      const { data: attempts, error } = await supabase
        .from("student_exam_attempts")
        .select("*")
        .eq("student_id", session.student.id)
        .eq("session_id", session.session.id)
        .in("status", ["in_progress", "completed", "submitted"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error checking exam status:", error);
        setStage("exam");
        return;
      }

      if (attempts && attempts.length > 0) {
        const latestAttempt = attempts[0];

        if (
          latestAttempt.status === "completed" ||
          latestAttempt.status === "submitted"
        ) {
          // Exam is completed, show completed stage
          setStage("completed");
          return;
        } else if (latestAttempt.status === "in_progress") {
          // Exam is in progress, continue to exam
          setStage("exam");
          return;
        }
      }

      // No active attempt, show exam
      setStage("exam");
    } catch (error) {
      console.error("Error checking exam status:", error);
      setStage("exam");
    }
  };

  const handleLoginSuccess = (data: SessionData) => {
    setSessionData(data);

    // If student can resume an existing attempt, go straight to exam
    if (data.can_resume && data.attempt_id) {
      setStage("exam");
    } else {
      // Go directly to exam after login
      setStage("exam");
    }
  };



  const handleExamComplete = () => {
    clearSession();
    setStage("login");
  };

  const handleStartDemo = () => {
    setStage("demo");
  };

  const handleDemoExit = () => {
    setStage("login");
  };

  const handleLogout = () => {
    clearSession();
    setStage("login");
  };

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-lg font-medium text-gray-600">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  switch (stage) {
    case "login":
      return (
        <SimpleStudentLogin
          onLoginSuccess={handleLoginSuccess}
          onStartDemo={handleStartDemo}
        />
      );

    case "demo":
      return <DemoExam onExit={handleDemoExit} />;

    case "exam":
      return <SessionExamInterface />;

    case "completed":
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Exam Completed!
            </h1>
            <p className="text-gray-600 mb-8">
              You have successfully completed your exam. Thank you for your participation.
            </p>

            <button
              onClick={() => {
                clearSession();
                setStage("login");
              }}
              className="w-full flex items-center justify-center px-6 py-3 text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Exit Session
            </button>
          </div>
        </div>
      );

    default:
      return null;
  }
}

export default function StudentPortal() {
  return <StudentPortalContent />;
}
