\set ON_ERROR_STOP on
-- Existing native-approved synthetic source; all journal/protocol fixtures rollback.
-- Outcome fixtures test the journal protocol, not an actual target commit.
BEGIN;
CREATE TEMP TABLE journal_checks(label text);
CREATE TEMP TABLE journal_sample(value jsonb);
GRANT INSERT ON journal_checks TO authenticated,anon,service_role,novlearn_publication_journal_executor;
CREATE FUNCTION pg_temp.journal_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label;END IF;INSERT INTO pg_temp.journal_checks VALUES(label);END; $$;
CREATE FUNCTION pg_temp.journal_denied(statement text,code text,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE statement;EXCEPTION WHEN OTHERS THEN IF SQLSTATE=code THEN PERFORM pg_temp.journal_assert(true,label);RETURN;END IF;RAISE EXCEPTION 'Unexpected % for %: %',SQLSTATE,label,SQLERRM;END;
 RAISE EXCEPTION 'Unexpected acceptance: %',label;END; $$;
CREATE TEMP TABLE journal_fixture AS SELECT :'actor'::uuid actor,v.id version_id,v.approval_fingerprint_sha256 fingerprint,v.test_epoch epoch,v.definition,
 NULL::jsonb inspection,NULL::jsonb outcome FROM public.exercise_versions v WHERE v.id=:'version'::uuid;
DO $$ DECLARE f record; exported jsonb; BEGIN
 SELECT * INTO STRICT f FROM pg_temp.journal_fixture;
 PERFORM novlearn_admin_private.publication_journal_actor(f.actor);
 exported:=public.admin_export_exercise_publication(f.version_id,f.fingerprint,f.epoch,f.definition);
 UPDATE pg_temp.journal_fixture SET inspection=jsonb_build_object('desiredHeader',novlearn_admin_private.publication_header(f.definition),'state',jsonb_build_object(
 'catalogId',exported->'payload'->'catalogId','requestedRevision',exported->'payload'->'revision','latestRevision',0,'stateToken',repeat('c',64),
 'runtime',(exported->'payload')-ARRAY['schemaVersion','catalogId','revision','definitionJson','businessDigest'],'parent',NULL,'candidate',NULL,'active',NULL)),
 outcome=jsonb_build_object('catalogId',exported->'payload'->'catalogId','revision',exported->'payload'->'revision','businessDigest',exported->'payload'->'businessDigest',
 'exerciseId','9007199254740993','versionId','a6030000-0000-4000-8000-000000000001','stateToken',repeat('d',64),'result','published');
END; $$;
GRANT SELECT ON journal_fixture TO novlearn_publication_journal_executor;
CREATE FUNCTION pg_temp.journal_new() RETURNS jsonb LANGUAGE sql AS $$
 SELECT novlearn_admin_private.prepare_publication_operation(actor,gen_random_uuid(),version_id,fingerprint,epoch,definition,'local-target','publish',inspection) FROM pg_temp.journal_fixture;
$$;
DO $test$
DECLARE f record; first_op jsonb; second_op jsonb; expired_op jsonb; cancelled_op jsonb; uncertain_op jsonb; final_op jsonb; total_events bigint; temp_id uuid; other uuid:='a6010000-0000-4000-8000-000000000001';
BEGIN
 SELECT * INTO STRICT f FROM pg_temp.journal_fixture;
 PERFORM pg_temp.journal_assert((SELECT NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls AND NOT rolreplication FROM pg_roles WHERE rolname='novlearn_publication_journal_executor'),'private journal role has no login or elevated attributes');
 PERFORM pg_temp.journal_assert(NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='novlearn_publication_journal_executor'::regrole),'no role membership provisioned');
 PERFORM pg_temp.journal_assert(NOT has_table_privilege('novlearn_publication_journal_executor','novlearn_admin_private.publication_operations','INSERT') AND NOT has_table_privilege('novlearn_publication_journal_executor','public.exercise_versions','UPDATE'),'executor has no direct journal or source write grant');
 PERFORM pg_temp.journal_assert((SELECT relrowsecurity FROM pg_class WHERE oid='novlearn_admin_private.publication_operations'::regclass) AND (SELECT relrowsecurity FROM pg_class WHERE oid='novlearn_admin_private.publication_operation_events'::regclass),'both journal tables have RLS');
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.journal_denied('SELECT pg_temp.journal_new()','42501','browser role cannot prepare trusted server plans');
 PERFORM pg_temp.journal_denied('SELECT novlearn_admin_private.record_publication_outcome(NULL,NULL,NULL,NULL,NULL,NULL)','42501','browser role cannot fabricate publication success');
 SET LOCAL ROLE anon;
 PERFORM pg_temp.journal_denied('SELECT public.admin_list_publication_operations()','42501','anon cannot list journal');
 SET LOCAL ROLE service_role;
 PERFORM pg_temp.journal_denied('SELECT pg_temp.journal_new()','42501','service role is not the dedicated publication journal capability');
 SET LOCAL ROLE novlearn_publication_journal_executor;
 PERFORM pg_temp.journal_denied('SELECT * FROM novlearn_admin_private.publication_operations','42501','private executor cannot bypass fixed journal functions');
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.publication_journal_actor(%L)',f.actor),'42501','actor setter is not directly executable by capability');
 first_op:=pg_temp.journal_new();second_op:=pg_temp.journal_new();
 PERFORM pg_temp.journal_assert(first_op->>'state'='planned' AND first_op->>'actor_id'=f.actor::text AND first_op->>'version_id'=f.version_id::text,'prepared plan binds verified initiator and exact source');
 PERFORM pg_temp.journal_assert(first_op->'payload'->>'definitionJson'=f.definition::text AND first_op->>'source_epoch'=f.epoch::text,'definition bytes and decimal epoch are preserved');
 PERFORM pg_temp.journal_assert(first_op->>'plan_digest'<>second_op->>'plan_digest','separate confirmations have independent immutable digests');
 PERFORM pg_temp.journal_assert((first_op->>'expires_at')::timestamptz-(first_op->>'created_at')::timestamptz=interval '15 minutes','confirmation lifetime is fixed by server');
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.claim_publication_operation(%L,%L,%L,''claim'')',f.actor,first_op->>'id',repeat('0',64)),'40001','wrong confirmation digest refused');
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.lock_publication_source(%L,%L,%L)',f.actor,first_op->>'id',first_op->>'plan_digest'),'40001','unclaimed plan cannot obtain source guard');
 expired_op:=pg_temp.journal_new();
 RESET ROLE;
 UPDATE novlearn_admin_private.publication_operations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=(expired_op->>'id')::uuid;
 SET LOCAL ROLE novlearn_publication_journal_executor;
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.claim_publication_operation(%L,%L,%L,''claim'')',f.actor,expired_op->>'id',expired_op->>'plan_digest'),'40001','expired plan cannot start');
 cancelled_op:=novlearn_admin_private.claim_publication_operation(f.actor,(expired_op->>'id')::uuid,expired_op->>'plan_digest','cancel');
 PERFORM pg_temp.journal_assert(cancelled_op->>'state'='cancelled','expired planned operation can be explicitly cancelled');
 first_op:=novlearn_admin_private.claim_publication_operation(f.actor,(first_op->>'id')::uuid,first_op->>'plan_digest','claim');
 PERFORM pg_temp.journal_assert(first_op->>'state'='executing','confirmation claims durable executing state');
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.claim_publication_operation(%L,%L,%L,''claim'')',f.actor,first_op->>'id',first_op->>'plan_digest'),'40001','claimed operation cannot execute a second time');
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.claim_publication_operation(%L,%L,%L,''claim'')',f.actor,second_op->>'id',second_op->>'plan_digest'),'40001','another operation for same catalogue cannot execute concurrently');
 PERFORM pg_temp.journal_assert(novlearn_admin_private.lock_publication_source(f.actor,(first_op->>'id')::uuid,first_op->>'plan_digest')->>'state'='executing','explicit source guard revalidates immutable evidence');
 RESET ROLE;
 PERFORM pg_temp.journal_denied(format('UPDATE public.exercises SET title=title WHERE id=(SELECT exercise_id FROM public.exercise_versions WHERE id=%L)',f.version_id),'40001','durable guard blocks parent edits');
 PERFORM pg_temp.journal_denied(format('UPDATE public.exercise_versions SET updated_at=updated_at WHERE id=%L',f.version_id),'40001','durable guard blocks selected version edits');
 PERFORM pg_temp.journal_denied(format('UPDATE public.admin_exercise_test_runs SET issued_at=issued_at WHERE id=%L',first_op->'source_snapshot'->>'receiptId'),'40001','durable guard protects current test evidence');
 PERFORM pg_temp.journal_denied(format('UPDATE public.admin_exercise_reviews SET comment=comment WHERE id=%L',first_op->'source_snapshot'->>'reviewId'),'40001','durable guard protects human review evidence');
 UPDATE novlearn_admin_private.test_signing_keys SET enabled=false WHERE id=(SELECT key_id FROM public.admin_exercise_test_runs WHERE id=(first_op->'source_snapshot'->>'receiptId')::uuid);
 SET LOCAL ROLE novlearn_publication_journal_executor;
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.lock_publication_source(%L,%L,%L)',f.actor,first_op->>'id',first_op->>'plan_digest'),'40001','key revocation remains possible and invalidates execution guard');
 RESET ROLE;
 UPDATE novlearn_admin_private.test_signing_keys SET enabled=true WHERE id=(SELECT key_id FROM public.admin_exercise_test_runs WHERE id=(first_op->'source_snapshot'->>'receiptId')::uuid);
 SET LOCAL ROLE novlearn_publication_journal_executor;
 uncertain_op:=novlearn_admin_private.record_publication_outcome((first_op->>'id')::uuid,first_op->>'plan_digest','executing','uncertain',NULL,NULL);
 PERFORM pg_temp.journal_assert(uncertain_op->>'state'='uncertain' AND uncertain_op->'outcome'='null'::jsonb,'ambiguous result remains uncertain without success');
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.record_publication_outcome(%L,%L,''uncertain'',''failed'',NULL,''timeout'')',first_op->>'id',first_op->>'plan_digest'),'22023','timeout cannot be classified as a definite failure');
 RESET ROLE;
 PERFORM pg_temp.journal_denied(format('UPDATE public.exercises SET title=title WHERE id=(SELECT exercise_id FROM public.exercise_versions WHERE id=%L)',f.version_id),'40001','uncertain operation keeps durable content guard');
 UPDATE public.profiles SET role='user' WHERE id=f.actor;
 SET LOCAL ROLE novlearn_publication_journal_executor;
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.get_publication_operation(%L,%L)',f.actor,first_op->>'id'),'42501','revoked user cannot initiate or inspect private plan');
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.record_publication_outcome(%L,%L,''uncertain'',''committed'',%L,NULL)',first_op->>'id',first_op->>'plan_digest',f.outcome||jsonb_build_object('businessDigest',repeat('0',64))),'22023','result must match confirmed business content');
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.record_publication_outcome(%L,%L,''uncertain'',''committed'',%L,NULL)',first_op->>'id',first_op->>'plan_digest',f.outcome||'{"actorId":"forged"}'),'22023','machine result contract rejects actor and unknown fields');
 final_op:=novlearn_admin_private.record_publication_outcome((first_op->>'id')::uuid,first_op->>'plan_digest','uncertain','committed',f.outcome,NULL);
 PERFORM pg_temp.journal_assert(final_op->>'state'='committed' AND final_op->'outcome'->>'exerciseId'='9007199254740993','trusted machine observation can record result after initiator revocation');
 RESET ROLE;
 SELECT count(*) INTO total_events FROM novlearn_admin_private.publication_operation_events WHERE operation_id=(first_op->>'id')::uuid;
 SET LOCAL ROLE novlearn_publication_journal_executor;
 PERFORM novlearn_admin_private.record_publication_outcome((first_op->>'id')::uuid,first_op->>'plan_digest','uncertain','committed',f.outcome,NULL);
 RESET ROLE;
 PERFORM pg_temp.journal_assert((SELECT count(*)=total_events FROM novlearn_admin_private.publication_operation_events WHERE operation_id=(first_op->>'id')::uuid),'identical outcome is idempotent without duplicate event');
 PERFORM pg_temp.journal_assert((SELECT count(*)=4 AND count(*) FILTER(WHERE actor_id IS NULL)=2 FROM novlearn_admin_private.publication_operation_events WHERE operation_id=(first_op->>'id')::uuid),'prepared and claimed are attributed; uncertain and result are machine events');
 UPDATE public.profiles SET role='admin' WHERE id=f.actor;
 UPDATE public.exercises SET title=title WHERE id=(SELECT exercise_id FROM public.exercise_versions WHERE id=f.version_id);
 PERFORM pg_temp.journal_assert(true,'terminal confirmed result releases durable content guard');
 INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 VALUES(other,'authenticated','authenticated','journal-other@local.invalid','',now(),'{"provider":"email","providers":["email"]}','{"first_name":"LOCAL JOURNAL FIXTURE","birth_date":"2000-01-01"}',now(),now());
 UPDATE public.profiles SET role='admin' WHERE id=other;
 SET LOCAL ROLE novlearn_publication_journal_executor;
 PERFORM pg_temp.journal_denied(format('SELECT novlearn_admin_private.get_publication_operation(%L,%L)',other,first_op->>'id'),'P0002','another admin cannot reuse an initiator confirmation');
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',f.actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',f.actor,'is_anonymous',false)::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.journal_assert((public.admin_list_publication_operations()->>'total')::int=3,'admin can read own minimal journal history');
 PERFORM pg_temp.journal_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.admin_list_publication_operations()->'items') item WHERE item ?| ARRAY['payload','inspection','source_snapshot','actor_id','plan_digest','outcome']),'history excludes content evidence, confirmation capability and actors');
 PERFORM set_config('request.jwt.claim.sub',other::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other,'is_anonymous',false)::text,true);
 PERFORM pg_temp.journal_assert((public.admin_list_publication_operations()->>'total')::int=0,'history remains scoped to initiator');
 RESET ROLE;
 INSERT INTO pg_temp.journal_sample(value) VALUES(final_op);
END;$test$;
SELECT jsonb_build_object('result','PASS','journalAssertions',count(*)) FROM pg_temp.journal_checks;
SELECT value FROM pg_temp.journal_sample;
ROLLBACK;
