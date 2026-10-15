\set ON_ERROR_STOP on
BEGIN;
-- Ordinary ACL checks and legitimate workflows only; no trigger-planting probe.
DO $$
DECLARE r text; f regprocedure; settings text[];
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','novlearn_publication_executor','novlearn_publication_writer'] LOOP
    FOREACH f IN ARRAY ARRAY['public.create_friend_code_for_new_user()'::regprocedure,'public.handle_friend_request_acceptance()'::regprocedure] LOOP
      IF has_function_privilege(r,f,'EXECUTE') THEN RAISE EXCEPTION 'Unexpected EXECUTE: % %',r,f; END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'PASS: ten effective role/function ACL combinations deny EXECUTE';
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prorettype='trigger'::regtype
    AND (has_function_privilege('novlearn_publication_executor',p.oid,'EXECUTE') OR has_function_privilege('novlearn_publication_writer',p.oid,'EXECUTE')))
  THEN RAISE EXCEPTION 'Publication role can execute a public privileged trigger function'; END IF;
  RAISE NOTICE 'PASS: neither publication role can execute any public SECURITY DEFINER trigger';
  FOREACH f IN ARRAY ARRAY['public.create_friend_code_for_new_user()'::regprocedure,'public.handle_friend_request_acceptance()'::regprocedure] LOOP
    SELECT proconfig INTO settings FROM pg_proc WHERE oid=f;
    IF settings IS NULL OR NOT 'search_path=""'=ANY(settings) THEN RAISE EXCEPTION 'Missing fixed search_path: % %',f,settings; END IF;
  END LOOP;
  RAISE NOTICE 'PASS: both privileged functions fix search_path';
END;
$$;

SET SESSION AUTHORIZATION supabase_auth_admin;
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT id,'authenticated','authenticated',id::text||'@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"LOCAL TRIGGER FIXTURE","birth_date":"2000-01-01"}',now(),now()
FROM unnest(ARRAY['a5600000-0000-4000-8000-000000000001'::uuid,'a5600000-0000-4000-8000-000000000002'::uuid]) id;
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.friend_codes WHERE user_id IN ('a5600000-0000-4000-8000-000000000001','a5600000-0000-4000-8000-000000000002'))<>2
  THEN RAISE EXCEPTION 'Auth friend code creation failed'; END IF;
  IF (SELECT count(*) FROM public.profiles WHERE id IN ('a5600000-0000-4000-8000-000000000001','a5600000-0000-4000-8000-000000000002'))<>2
  THEN RAISE EXCEPTION 'Auth profile creation failed'; END IF;
  RAISE NOTICE 'PASS: Auth role creates both users, profiles and friend codes';
END; $$;

SELECT set_config('request.jwt.claim.sub','a5600000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"a5600000-0000-4000-8000-000000000001","is_anonymous":false}',true);
SET SESSION AUTHORIZATION authenticated;
INSERT INTO public.friend_requests(from_user_id,to_user_id) VALUES('a5600000-0000-4000-8000-000000000001','a5600000-0000-4000-8000-000000000002');
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.friends WHERE user1_id='a5600000-0000-4000-8000-000000000001' AND user2_id='a5600000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Pending request created a friendship'; END IF;
  RAISE NOTICE 'PASS: pending request creates no friendship';
END; $$;
SELECT set_config('request.jwt.claim.sub','a5600000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"a5600000-0000-4000-8000-000000000002","is_anonymous":false}',true);
SET SESSION AUTHORIZATION authenticated;
UPDATE public.friend_requests SET status='accepted' WHERE from_user_id='a5600000-0000-4000-8000-000000000001' AND to_user_id='a5600000-0000-4000-8000-000000000002';
RESET SESSION AUTHORIZATION;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.friends WHERE user1_id='a5600000-0000-4000-8000-000000000001' AND user2_id='a5600000-0000-4000-8000-000000000002' AND status='accepted')<>1 THEN RAISE EXCEPTION 'Recipient acceptance did not create friendship'; END IF;
  RAISE NOTICE 'PASS: authenticated recipient acceptance creates exactly one friendship';
END; $$;
ROLLBACK;
