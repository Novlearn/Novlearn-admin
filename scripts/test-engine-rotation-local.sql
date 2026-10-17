\set ON_ERROR_STOP on
BEGIN;
-- SQL authorization fixtures only. No native Engine execution or human approval.
-- The runner creates this marked fixture with the baseline RPCs before rotation.
CREATE TEMP TABLE rotation_checks(label text);
GRANT INSERT,SELECT ON rotation_checks TO authenticated;
CREATE FUNCTION pg_temp.rotation_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
  INSERT INTO pg_temp.rotation_checks VALUES(label); RAISE NOTICE 'PASS: %',label;
END; $$;
CREATE FUNCTION pg_temp.rotation_denied(statement text,code text,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE=code THEN PERFORM pg_temp.rotation_assert(true,label); RETURN; END IF;
    RAISE EXCEPTION 'Unexpected SQLSTATE % for %: %',SQLSTATE,label,SQLERRM;
  END;
  RAISE EXCEPTION 'Unexpected acceptance: %',label;
END; $$;
DO $tests$
DECLARE
  actor uuid:='99100000-0000-4000-8000-000000000001';
  version public.exercise_versions%ROWTYPE; historical public.admin_exercise_test_runs%ROWTYPE;
  new_archive constant text:='d4d3abc408ab37f2f8a5faa512964b48947828bae9209cb1460b47111ca582f9';
  old_archive constant text:='650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290';
  payload text; signature text; receipt uuid; result jsonb; command text;
  attestation jsonb:='{"mathematicsCorrect":true,"statementClear":true,"gradingChecked":true,"referencesChecked":true}';
BEGIN
  SELECT * INTO STRICT version FROM public.exercise_versions WHERE definition->>'title'='LOCAL REVIEW FIXTURE' AND created_by=actor;
  SELECT * INTO STRICT historical FROM public.admin_exercise_test_runs WHERE version_id=version.id ORDER BY recorded_at DESC,id DESC LIMIT 1;
  PERFORM pg_temp.rotation_assert(historical.payload::jsonb->>'engineArchiveSha256'=old_archive AND version.editorial_status='approved','historical approved fixture retains its old archive');
  PERFORM pg_temp.rotation_assert((SELECT NOT enabled AND engine_archive_sha256=new_archive FROM novlearn_admin_private.publication_runtime WHERE singleton),'new archive is pinned and publication remains disabled');
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'is_anonymous',false)::text,true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.rotation_assert((SELECT r.payload=historical.payload AND r.signature=historical.signature FROM public.admin_exercise_test_runs r WHERE r.id=historical.id),'Admin can read the exact retained historical report');
  PERFORM pg_temp.rotation_denied(format('SELECT public.admin_record_exercise_test(%L,%L)',historical.payload,historical.signature),'22023','old build cannot submit a report again after rotation');
  command:=format('SELECT public.admin_export_exercise_publication(%L,%L,%s,%L)',version.id,version.approval_fingerprint_sha256,version.test_epoch,version.definition);
  PERFORM pg_temp.rotation_denied(command,'22023','historical approval cannot export under the new runtime');
  EXECUTE format('SELECT public.admin_review_exercise_version(%L,%L,%s,%L,%L,NULL,%L,%L)',version.id,version.approval_fingerprint_sha256,version.test_epoch,'approved','return_to_draft','{}','[AUTOMATED SQL FIXTURE] Retest after Engine rotation');
  PERFORM pg_temp.rotation_assert((SELECT editorial_status='draft' FROM public.exercise_versions WHERE id=version.id),'old approval can be returned to draft without editing content');
  PERFORM pg_temp.rotation_denied(format('SELECT public.admin_review_exercise_version(%L,%L,%s,%L,%L,%L,%L,%L)',version.id,version.approval_fingerprint_sha256,version.test_epoch,'draft','request_review',historical.id,'{}',''),'22023','old passing report cannot enter a new review');
  payload:=(historical.payload::jsonb||jsonb_build_object('receiptId',gen_random_uuid(),'issuedAt',floor(extract(epoch from clock_timestamp()))::bigint,'engineArchiveSha256',repeat('f',64)))::text;
  signature:=encode(extensions.hmac(convert_to(payload,'UTF8'),decode(repeat('42',32),'hex'),'sha256'),'hex');
  PERFORM pg_temp.rotation_denied(format('SELECT public.admin_record_exercise_test(%L,%L)',payload,signature),'22023','a correctly signed unknown archive is rejected');
  receipt:=gen_random_uuid();
  payload:=(historical.payload::jsonb||jsonb_build_object('receiptId',receipt,'issuedAt',floor(extract(epoch from clock_timestamp()))::bigint,'engineArchiveSha256',new_archive))::text;
  PERFORM pg_temp.rotation_denied(format('SELECT public.admin_record_exercise_test(%L,%L)',payload,historical.signature),'42501','archive changes require a fresh valid signature');
  signature:=encode(extensions.hmac(convert_to(payload,'UTF8'),decode(repeat('42',32),'hex'),'sha256'),'hex');
  result:=public.admin_record_exercise_test(payload,signature);
  PERFORM pg_temp.rotation_assert(result->>'receiptId'=receipt::text AND result->'passed'='true'::jsonb,'new correctly signed complete fixture is recorded');
  PERFORM public.admin_record_exercise_test(payload,signature);
  PERFORM pg_temp.rotation_assert((SELECT count(*)=1 FROM public.admin_exercise_test_runs WHERE id=receipt),'current build receipt remains idempotent');
  EXECUTE format('SELECT public.admin_review_exercise_version(%L,%L,%s,%L,%L,%L,%L,%L)',version.id,version.approval_fingerprint_sha256,version.test_epoch,'draft','request_review',receipt,'{}','[AUTOMATED SQL FIXTURE] Not a human review');
  PERFORM pg_temp.rotation_denied(format('SELECT public.admin_review_exercise_version(%L,%L,%s,%L,%L,%L,%L,%L)',version.id,version.approval_fingerprint_sha256,version.test_epoch,'in_review','approve',receipt,'{}',''),'22023','new archive does not waive the human checklist');
  EXECUTE format('SELECT public.admin_review_exercise_version(%L,%L,%s,%L,%L,%L,%L,%L)',version.id,version.approval_fingerprint_sha256,version.test_epoch,'in_review','approve',receipt,attestation,'[AUTOMATED SQL FIXTURE] Does not certify human acceptance');
  EXECUTE command INTO result;
  PERFORM pg_temp.rotation_assert(result->'payload'->>'engineArchiveSha256'=new_archive,'new explicitly reviewed report exports the current archive');
  -- A newer receipt must still be explicitly reviewed; matching archive alone is insufficient.
  payload:=(payload::jsonb||jsonb_build_object('receiptId',gen_random_uuid()))::text;
  signature:=encode(extensions.hmac(convert_to(payload,'UTF8'),decode(repeat('42',32),'hex'),'sha256'),'hex');
  PERFORM public.admin_record_exercise_test(payload,signature);
  PERFORM pg_temp.rotation_denied(command,'22023','unreviewed latest current receipt cannot replace the approved receipt');
  PERFORM pg_temp.rotation_assert((SELECT r.payload=historical.payload AND r.signature=historical.signature FROM public.admin_exercise_test_runs r WHERE r.id=historical.id),'historical receipt is unchanged throughout the new review');
  RESET ROLE;
END;
$tests$;
SELECT jsonb_build_object('rotationAssertions',count(*),'result','PASS') FROM pg_temp.rotation_checks;
ROLLBACK;
