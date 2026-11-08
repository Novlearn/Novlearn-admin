-- One-time, narrowly scoped Production capability for reviewed feedbacks.
-- This script is intentionally not applied by the Admin application.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';

DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this script as the Production postgres owner';
  END IF;
  IF to_regclass('public.feedbacks') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_attribute
       WHERE attrelid='public.feedbacks'::regclass AND attname='status'
         AND NOT attisdropped AND atttypid='text'::regtype
     ) THEN
    RAISE EXCEPTION 'Expected public.feedbacks.status text; inspect Production schema';
  END IF;
  IF to_regprocedure('public.admin_review_feedback(uuid,text)') IS NOT NULL
     OR to_regprocedure('novlearn_admin_api.review_feedback(uuid,text)') IS NOT NULL
     OR to_regclass('novlearn_admin_api.feedback_review_audit') IS NOT NULL THEN
    RAISE EXCEPTION 'Feedback review capability already exists; inspect before retry';
  END IF;
END
$guard$;

CREATE TABLE novlearn_admin_api.feedback_review_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  previous_status text NOT NULL,
  new_status text NOT NULL CHECK (new_status IN ('approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON novlearn_admin_api.feedback_review_audit FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION novlearn_admin_api.review_feedback(p_feedback_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
SET statement_timeout='8s'
AS $function$
DECLARE
  actor uuid := auth.uid();
  next_status text;
  old_status text;
  updated_status text;
BEGIN
  IF actor IS NULL
     OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
     OR coalesce(public.get_my_role(), '') <> 'admin' THEN
    RAISE EXCEPTION 'Production Admin required' USING ERRCODE='42501';
  END IF;
  IF p_feedback_id IS NULL OR p_action IS NULL OR p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid feedback decision' USING ERRCODE='22023';
  END IF;
  next_status := CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END;

  UPDATE public.feedbacks
     SET status = next_status
   WHERE id = p_feedback_id
     AND (status = 'pending' OR status IS NULL)
   RETURNING coalesce(status, 'pending') INTO updated_status;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.feedbacks WHERE id = p_feedback_id) THEN
      RAISE EXCEPTION 'Feedback was already reviewed' USING ERRCODE='40001';
    END IF;
    RAISE EXCEPTION 'Feedback not found' USING ERRCODE='P0002';
  END IF;
  old_status := 'pending';
  INSERT INTO novlearn_admin_api.feedback_review_audit
    (feedback_id, actor_id, previous_status, new_status)
  VALUES (p_feedback_id, actor, old_status, next_status);
  RETURN jsonb_build_object('feedbackId', p_feedback_id, 'status', next_status);
END
$function$;
ALTER FUNCTION novlearn_admin_api.review_feedback(uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION novlearn_admin_api.review_feedback(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION novlearn_admin_api.review_feedback(uuid,text) TO authenticated;

CREATE FUNCTION public.admin_review_feedback(p_feedback_id uuid, p_action text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $function$
  SELECT novlearn_admin_api.review_feedback(p_feedback_id, p_action)
$function$;
REVOKE ALL ON FUNCTION public.admin_review_feedback(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_feedback(uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
