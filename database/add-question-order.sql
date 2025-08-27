-- Add question_order column to exam_sessions to fix question order once per session
ALTER TABLE public.exam_sessions
ADD COLUMN IF NOT EXISTS question_order UUID[];

-- Helper function to set question_order once (idempotent)
CREATE OR REPLACE FUNCTION set_question_order_once(
  p_session_id UUID,
  p_order UUID[]
)
RETURNS UUID[] AS $$
DECLARE
  v_existing UUID[];
BEGIN
  SELECT question_order INTO v_existing FROM public.exam_sessions WHERE id = p_session_id;
  IF v_existing IS NULL OR array_length(v_existing, 1) IS NULL THEN
    UPDATE public.exam_sessions
      SET question_order = p_order
      WHERE id = p_session_id;
    RETURN p_order;
  END IF;
  RETURN v_existing;
END;
$$ LANGUAGE plpgsql;



