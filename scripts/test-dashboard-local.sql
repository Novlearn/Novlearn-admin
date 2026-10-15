\set ON_ERROR_STOP on
-- Synthetic aggregate fixtures, not a new Engine/signature or editorial certification.
BEGIN;
CREATE TEMP TABLE dashboard_checks(label text);
GRANT INSERT ON dashboard_checks TO authenticated,anon;
CREATE FUNCTION pg_temp.dashboard_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label;END IF;INSERT INTO pg_temp.dashboard_checks VALUES(label);END;$$;
CREATE FUNCTION pg_temp.dashboard_denied(statement text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement;EXCEPTION WHEN insufficient_privilege THEN PERFORM pg_temp.dashboard_assert(true,label);RETURN;END;RAISE EXCEPTION 'Unexpected acceptance: %',label;END;$$;
DO $test$
DECLARE actor uuid:='a5900000-0000-4000-8000-000000000001';student uuid:='a5900000-0000-4000-8000-000000000002';key uuid:='a5910000-0000-4000-8000-000000000001';
base jsonb; overview jsonb; created jsonb; published jsonb; more jsonb; status_name text; v uuid; e bigint; fp text; stamp timestamptz; j integer;
source jsonb:='{"schemaVersion":5,"kind":"composed","id":"fixture","revision":"1","title":"LOCAL DASHBOARD FIXTURE","generation":{"schemaVersion":5,"definitions":[],"constraints":[],"maxAttempts":100,"maxDraws":1000},"variables":[],"elements":[]}';
BEGIN
 INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 SELECT id,'authenticated','authenticated',id::text||'@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"LOCAL DASHBOARD FIXTURE","birth_date":"2000-01-01"}',now(),now() FROM unnest(ARRAY[actor,student]) id;
 UPDATE public.profiles SET role='admin' WHERE id=actor;
 PERFORM pg_temp.dashboard_assert((SELECT NOT prosecdef AND provolatile='s' AND proconfig=ARRAY['search_path=""'] FROM pg_proc WHERE oid='public.admin_content_overview()'::regprocedure),'RPC is stable invoker with empty search path');
 PERFORM pg_temp.dashboard_assert(NOT has_function_privilege('anon','public.admin_content_overview()','EXECUTE') AND NOT has_function_privilege('service_role','public.admin_content_overview()','EXECUTE'),'no anon or service role grant');
 PERFORM set_config('request.jwt.claim.sub',student::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',student,'is_anonymous',false,'role','admin')::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
 PERFORM pg_temp.dashboard_denied('SELECT public.admin_content_overview()','missing identity refused');
 PERFORM set_config('request.jwt.claim.sub',student::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',student,'is_anonymous',false,'role','admin')::text,true);
 PERFORM pg_temp.dashboard_denied('SELECT public.admin_content_overview()','student with forged claim refused');
 SET LOCAL ROLE anon;
 PERFORM pg_temp.dashboard_denied('SELECT public.admin_content_overview()','anonymous API role refused');
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'is_anonymous',true)::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.dashboard_denied('SELECT public.admin_content_overview()','guest with admin profile refused');
 RESET ROLE;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'is_anonymous',false)::text,true);
 SET LOCAL ROLE authenticated;
 base:=public.admin_content_overview();
 PERFORM pg_temp.dashboard_assert(base->>'environment'='staging' AND (base->>'asOf')::timestamptz IS NOT NULL,'snapshot identifies source and time');
 PERFORM pg_temp.dashboard_assert(jsonb_typeof(base->'catalogue'->'total')='string' AND jsonb_typeof(base->'content'->'flashcards')='string','counts projected as lossless decimal strings');
 created:=public.admin_save_exercise_draft(NULL,NULL,NULL,source);v:=(created->>'versionId')::uuid;e:=(created->>'exerciseId')::bigint;fp:=created->>'fingerprint';
 overview:=public.admin_content_overview();
 PERFORM pg_temp.dashboard_assert((overview->'catalogue'->>'total')::bigint=(base->'catalogue'->>'total')::bigint+1 AND (overview->'catalogue'->>'draft')::bigint=(base->'catalogue'->>'draft')::bigint+1,'new draft increments exercise counts');
 more:=public.admin_save_exercise_draft(e,NULL,NULL,source);
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'catalogue'->>'total')::bigint=(overview->'catalogue'->>'total')::bigint,'multiple revisions do not double count parent');
 RESET ROLE;
 UPDATE public.exercise_versions SET editorial_status='in_review' WHERE id=(more->>'versionId')::uuid;
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'catalogue'->>'in_review')::bigint=(base->'catalogue'->>'in_review')::bigint+1,'latest in-review status counted instead of older draft');
 published:=public.admin_save_exercise_draft(NULL,NULL,NULL,source);
 RESET ROLE;
 UPDATE public.exercise_versions SET editorial_status='approved',approved_by=actor,approved_at=now() WHERE id=(published->>'versionId')::uuid;
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'catalogue'->>'approved')::bigint=(base->'catalogue'->>'approved')::bigint+1,'approved status counted');
 RESET ROLE;
 UPDATE public.exercise_versions SET editorial_status='published' WHERE id=(published->>'versionId')::uuid;
 UPDATE public.exercises SET active_version_id=(published->>'versionId')::uuid WHERE id=(published->>'exerciseId')::bigint;
 SET LOCAL ROLE authenticated;
 overview:=public.admin_content_overview();
 PERFORM pg_temp.dashboard_assert((overview->'catalogue'->>'published')::bigint=(base->'catalogue'->>'published')::bigint+1 AND (overview->>'activeVersions')::bigint=(base->>'activeVersions')::bigint+1,'published latest and active pointer counted separately');
 PERFORM public.admin_save_exercise_draft((published->>'exerciseId')::bigint,NULL,NULL,source);
 overview:=public.admin_content_overview();
 PERFORM pg_temp.dashboard_assert((overview->'catalogue'->>'published')::bigint=(base->'catalogue'->>'published')::bigint AND (overview->>'activeVersions')::bigint=(base->>'activeVersions')::bigint+1,'new draft does not erase previous published active pointer');
 PERFORM public.admin_archive_exercise((published->>'exerciseId')::bigint,false,true);
 overview:=public.admin_content_overview();
 PERFORM pg_temp.dashboard_assert((overview->'catalogue'->>'archived')::bigint=(base->'catalogue'->>'archived')::bigint+1 AND (overview->>'activeVersions')::bigint=(base->>'activeVersions')::bigint,'archive overrides latest status and excludes active card');
 RESET ROLE;
 INSERT INTO public.exercises(title,chapter,difficulty,content) VALUES('LOCAL DASHBOARD LEGACY','TEST','easy','{}');
 INSERT INTO novlearn_admin_private.test_signing_keys(id,secret) VALUES(key,decode(repeat('45',32),'hex'));
 -- Fixed owner-seeded reports isolate aggregate selection from the already-tested receipt signer.
 INSERT INTO public.admin_exercise_test_runs(id,version_id,actor_id,fingerprint,test_epoch,key_id,issued_at,recorded_at,passed,payload,signature)
 VALUES(gen_random_uuid(),v,actor,fp,0,key,now(),clock_timestamp(),false,'SYNTHETIC AGGREGATE FIXTURE',repeat('0',64));
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'tests'->>'failed')::bigint=(base->'tests'->>'failed')::bigint,'older revision failure ignored');
 RESET ROLE;
 v:=(more->>'versionId')::uuid;SELECT approval_fingerprint_sha256 INTO fp FROM public.exercise_versions WHERE id=v;
 stamp:=clock_timestamp();
 INSERT INTO public.admin_exercise_test_runs(id,version_id,actor_id,fingerprint,test_epoch,key_id,issued_at,recorded_at,passed,payload,signature)
 VALUES('a5920000-0000-4000-8000-000000000001',v,actor,fp,0,key,now(),stamp,false,'SYNTHETIC AGGREGATE FIXTURE',repeat('0',64));
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'tests'->>'failed')::bigint=(base->'tests'->>'failed')::bigint+1,'current latest revision failure counted');
 RESET ROLE;
 INSERT INTO public.admin_exercise_test_runs(id,version_id,actor_id,fingerprint,test_epoch,key_id,issued_at,recorded_at,passed,payload,signature)
 VALUES('a5920000-0000-4000-8000-000000000002',v,actor,fp,0,key,now(),stamp,true,'SYNTHETIC AGGREGATE FIXTURE',repeat('0',64));
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'tests'->>'failed')::bigint=(base->'tests'->>'failed')::bigint,'latest successful receipt supersedes failure with stable UUID tie break');
 RESET ROLE;
 INSERT INTO public.admin_exercise_test_runs(id,version_id,actor_id,fingerprint,test_epoch,key_id,issued_at,recorded_at,passed,payload,signature)
 VALUES(gen_random_uuid(),v,actor,fp,0,key,now(),stamp+interval '1 second',false,'SYNTHETIC AGGREGATE FIXTURE',repeat('0',64));
 SET LOCAL ROLE authenticated;
 PERFORM public.admin_review_exercise_version(v,fp,0,'in_review','return_to_draft',NULL,'{}','Synthetic aggregate fixture: reopen for editing');
 more:=public.admin_save_exercise_draft(e,v,fp,source||'{"title":"LOCAL DASHBOARD CHANGED"}');
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'tests'->>'failed')::bigint=(base->'tests'->>'failed')::bigint,'editing invalidates old failed receipt');
 PERFORM public.admin_save_exercise_draft(e,v,more->>'fingerprint',source);
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'tests'->>'failed')::bigint=(base->'tests'->>'failed')::bigint,'edit then revert does not revive stale epoch');
 RESET ROLE;
 INSERT INTO public.admin_exercise_test_runs(id,version_id,actor_id,fingerprint,test_epoch,key_id,issued_at,recorded_at,passed,payload,signature)
 SELECT gen_random_uuid(),v,actor,approval_fingerprint_sha256,test_epoch,key,now(),clock_timestamp(),false,'SYNTHETIC AGGREGATE FIXTURE',repeat('0',64) FROM public.exercise_versions WHERE id=v;
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'tests'->>'failed')::bigint=(base->'tests'->>'failed')::bigint+1,'new receipt for current epoch counted before archive');
 PERFORM public.admin_archive_exercise(e,false,true);
 PERFORM pg_temp.dashboard_assert((public.admin_content_overview()->'tests'->>'failed')::bigint=(base->'tests'->>'failed')::bigint,'archived exercise failure excluded');
 overview:=public.admin_content_overview();
 FOREACH status_name IN ARRAY ARRAY['draft','in_review','approved','published','legacy','archived'] LOOP
 PERFORM pg_temp.dashboard_assert((overview->'catalogue'->>status_name)::bigint=(public.admin_list_exercises('',status_name)->>'total')::bigint,'dashboard agrees with catalogue filter '||status_name);
 END LOOP;
 PERFORM pg_temp.dashboard_assert((overview->'catalogue'->>'total')::bigint=(public.admin_list_exercises()->>'total')::bigint,'total agrees with catalogue including legacy and archives');
 PERFORM pg_temp.dashboard_assert((overview->'content'->>'chapters')::bigint=(SELECT count(*) FROM public.chapters) AND (overview->'content'->>'competences')::bigint=(SELECT count(*) FROM public.competences) AND (overview->'content'->>'flashcards')::bigint=(SELECT count(*) FROM public.flashcards),'content counts match actual tables');
 RESET ROLE;
 FOR j IN 1..7 LOOP
 more:=public.admin_save_exercise_draft(NULL,NULL,NULL,source||jsonb_build_object('title','LOCAL DASHBOARD PUBLISHED '||j));
 UPDATE public.exercise_versions SET editorial_status='approved',approved_by=actor,approved_at=now() WHERE id=(more->>'versionId')::uuid;
 UPDATE public.exercise_versions SET editorial_status='published' WHERE id=(more->>'versionId')::uuid;
 UPDATE public.exercises SET active_version_id=(more->>'versionId')::uuid WHERE id=(more->>'exerciseId')::bigint;
 END LOOP;
 SET LOCAL ROLE authenticated;
 overview:=public.admin_content_overview();
 PERFORM pg_temp.dashboard_assert(jsonb_array_length(overview->'recentActiveVersions')=5,'recent list limited to five actual active versions');
 PERFORM pg_temp.dashboard_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(overview->'recentActiveVersions') item WHERE jsonb_typeof(item->'exerciseId')<>'string' OR item ?| ARRAY['definition','expected','actor_id','payload']),'recent metadata excludes private definitions reports and actors');
 PERFORM pg_temp.dashboard_assert((overview->'recentActiveVersions'->0->>'versionId')=(SELECT id::text FROM public.exercise_versions WHERE editorial_status='published' AND id IN (SELECT active_version_id FROM public.exercises WHERE admin_archived_at IS NULL) ORDER BY published_at DESC,id DESC LIMIT 1),'recent ordering uses published date then stable UUID');
 PERFORM pg_temp.dashboard_assert(public.admin_content_overview()=overview,'repeated stable read changes neither data nor snapshot time');
 RESET ROLE;
 UPDATE public.profiles SET role='user' WHERE id=actor;
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.dashboard_denied('SELECT public.admin_content_overview()','fresh role revocation removes aggregate access');
 RESET ROLE;
END;$test$;
SELECT jsonb_build_object('result','PASS','dashboardAssertions',count(*)) FROM pg_temp.dashboard_checks;
ROLLBACK;
