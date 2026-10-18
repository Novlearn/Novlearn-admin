-- Invoker permission checks inside the driver's explicit synthetic transaction.
-- The role must fail real writes even while transaction_read_only is off.
CREATE FUNCTION pg_temp.detail_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Detail assertion failed: %',label; END IF;
RAISE NOTICE 'PASS: %',label; END; $$;
CREATE FUNCTION pg_temp.detail_denied(query text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN BEGIN EXECUTE query; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
PERFORM pg_temp.detail_assert(rejected,label); END; $$;
DO $$ BEGIN EXECUTE format('GRANT USAGE ON SCHEMA %I TO novlearn_user_detail_reader,novlearn_users_reader,novlearn_activity_reader,authenticated',
 (SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema())); END; $$;
SELECT pg_temp.detail_assert((SELECT NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls FROM pg_roles WHERE rolname='novlearn_user_detail_reader'),'NOLOGIN NOINHERIT and no elevated attributes');
SELECT pg_temp.detail_assert(NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member='novlearn_user_detail_reader'::regrole),'no parent membership');
SELECT pg_temp.detail_assert(NOT pg_has_role('authenticated','novlearn_user_detail_reader','SET') AND NOT pg_has_role('novlearn_users_reader','novlearn_user_detail_reader','SET') AND NOT pg_has_role('novlearn_activity_reader','novlearn_user_detail_reader','SET'),'API and existing readers cannot assume detail capability');
SELECT pg_temp.detail_assert((SELECT count(*)=41 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname IN ('auth','public','novlearn_admin_private') AND c.relkind IN ('r','p','v','m','f') AND has_schema_privilege('novlearn_user_detail_reader',n.oid,'USAGE') AND has_column_privilege('novlearn_user_detail_reader',c.oid,a.attnum,'SELECT')),'only forty-one detail input columns');
SELECT pg_temp.detail_assert(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','novlearn_admin_private') AND c.relkind IN ('r','p','v','m','S') AND (has_table_privilege('novlearn_user_detail_reader',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') OR has_any_column_privilege('novlearn_user_detail_reader',c.oid,'INSERT,UPDATE,REFERENCES'))),'no effective table or column mutation grants');
SELECT pg_temp.detail_assert((SELECT count(*)=1 AND bool_and(p.oid='public.is_guest()'::regprocedure) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth','novlearn_admin_private') AND p.prosecdef AND has_function_privilege('novlearn_user_detail_reader',p.oid,'EXECUTE')),'only the reviewed guest helper is callable as definer');
SET SESSION AUTHORIZATION novlearn_user_detail_reader;
SET LOCAL transaction_read_only=off;
SELECT pg_temp.detail_assert((SELECT count(id)=4 FROM auth.users),'actual Auth identity stock visible without JWT');
SELECT pg_temp.detail_assert((SELECT count(id)=4 FROM public.profiles),'profile names visible through physical SELECT exception');
SELECT pg_temp.detail_assert((SELECT count(id)=4 FROM public.user_progress),'recorded progression readable including incomplete synthetic data');
SELECT pg_temp.detail_assert((SELECT count(user_id)=4 FROM public.user_competence_scores),'recorded competence inputs readable without inventing a user claim');
SELECT pg_temp.detail_assert((SELECT count(id)>=1 FROM public.exercises),'exercise metadata reachable through independent policy');
SELECT pg_temp.detail_denied('SELECT encrypted_password FROM auth.users','Auth password refused');
SELECT pg_temp.detail_denied('SELECT rolpassword FROM pg_catalog.pg_authid','catalog role passwords refused');
SELECT pg_temp.detail_denied('SELECT raw_user_meta_data FROM auth.users','Auth metadata refused');
SELECT pg_temp.detail_denied('SELECT birth_date FROM public.profiles','birth date refused');
SELECT pg_temp.detail_denied('SELECT role FROM public.profiles','profile role refused');
SELECT pg_temp.detail_denied('SELECT content FROM public.exercises','exercise definition refused');
SELECT pg_temp.detail_denied('SELECT * FROM public.exercise_versions','private version definition refused');
SELECT pg_temp.detail_denied('SELECT answer FROM public.duel_attempts','individual answer refused');
SELECT pg_temp.detail_denied('SELECT exercise_data FROM public.duels','duel payload refused');
SELECT pg_temp.detail_denied('SELECT * FROM public.exercise_attempt_instances','private exercise instance refused');
SELECT pg_temp.detail_denied('SELECT * FROM public.duel_exercise_instances','private duel instance refused');
SELECT pg_temp.detail_denied('SELECT payload FROM public.admin_exercise_test_runs','private report refused');
SELECT pg_temp.detail_denied('SELECT * FROM novlearn_admin_private.test_signing_keys','signing keys refused');
SELECT pg_temp.detail_denied('UPDATE public.profiles SET first_name=''unexpected''','profile UPDATE refused in read-write transaction');
SELECT pg_temp.detail_denied('UPDATE public.user_progress SET level=100','progress UPDATE refused');
SELECT pg_temp.detail_denied('UPDATE public.user_competence_scores SET points=100','competence UPDATE refused');
SELECT pg_temp.detail_denied('DELETE FROM auth.users','Auth DELETE refused');
SELECT pg_temp.detail_denied('INSERT INTO public.user_progress(id,user_id,chapter) VALUES(981400003,''a8100000-0000-4000-8000-000000000001'',''not allowed'')','progress INSERT refused');
SELECT pg_temp.detail_denied('TRUNCATE public.user_progress','TRUNCATE refused');
SELECT pg_temp.detail_denied('CREATE TEMP TABLE forbidden_detail(value integer)','TEMP creation refused');
SELECT pg_temp.detail_denied('SELECT pg_catalog.lo_create(0)','persistent large object creation refused');
SELECT pg_temp.detail_denied('SET ROLE novlearn_users_reader','cannot assume nominal list reader');
SELECT pg_temp.detail_denied('SET ROLE novlearn_activity_reader','cannot assume aggregate reader');
SELECT pg_temp.detail_denied('SET ROLE novlearn_publication_executor','cannot assume publication executor');
SELECT pg_temp.detail_denied('SELECT public.get_weekly_leaderboard(now(),10,NULL)','indirect leaderboard refused');
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION novlearn_users_reader;
SELECT pg_temp.detail_denied('SELECT level FROM public.user_progress','list reader remains unable to read progress');
SELECT pg_temp.detail_denied('SELECT is_correct FROM public.exercise_attempts','list reader remains unable to read historical verdicts');
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION novlearn_activity_reader;
SELECT pg_temp.detail_denied('SELECT email FROM auth.users','aggregate reader remains unable to read Auth e-mail');
SELECT pg_temp.detail_denied('SELECT points FROM public.user_competence_scores','aggregate reader remains unable to read individual progress');
RESET SESSION AUTHORIZATION;
SELECT set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"a8100000-0000-4000-8000-000000000001","role":"novlearn_user_detail_reader","is_anonymous":false}',true);
SET SESSION AUTHORIZATION authenticated;
SELECT pg_temp.detail_assert((SELECT count(id)=3 FROM public.user_progress),'forged role claim sees only own permanent-user progress');
SELECT pg_temp.detail_assert((SELECT count(user_id)=3 FROM public.user_competence_scores),'forged role claim sees only own competence rows');
SELECT pg_temp.detail_denied('SELECT email FROM auth.users','forged detail claim cannot read Auth identity stock');
-- Explicit IDs keep permission tests independent of non-transactional nextval.
-- A real permitted insert proves the guest denial is not merely a missing grant.
SAVEPOINT detail_permanent_insert;
INSERT INTO public.user_progress(id,user_id,chapter,level,exercises_completed)
VALUES(981400001,'a8100000-0000-4000-8000-000000000001','LOCAL DETAIL permanent insert test',0,0);
SELECT pg_temp.detail_assert((SELECT count(id)=1 FROM public.user_progress WHERE id=981400001),'permanent client INSERT remains genuinely allowed');
ROLLBACK TO SAVEPOINT detail_permanent_insert;
RELEASE SAVEPOINT detail_permanent_insert;
RESET SESSION AUTHORIZATION;
SELECT set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"a8100000-0000-4000-8000-000000000002","is_anonymous":true}',true);
SET SESSION AUTHORIZATION authenticated;
SELECT pg_temp.detail_assert((SELECT count(id)=0 FROM public.user_progress),'guest progression SELECT stays refused');
SELECT pg_temp.detail_assert((SELECT count(user_id)=0 FROM public.user_competence_scores),'guest competence SELECT stays refused');
SELECT pg_temp.detail_denied('INSERT INTO public.user_progress(id,user_id,chapter) VALUES(981400002,''a8100000-0000-4000-8000-000000000002'',''guest forbidden'')','guest progression INSERT stays refused');
DO $$ DECLARE affected bigint; BEGIN
  UPDATE public.user_progress SET level=100; GET DIAGNOSTICS affected=ROW_COUNT;
  PERFORM pg_temp.detail_assert(affected=0,'guest progression UPDATE affects no rows');
END; $$;
RESET SESSION AUTHORIZATION;
