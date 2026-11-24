-- Roll-forward hardening for the feedback decision capability already installed in Production.
-- Review the diff and run only through the approved Production database procedure.
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
  IF to_regprocedure('public.admin_review_feedback(uuid,text)') IS NULL
     OR to_regprocedure('novlearn_admin_api.review_feedback(uuid,text)') IS NULL
     OR to_regclass('novlearn_admin_api.feedback_review_audit') IS NULL THEN
    RAISE EXCEPTION 'Expected installed feedback review capability and audit table';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION novlearn_admin_api.review_feedback(p_feedback_id uuid, p_action text)
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

  SELECT status INTO old_status
    FROM public.feedbacks
   WHERE id = p_feedback_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feedback not found' USING ERRCODE='P0002';
  END IF;

  -- A repeated request for the same decision is a successful, audited-once no-op.
  IF old_status = next_status THEN
    RETURN jsonb_build_object('feedbackId', p_feedback_id, 'status', next_status);
  END IF;
  IF old_status IS NOT NULL AND old_status <> 'pending' THEN
    -- PT409 is a PostgREST client error, not PostgreSQL's retryable 40001.
    RAISE EXCEPTION 'Feedback was already reviewed' USING ERRCODE='PT409';
  END IF;

  UPDATE public.feedbacks
     SET status = next_status
   WHERE id = p_feedback_id;
  INSERT INTO novlearn_admin_api.feedback_review_audit
    (feedback_id, actor_id, previous_status, new_status)
  VALUES (p_feedback_id, actor, coalesce(old_status, 'pending'), next_status);
  RETURN jsonb_build_object('feedbackId', p_feedback_id, 'status', next_status);
END
$function$;

NOTIFY pgrst, 'reload schema';
