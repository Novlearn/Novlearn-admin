\set ON_ERROR_STOP on
BEGIN;
-- Synthetic signed reports test SQL authorization only. Native math is tested separately.
CREATE TEMP TABLE review_checks(label text);
GRANT INSERT,SELECT ON review_checks TO authenticated,anon;
CREATE FUNCTION pg_temp.review_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
INSERT INTO pg_temp.review_checks VALUES(label); RAISE NOTICE 'PASS: %',label; END; $$;
CREATE FUNCTION pg_temp.review_denied(statement text,code text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
IF SQLSTATE=code THEN PERFORM pg_temp.review_assert(true,label); RETURN; END IF;
RAISE EXCEPTION 'Unexpected SQLSTATE % for %: %',SQLSTATE,label,SQLERRM; END;
RAISE EXCEPTION 'Unexpected acceptance: %',label; END; $$;
CREATE FUNCTION pg_temp.review_statement(v uuid,action text,receipt uuid,checklist jsonb,comment text DEFAULT '') RETURNS text LANGUAGE sql AS $$
SELECT format('SELECT public.admin_review_exercise_version(%L,%L,%s,%L,%L,%L,%L,%L)',
id,approval_fingerprint_sha256,test_epoch,editorial_status,action,receipt,checklist,comment)
FROM public.exercise_versions WHERE id=v; $$;
CREATE FUNCTION pg_temp.review_receipt(v uuid,report jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE receipt uuid:=gen_random_uuid(); payload text; signature text; result jsonb;
BEGIN
SELECT jsonb_build_object('schemaVersion',1,'receiptId',receipt,'keyId','99200000-0000-4000-8000-000000000001',
'actorId',auth.uid(),'versionId',id,'fingerprint',approval_fingerprint_sha256,'epoch',test_epoch,
'issuedAt',floor(extract(epoch FROM clock_timestamp()))::bigint,
'engineArchiveSha256','650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290',
'report',report,'cases','[]'::jsonb)::text INTO payload FROM public.exercise_versions WHERE id=v;
signature:=encode(extensions.hmac(convert_to(payload,'UTF8'),decode(repeat('42',32),'hex'),'sha256'),'hex');
result:=public.admin_record_exercise_test(payload,signature); RETURN receipt; END; $$;
DO $tests$
DECLARE actor uuid:='99100000-0000-4000-8000-000000000001'; student uuid:='99100000-0000-4000-8000-000000000002';
chapter uuid:='99400000-0000-4000-8000-000000000001'; other_chapter uuid:='99400000-0000-4000-8000-000000000002';
v uuid; e bigint; r uuid; older uuid; created jsonb; report jsonb; seed jsonb; bad jsonb; command text; case_number integer:=0;
attestation jsonb:='{"mathematicsCorrect":true,"statementClear":true,"gradingChecked":true,"referencesChecked":true}';
source jsonb:='{"schemaVersion":5,"kind":"composed","id":"fixture","revision":"1","title":"LOCAL REVIEW FIXTURE","catalogue":{"chapter":"LOCAL REVIEW CHAPTER","skills":["local-review-skill"]},"generation":{"schemaVersion":5,"definitions":[],"constraints":[],"maxAttempts":100,"maxDraws":1000},"variables":[],"elements":[{"id":"q","type":"question","text":"2+2 ?","points":1,"response":{"format":"latex","kind":"rational"},"expectedLatex":"4","policy":{"domain":"rational","form":"value-only"}}]}';
BEGIN
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT id,'authenticated','authenticated',id::text||'@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"LOCAL FIXTURE","birth_date":"2000-01-01"}',now(),now() FROM unnest(ARRAY[actor,student]) id;
UPDATE public.profiles SET role='admin' WHERE id=actor;
INSERT INTO public.chapters(id,name,order_index,aliases) VALUES(chapter,'LOCAL REVIEW CHAPTER',990,'{}'),(other_chapter,'OTHER LOCAL CHAPTER',991,'{}');
INSERT INTO public.competences(id,name,chapter_id,max_points) VALUES('local-review-skill','LOCAL REVIEW SKILL',chapter,10),('other-review-skill','OTHER REVIEW SKILL',other_chapter,10);
INSERT INTO novlearn_admin_private.test_signing_keys(id,secret) VALUES('99200000-0000-4000-8000-000000000001',decode(repeat('42',32),'hex'));
PERFORM set_config('request.jwt.claim.sub',actor::text,true);
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'is_anonymous',false)::text,true);
SET LOCAL ROLE authenticated;
created:=public.admin_save_exercise_draft(NULL,NULL,NULL,source); v:=(created->>'versionId')::uuid; e:=(created->>'exerciseId')::bigint;
PERFORM pg_temp.review_assert((SELECT editorial_status='draft' FROM public.exercise_versions WHERE id=v),'draft creation still works with column grants');
PERFORM pg_temp.review_denied(format('UPDATE public.exercise_versions SET editorial_status=''approved'' WHERE id=%L',v),'42501','direct approval denied');
PERFORM pg_temp.review_denied(format('UPDATE public.exercise_versions SET editorial_status=''published'' WHERE id=%L',v),'42501','direct publication denied');
PERFORM pg_temp.review_denied(format('UPDATE public.exercise_versions SET approved_by=%L WHERE id=%L',student,v),'42501','forged approval actor denied');
PERFORM pg_temp.review_denied(format('UPDATE public.exercise_versions SET revision=9 WHERE id=%L',v),'42501','revision identity cannot be rewritten');
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'request_review',NULL,'{}'),'22023','missing receipt denied');
seed:=jsonb_build_object('seed',0,'passed',true,'reproducible',true,'publicProjectionSafe',true,'diagnostics','[]'::jsonb,'checks',
jsonb_build_array(jsonb_build_object('questionId','q','passed',true,'expectedState','correct','result',jsonb_build_object('state','correct')),
jsonb_build_object('questionId','q','passed',true,'expectedState','incorrect','result',jsonb_build_object('state','incorrect')),
jsonb_build_object('questionId','q','passed',true,'expectedState','invalid','result',jsonb_build_object('state','invalid'))));
report:=jsonb_build_object('definitionDigest',repeat('a',64),'engineVersion','0.1.0','passed',true,'complete',true,'seeds',jsonb_build_array(seed,seed||'{"seed":42}'));
FOR bad IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
report||jsonb_build_object('seeds',jsonb_build_array(seed)),
report||jsonb_build_object('seeds',jsonb_build_array(seed,seed)),
jsonb_set(report,'{seeds,0,reproducible}','false'),
jsonb_set(report,'{seeds,0,publicProjectionSafe}','false'),
jsonb_set(report,'{seeds,0,checks}',jsonb_build_array(seed->'checks'->0,seed->'checks'->2)),
jsonb_set(report,'{seeds,0,checks,0,result,state}','"indeterminate"'),
jsonb_set(report,'{seeds,0,diagnostics}','["generation failed"]'))) LOOP
r:=pg_temp.review_receipt(v,bad);
case_number:=case_number+1;
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'request_review',r,'{}'),'22023','insufficient report denied case '||case_number);
END LOOP;
PERFORM pg_temp.review_denied(format('SELECT pg_temp.review_receipt(%L,%L)',v,report||'{"complete":false,"passed":false}'),'22023','incomplete receipt rejected before review');
older:=pg_temp.review_receipt(v,report);
r:=pg_temp.review_receipt(v,report||'{"passed":false}');
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'request_review',older,'{}'),'22023','old passing receipt cannot hide latest failure');
r:=pg_temp.review_receipt(v,report);
RESET ROLE;
UPDATE novlearn_admin_private.test_signing_keys SET enabled=false WHERE id='99200000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'request_review',r,'{}'),'22023','disabled signing key blocks review');
RESET ROLE;
UPDATE novlearn_admin_private.test_signing_keys SET enabled=true WHERE id='99200000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'approve',r,attestation),'40001','draft cannot skip review');
command:=pg_temp.review_statement(v,'request_review',r,'{}');
PERFORM set_config('request.jwt.claim.sub',student::text,true);
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',student,'is_anonymous',false,'user_metadata',jsonb_build_object('role','admin'))::text,true);
PERFORM pg_temp.review_denied(command,'42501','student metadata cannot grant review rights');
PERFORM pg_temp.review_assert((SELECT count(*)=0 FROM public.admin_exercise_reviews),'student cannot read review history');
PERFORM set_config('request.jwt.claim.sub',actor::text,true);
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'is_anonymous',true)::text,true);
PERFORM pg_temp.review_denied(command,'42501','anonymous Admin profile denied');
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'is_anonymous',false)::text,true);
RESET ROLE; UPDATE public.profiles SET role='user' WHERE id=actor; SET LOCAL ROLE authenticated;
PERFORM pg_temp.review_denied(command,'42501','revoked role denied despite existing JWT');
RESET ROLE; UPDATE public.profiles SET role='admin' WHERE id=actor; SET LOCAL ROLE authenticated;
PERFORM public.admin_archive_exercise(e,false,true);
PERFORM pg_temp.review_denied(command,'40001','archived exercise denied');
PERFORM public.admin_archive_exercise(e,true,false);
EXECUTE command;
PERFORM pg_temp.review_assert((SELECT editorial_status='in_review' AND approved_by IS NULL FROM public.exercise_versions WHERE id=v),'review does not imply approval');
PERFORM pg_temp.review_denied(command,'40001','concurrent status mismatch denied');
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'approve',r,'{}'),'22023','human checklist required');
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'approve',r,attestation||'{"gradingChecked":false}'),'22023','unchecked human criterion denied');
EXECUTE pg_temp.review_statement(v,'approve',r,attestation,'Synthetic fixture attestation only');
PERFORM pg_temp.review_assert((SELECT editorial_status='approved' AND approved_by=actor AND approved_fingerprint_sha256=approval_fingerprint_sha256 FROM public.exercise_versions WHERE id=v),'approval binds current content and actual actor');
PERFORM pg_temp.review_assert((SELECT active_version_id IS NULL FROM public.exercises WHERE id=e),'approval never publishes or activates');
PERFORM pg_temp.review_assert((SELECT count(*)=2 AND bool_and(actor_id=actor AND references_snapshot->>'chapterId'=chapter::text) FROM public.admin_exercise_reviews WHERE version_id=v),'atomic audit retains actor and resolved references');
PERFORM pg_temp.review_denied('DELETE FROM public.admin_exercise_reviews','42501','review history cannot be deleted');
PERFORM pg_temp.review_denied('UPDATE public.admin_exercise_reviews SET comment=''forged''','42501','review history cannot be rewritten');
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'return_to_draft',NULL,'{}'),'22023','return requires a reason');
EXECUTE pg_temp.review_statement(v,'return_to_draft',NULL,'{}','Correction needed');
PERFORM pg_temp.review_assert((SELECT editorial_status='draft' AND approved_by IS NULL AND approved_at IS NULL FROM public.exercise_versions WHERE id=v),'return clears approval and preserves revision');
EXECUTE pg_temp.review_statement(v,'request_review',r,'{}');
EXECUTE pg_temp.review_statement(v,'approve',r,attestation);
command:=pg_temp.review_statement(v,'return_to_draft',NULL,'{}','stale');
UPDATE public.exercise_versions SET definition=source||'{"title":"EDITED AFTER APPROVAL"}',updated_by=actor WHERE id=v;
PERFORM pg_temp.review_assert((SELECT editorial_status='draft' AND approved_by IS NULL AND test_epoch=1 FROM public.exercise_versions WHERE id=v),'editing approved content invalidates approval and receipt epoch');
PERFORM pg_temp.review_denied(command,'40001','stale approval fingerprint and epoch denied');
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'request_review',r,'{}'),'22023','old receipt cannot certify edited content');
FOR bad IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
source-'catalogue',jsonb_set(source,'{catalogue,chapter}','"ABSENT CHAPTER"'),
jsonb_set(source,'{catalogue,skills}','["other-review-skill"]'))) LOOP
UPDATE public.exercise_versions SET definition=bad,updated_by=actor WHERE id=v;
r:=pg_temp.review_receipt(v,report);
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'request_review',r,'{}'),'22023','invalid taxonomy reference denied: '||COALESCE(bad->'catalogue','{}')::text);
END LOOP;
UPDATE public.exercise_versions SET definition=source,updated_by=actor WHERE id=v;
r:=pg_temp.review_receipt(v,report);
RESET ROLE;
UPDATE public.chapters SET aliases=ARRAY['LOCAL REVIEW CHAPTER'] WHERE id=other_chapter;
SET LOCAL ROLE authenticated;
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'request_review',r,'{}'),'22023','ambiguous chapter alias denied');
RESET ROLE; UPDATE public.chapters SET aliases='{}' WHERE id=other_chapter; SET LOCAL ROLE authenticated;
EXECUTE pg_temp.review_statement(v,'request_review',r,'{}');
EXECUTE pg_temp.review_statement(v,'approve',r,attestation);
RESET ROLE; UPDATE public.exercise_versions SET editorial_status='published' WHERE id=v; SET LOCAL ROLE authenticated;
PERFORM pg_temp.review_denied(pg_temp.review_statement(v,'return_to_draft',NULL,'{}','change'),'40001','published revision remains immutable');
RESET ROLE; SET LOCAL ROLE anon;
PERFORM pg_temp.review_denied('SELECT public.admin_review_exercise_version(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)','42501','anon cannot execute review RPC');
PERFORM pg_temp.review_denied('SELECT * FROM public.admin_exercise_reviews','42501','anon cannot read review audit');
RESET ROLE;
END;
$tests$;
SELECT jsonb_build_object('reviewAssertions',count(*),'result','PASS') FROM pg_temp.review_checks;
ROLLBACK;
