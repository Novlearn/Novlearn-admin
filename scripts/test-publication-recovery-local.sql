\set ON_ERROR_STOP on
-- Pagination fixtures are owner-seeded protocol records, not newly approved
-- exercises or evidence of a target publication. All fixture mutations rollback.
BEGIN;
CREATE TEMP TABLE recovery_checks(label text);
GRANT INSERT ON recovery_checks TO anon,authenticated,service_role,novlearn_publication_journal_executor;
CREATE FUNCTION pg_temp.recovery_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 INSERT INTO pg_temp.recovery_checks VALUES(label);
END; $$;
CREATE FUNCTION pg_temp.recovery_denied(statement text,code text,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=code THEN PERFORM pg_temp.recovery_assert(true,label); RETURN; END IF;
  RAISE EXCEPTION 'Unexpected SQLSTATE % for %',SQLSTATE,label;
 END; RAISE EXCEPTION 'Unexpected acceptance: %',label;
END; $$;
CREATE TEMP TABLE recovery_actor AS SELECT :'actor'::uuid actor;
DO $test$
DECLARE page jsonb; page2 jsonb; cursor_id uuid; template jsonb; operation jsonb;
 actor_id uuid; definition jsonb; payload jsonb; inspection jsonb; catalogue uuid;
BEGIN
 SELECT actor INTO actor_id FROM pg_temp.recovery_actor;
 PERFORM pg_temp.recovery_assert((SELECT provolatile='s' AND prosecdef AND proconfig=ARRAY['search_path=""'] FROM pg_proc WHERE oid='novlearn_admin_private.pending_publication_operations(uuid)'::regprocedure),'read is stable with fixed namespace');
 SET LOCAL ROLE anon;
 PERFORM pg_temp.recovery_denied('SELECT novlearn_admin_private.pending_publication_operations()','42501','anonymous API cannot read machine queue');
 SET LOCAL ROLE authenticated;
 PERFORM pg_temp.recovery_denied('SELECT novlearn_admin_private.pending_publication_operations()','42501','authenticated API cannot read machine queue');
 SET LOCAL ROLE service_role;
 PERFORM pg_temp.recovery_denied('SELECT novlearn_admin_private.pending_publication_operations()','42501','generic service role cannot read machine queue');
 SET LOCAL ROLE novlearn_publication_journal_executor;
 page := novlearn_admin_private.pending_publication_operations();
 PERFORM pg_temp.recovery_assert(page='{"items":[],"next":null}'::jsonb,'empty queue has no fabricated result or cursor');
 RESET ROLE;
 -- A real prepared plan provides the record shape. Distinct catalog IDs below
 -- are synthetic queue pagination fixtures only; no source approval is implied.
 SELECT to_jsonb(o) INTO STRICT template FROM novlearn_admin_private.publication_operations o WHERE target_key='recovery-template' ORDER BY created_at DESC LIMIT 1;
 FOR i IN 1..16 LOOP
  catalogue := ('a6100000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  definition := jsonb_set((template->'payload'->>'definitionJson')::jsonb,'{id}',to_jsonb(catalogue::text));
  payload := template->'payload'||jsonb_build_object('catalogId',catalogue,'definitionJson',definition::text);
  payload := jsonb_set(payload,'{businessDigest}',to_jsonb(public.exercise_publication_digest(definition,payload->>'engineContract',payload->>'generationVersion',payload->>'canonicalizationVersion')));
  inspection := jsonb_set(template->'inspection','{state,catalogId}',to_jsonb(catalogue::text));
  operation := template||jsonb_build_object('id',('a6110000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
   'target_key','pagination-fixture','payload',payload,'inspection',inspection,
   'created_at','2026-01-01T00:00:00Z','updated_at','2026-01-01T00:00:00Z',
   'state',CASE WHEN i<=12 THEN CASE WHEN i%2=0 THEN 'uncertain' ELSE 'executing' END
     WHEN i=13 THEN 'planned' WHEN i=14 THEN 'cancelled' WHEN i=15 THEN 'failed' ELSE 'committed' END,
   'error_code',CASE WHEN i=15 THEN 'not_applied' END,
   'outcome',CASE WHEN i=16 THEN jsonb_build_object('catalogId',catalogue,'revision',payload->'revision','businessDigest',payload->'businessDigest',
    'exerciseId','9007199254740993','versionId','a6120000-0000-4000-8000-000000000001','stateToken',repeat('d',64),'result','published') END);
  INSERT INTO novlearn_admin_private.publication_operations SELECT (jsonb_populate_record(NULL::novlearn_admin_private.publication_operations,operation)).*;
 END LOOP;
 SET LOCAL ROLE novlearn_publication_journal_executor;
 page := novlearn_admin_private.pending_publication_operations();
 cursor_id := (page->>'next')::uuid;
 PERFORM pg_temp.recovery_assert(jsonb_array_length(page->'items')=10,'first page is bounded at ten records');
 PERFORM pg_temp.recovery_assert(cursor_id='a6110000-0000-4000-8000-000000000010','equal timestamps are ordered deterministically by UUID');
 PERFORM pg_temp.recovery_assert(page->'items'->0->>'id'='a6110000-0000-4000-8000-000000000001','oldest pending UUID appears first');
 PERFORM pg_temp.recovery_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'items') r WHERE r->>'state' NOT IN ('executing','uncertain')),'terminal and prepared plans are excluded');
 PERFORM pg_temp.recovery_assert(jsonb_typeof(page->'items'->0->'source_epoch')='string','private epoch preserves bigint precision');
 page2 := novlearn_admin_private.pending_publication_operations(cursor_id);
 PERFORM pg_temp.recovery_assert(jsonb_array_length(page2->'items')=2 AND page2->'next'='null'::jsonb,'second page returns remaining records without cursor');
 PERFORM pg_temp.recovery_assert(page2->'items'->0->>'id'='a6110000-0000-4000-8000-000000000011','keyset does not repeat the cursor record');
 PERFORM pg_temp.recovery_denied('SELECT novlearn_admin_private.pending_publication_operations(''a6190000-0000-4000-8000-000000000001'')','P0002','unknown cursor is rejected');
 RESET ROLE;
 UPDATE novlearn_admin_private.publication_operations SET state='failed',error_code='not_applied' WHERE id=cursor_id;
 UPDATE public.profiles SET role='user' WHERE id=actor_id;
 SET LOCAL ROLE novlearn_publication_journal_executor;
 PERFORM pg_temp.recovery_assert(novlearn_admin_private.pending_publication_operations(cursor_id)=page2,'terminal cursor remains usable during recovery');
 PERFORM pg_temp.recovery_assert(jsonb_array_length(novlearn_admin_private.pending_publication_operations()->'items')=10,'machine read survives initiator role revocation');
 PERFORM pg_temp.recovery_denied(format('SELECT novlearn_admin_private.get_publication_operation(%L,%L)',actor_id,page->'items'->0->>'id'),'42501','revoked initiator still cannot inspect or initiate a private plan');
 RESET ROLE;
END; $test$;
SELECT jsonb_build_object('result','PASS','recoveryAssertions',count(*)) FROM pg_temp.recovery_checks;
ROLLBACK;
