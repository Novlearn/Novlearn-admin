-- Synthetic fixtures and all mutations are rolled back. No account/login or
-- altered deadline is used to certify a nonexistent read-only capability.
BEGIN;
CREATE TEMP TABLE activity_checks(label text);
CREATE FUNCTION pg_temp.activity_assert(ok boolean,label text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Activity assertion failed: %',label; END IF;
  INSERT INTO pg_temp.activity_checks VALUES(label);
  RAISE NOTICE 'PASS: %',label;
END;
$$;
CREATE FUNCTION pg_temp.activity_denied(query text,label text) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN EXECUTE query; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  PERFORM pg_temp.activity_assert(denied,label);
END;
$$;
DO $$ BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO novlearn_activity_reader,anon,authenticated,service_role',(SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema()));
END; $$;

SELECT pg_temp.activity_assert((SELECT NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls FROM pg_roles WHERE rolname='novlearn_activity_reader'),'role is non-login, non-inheriting and unprivileged');
SELECT pg_temp.activity_assert(NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member='novlearn_activity_reader'::regrole),'reader has no inherited or assumable parent role');
SELECT pg_temp.activity_assert(NOT has_schema_privilege('novlearn_activity_reader','public','CREATE'),'reader cannot create public schema objects');
SELECT pg_temp.activity_assert(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','novlearn_admin_private') AND c.relkind IN ('r','p','v','m','S') AND (has_table_privilege('novlearn_activity_reader',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') OR has_any_column_privilege('novlearn_activity_reader',c.oid,'INSERT,UPDATE,REFERENCES'))),'no effective application/Auth/private mutation grant');
SELECT pg_temp.activity_assert(NOT has_function_privilege('novlearn_activity_reader','public.get_monthly_leaderboard(timestamptz,integer,text)','EXECUTE') AND NOT has_function_privilege('novlearn_activity_reader','public.get_weekly_leaderboard(timestamptz,integer,text)','EXECUTE') AND NOT has_function_privilege('novlearn_activity_reader','public.get_success_rate_leaderboard(timestamptz,integer,integer)','EXECUTE'),'no indirect nominal projection through PUBLIC leaderboards');
SELECT pg_temp.activity_assert((SELECT count(*)=1 AND bool_and(p.oid='public.is_guest()'::regprocedure) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND has_schema_privilege('novlearn_activity_reader',n.oid,'USAGE') AND has_function_privilege('novlearn_activity_reader',p.oid,'EXECUTE')),'only the existing guest predicate is reachable as a non-system definer');
SELECT pg_temp.activity_assert((SELECT bool_and(has_function_privilege(r,p,'EXECUTE')) FROM unnest(ARRAY['anon','authenticated','service_role']) r CROSS JOIN unnest(ARRAY['public.get_monthly_leaderboard(timestamptz,integer,text)','public.get_weekly_leaderboard(timestamptz,integer,text)','public.get_success_rate_leaderboard(timestamptz,integer,integer)']) p),'established API clients retain leaderboard grants');

INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at,is_anonymous) VALUES
('a8100000-0000-4000-8000-000000000001','authenticated','authenticated','activity-a@example.test','{"first_name":"LOCAL ACTIVITY A","birth_date":"2000-01-01"}','2026-10-14T12:00:00Z',now(),false),
('a8100000-0000-4000-8000-000000000002','authenticated','authenticated','activity-b@example.test','{"first_name":"LOCAL ACTIVITY B","birth_date":"2000-01-01"}','2026-10-15T12:00:00Z',now(),true),
('a8100000-0000-4000-8000-000000000003','authenticated','authenticated','activity-c@example.test','{"first_name":"LOCAL ACTIVITY C","birth_date":"2000-01-01"}',NULL,now(),false),
('a8100000-0000-4000-8000-000000000004','authenticated','authenticated','activity-d@example.test','{"first_name":"LOCAL ACTIVITY D","birth_date":"2000-01-01"}','2026-10-18T00:00:00Z',now(),false);
-- Auth deliberately skips the normal guest profile. A trusted synthetic profile
-- keeps the existing attempt-statistics FK valid while testing anonymous input;
-- no trigger or constraint is disabled and this row is rolled back with the rest.
INSERT INTO public.profiles(id,email,first_name,birth_date) VALUES
('a8100000-0000-4000-8000-000000000002','activity-b@example.test','LOCAL ACTIVITY B','2000-01-01');
INSERT INTO public.exercise_attempts(user_id,is_correct,is_abandoned,attempted_at) VALUES
('a8100000-0000-4000-8000-000000000001',true,false,'2026-10-15T00:00:00Z'),
('a8100000-0000-4000-8000-000000000001',false,false,'2026-10-16T12:00:00Z'),
('a8100000-0000-4000-8000-000000000001',true,true,'2026-10-17T23:59:59Z'),
('a8100000-0000-4000-8000-000000000002',true,false,'2026-10-15T22:30:00Z'),
('a8100000-0000-4000-8000-000000000002',false,false,'2026-10-17T10:00:00Z'),
('a8100000-0000-4000-8000-000000000001',true,false,'2026-10-18T00:00:00Z'),
('a8100000-0000-4000-8000-000000000001',false,false,NULL);
INSERT INTO public.duels(id,player1_id,player2_id,status,finished_at) VALUES
(981000001,'a8100000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000002','finished','2026-10-16T12:00:00Z'),
(981000002,'a8100000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000002','finished','2026-10-18T00:00:00Z'),
(981000003,'a8100000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000002','active','2026-10-16T12:00:00Z');
INSERT INTO public.duel_attempts(duel_id,player_id,element_id,is_correct,submitted_at) VALUES
(981000001,'a8100000-0000-4000-8000-000000000001',1,true,'2026-10-16T16:00:00Z'),
(981000001,'a8100000-0000-4000-8000-000000000002',1,false,'2026-10-17T16:00:00Z');

SET SESSION AUTHORIZATION novlearn_activity_reader;
SET LOCAL transaction_read_only=off;
SELECT pg_temp.activity_assert((SELECT count(id)=4 FROM auth.users),'reader sees actual Auth stock including an anonymous account and nullable creation date');
SELECT pg_temp.activity_assert((SELECT count(user_id)=7 FROM public.exercise_attempts),'reader sees attempt inputs through RLS without a forged JWT');
SELECT pg_temp.activity_assert((SELECT count(player_id)=2 FROM public.duel_attempts),'reader retains the exact legacy RLS subquery dependencies');
SELECT pg_temp.activity_assert((SELECT count(status)=3 FROM public.duels),'reader sees completed and non-completed duel inputs');
SELECT pg_temp.activity_denied('SELECT email FROM auth.users','Auth e-mails are outside aggregate capability');
SELECT pg_temp.activity_denied('SELECT encrypted_password FROM auth.users','Auth password material is outside aggregate capability');
SELECT pg_temp.activity_denied('SELECT email,first_name FROM public.profiles','nominal profiles are outside aggregate capability');
SELECT pg_temp.activity_denied('SELECT content FROM public.exercises','exercise content and expected answers are outside aggregate capability');
SELECT pg_temp.activity_denied('SELECT answer FROM public.duel_attempts','individual duel answers are outside aggregate capability');
SELECT pg_temp.activity_denied('SELECT payload FROM public.admin_exercise_test_runs','private Engine reports are outside aggregate capability');
SELECT pg_temp.activity_denied('UPDATE public.exercise_attempts SET is_correct=false','actual UPDATE refused even with a read-write transaction');
SELECT pg_temp.activity_denied('DELETE FROM public.duels','actual DELETE refused even with a read-write transaction');
SELECT pg_temp.activity_denied('INSERT INTO public.exercise_attempts(user_id,is_correct) VALUES(''a8100000-0000-4000-8000-000000000001'',true)','actual INSERT refused');
SELECT pg_temp.activity_denied('TRUNCATE public.exercise_attempts','actual TRUNCATE refused');
SELECT pg_temp.activity_denied('SELECT pg_catalog.lo_create(0)','reader cannot create persistent large objects');
SELECT pg_temp.activity_denied('CREATE TEMP TABLE activity_unexpected_write(value integer)','reader cannot create temporary tables');
SELECT pg_temp.activity_denied('SELECT public.get_weekly_leaderboard(now(),10,NULL)','actual indirect leaderboard call refused');
SELECT pg_temp.activity_denied('SET ROLE authenticated','reader cannot become an API client role');
SELECT pg_temp.activity_denied('SET ROLE novlearn_publication_executor','reader cannot assume the publication capability');
RESET SESSION AUTHORIZATION;

-- An untrusted claim never activates the exception based on current_user.
SELECT set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"a8100000-0000-4000-8000-000000000003","role":"novlearn_activity_reader","is_anonymous":false}',true);
SET SESSION AUTHORIZATION authenticated;
SELECT pg_temp.activity_assert((SELECT count(id)=0 FROM public.exercise_attempts),'forged analytics claim does not reveal another user’s attempts');
SELECT pg_temp.activity_denied('SET ROLE novlearn_activity_reader','API client cannot assume the physical analytics role');
RESET SESSION AUTHORIZATION;
SELECT set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"a8100000-0000-4000-8000-000000000002","is_anonymous":true}',true);
SET SESSION AUTHORIZATION authenticated;
SELECT pg_temp.activity_assert((SELECT count(id)=0 FROM public.exercise_attempts),'guest SELECT restriction remains effective');
SELECT pg_temp.activity_denied('INSERT INTO public.exercise_attempts(user_id,is_correct) VALUES(''a8100000-0000-4000-8000-000000000002'',true)','guest INSERT restriction remains effective');
RESET SESSION AUTHORIZATION;
SELECT set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"a8100000-0000-4000-8000-000000000001","is_anonymous":false}',true);
SET SESSION AUTHORIZATION authenticated;
SELECT pg_temp.activity_assert((SELECT count(id)=5 FROM public.exercise_attempts),'permanent client still sees only its own attempts');
RESET SESSION AUTHORIZATION;

-- Caller appends the fixed aggregate-query PREPARE/EXECUTE and comparisons here.
SELECT jsonb_build_object('permissionAssertions',(SELECT count(*) FROM pg_temp.activity_checks));
ROLLBACK;
