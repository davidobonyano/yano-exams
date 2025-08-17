import { supabase } from "@/lib/supabase";

export const signalingChannelFor = (studentId: string) =>
  supabase.channel(`webrtc:${studentId}`);
