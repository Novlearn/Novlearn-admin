\set ON_ERROR_STOP on
-- SQL protocol fixture only: the supplied target observation is synthetic.
-- Actual Engine/target transfer is qualified separately. ALL changes rollback.
BEGIN;
CREATE TEMP TABLE source_checks(label text);
GRANT INSERT ON source_checks TO anon,authenticated,service_role,novlearn_publication_journal_executor;
CREATE FUNCTION pg_temp.source_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 INSERT INTO pg_temp.source_checks VALUES(label);
END; $$;
CREATE FUNCTION pg_temp.source_denied(statement text,code text,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=code THEN PERFORM pg_temp.source_assert(true,label); RETURN; END IF;
  RAISE EXCEPTION 'Unexpected SQLSTATE % for %',SQLSTATE,label;
 END; RAISE EXCEPTION 'Unexpected acceptance: %',label;
END; $$;
DO $test$
DECLARE actor uuid:='98500000-0000-4000-8000-000000000001'; version_id uuid:='c3368fa2-3c7e-4824-b38d-cd3183d7a620';
 v public.exercise_versions%ROWTYPE; parent_before jsonb; version_before jsonb; after_parent jsonb; after_version jsonb;
 exported jsonb; inspection jsonb; operation jsonb; observed jsonb; committed jsonb; outcome jsonb; expected jsonb; event_count bigint; key_id uuid;
BEGIN
 SELECT * INTO STRICT v FROM public.exercise_versions WHERE id=version_id;
 SELECT to_jsonb(p) INTO parent_before FROM public.exercises p WHERE id=v.exercise_id;
 SELECT to_jsonb(x) INTO version_before FROM public.exercise_versions x WHERE id=version_id;
 PERFORM pg_temp.source_assert(v.editorial_status='approved' AND parent_before->'active_version_id'='null'::jsonb,'retained native source starts approved and inactive');
 PERFORM pg_temp.source_assert((SELECT prosecdef AND proconfig=ARRAY['search_path=""'] FROM pg_proc WHERE oid='novlearn_admin_private.record_publication_outcome(uuid,text,text,text,jsonb,text)'::regprocedure),'record keeps private definer and empty namespace');
 FOREACH expected IN ARRAY ARRAY['"anon"'::jsonb,'"authenticated"'::jsonb,'"service_role"'::jsonb] LOOP
  PERFORM pg_temp.source_assert(NOT has_function_privilege(expected#>>'{}','novlearn_admin_private.record_publication_outcome(uuid,text,text,text,jsonb,text)','EXECUTE'),'API role cannot invoke source finalization: '||(expected#>>'{}'));
 END LOOP;
 PERFORM pg_temp.source_assert(NOT has_table_privilege('novlearn_publication_journal_executor','public.exercises','UPDATE'),'journal role has no direct parent write');
 PERFORM pg_temp.source_assert(NOT has_table_privilege('novlearn_publication_journal_executor','public.exercise_versions','UPDATE'),'journal role has no direct version write');

 PERFORM novlearn_admin_private.publication_journal_actor(actor);
 exported:=public.admin_export_exercise_publication(v.id,v.approval_fingerprint_sha256,v.test_epoch,v.definition);
 inspection:=jsonb_build_object('desiredHeader',novlearn_admin_private.publication_header(v.definition),'state',jsonb_build_object('catalogId',exported->'payload'->'catalogId','requestedRevision',exported->'payload'->'revision','latestRevision',0,'stateToken',repeat('c',64),'runtime',(exported->'payload')-ARRAY['schemaVersion','catalogId','revision','definitionJson','businessDigest'],'parent',NULL,'candidate',NULL,'active',NULL));
 outcome:=jsonb_build_object('catalogId',exported->'payload'->'catalogId','revision',exported->'payload'->'revision','businessDigest',exported->'payload'->'businessDigest','exerciseId','9007199254740993','versionId','a6200000-0000-4000-8000-000000000001','stateToken',repeat('d',64),'result','published');
 SET LOCAL ROLE novlearn_publication_journal_executor;
 PERFORM pg_temp.source_assert(novlearn_admin_private.publication_source_contract()='atomic-source-finalization-v1','source contract is available only with the atomic finalizer');
 operation:=novlearn_admin_private.prepare_publication_operation(actor,gen_random_uuid(),v.id,v.approval_fingerprint_sha256,v.test_epoch,v.definition,'local-source-protocol','publish',inspection);
 operation:=novlearn_admin_private.claim_publication_operation(actor,(operation->>'id')::uuid,operation->>'plan_digest','claim');
 observed:=novlearn_admin_private.record_publication_outcome((operation->>'id')::uuid,operation->>'plan_digest','executing','uncertain',NULL,NULL);
 RESET ROLE;
 PERFORM pg_temp.source_assert((SELECT to_jsonb(x)=version_before FROM public.exercise_versions x WHERE id=version_id),'uncertain result preserves every version field');
 PERFORM pg_temp.source_assert((SELECT to_jsonb(p)=parent_before FROM public.exercises p WHERE id=v.exercise_id),'uncertain result preserves every parent field');
 PERFORM pg_temp.source_denied(format('UPDATE public.exercises SET title=title||'' attempted edit'' WHERE id=%L',v.exercise_id),'40001','pending source still blocks ordinary parent editing');
 SET LOCAL ROLE novlearn_publication_journal_executor;
 observed:=novlearn_admin_private.record_publication_outcome((operation->>'id')::uuid,operation->>'plan_digest','uncertain','failed',NULL,'not_applied');
 RESET ROLE;
 PERFORM pg_temp.source_assert((SELECT to_jsonb(x)=version_before FROM public.exercise_versions x WHERE id=version_id),'definite failure preserves every version field');
 PERFORM pg_temp.source_assert((SELECT to_jsonb(p)=parent_before FROM public.exercises p WHERE id=v.exercise_id),'definite failure preserves every parent field');

 SET LOCAL ROLE novlearn_publication_journal_executor;
 operation:=novlearn_admin_private.prepare_publication_operation(actor,gen_random_uuid(),v.id,v.approval_fingerprint_sha256,v.test_epoch,v.definition,'local-source-protocol','publish',inspection);
 operation:=novlearn_admin_private.claim_publication_operation(actor,(operation->>'id')::uuid,operation->>'plan_digest','claim');
 PERFORM pg_temp.source_denied(format('SELECT novlearn_admin_private.record_publication_outcome(%L,%L,''executing'',''committed'',%L::jsonb,NULL)',operation->>'id',repeat('a',64),outcome),'40001','wrong digest cannot finalize a source');
 PERFORM pg_temp.source_denied(format('SELECT novlearn_admin_private.record_publication_outcome(%L,%L,''executing'',''committed'',%L::jsonb,NULL)',operation->>'id',operation->>'plan_digest',outcome||'{"revision":999}'::jsonb),'22023','wrong target content cannot finalize a source');
 PERFORM pg_temp.source_denied(format('SELECT novlearn_admin_private.record_publication_outcome(%L,%L,''executing'',''committed'',NULL,NULL)',operation->>'id',operation->>'plan_digest'),'22023','missing target observation cannot finalize a source');
 RESET ROLE;
 PERFORM pg_temp.source_assert((SELECT o.state='executing' AND o.outcome IS NULL FROM novlearn_admin_private.publication_operations o WHERE o.id=(operation->>'id')::uuid),'failed observations leave the operation pending');
 PERFORM pg_temp.source_assert((SELECT to_jsonb(x)=version_before FROM public.exercise_versions x WHERE id=version_id),'failed observations leave approved source verbatim');

 -- Revocation after a verified commit must not erase its machine fact. The
 -- caller-provided outcome is explicitly a protocol fixture, not a real target.
 SELECT r.key_id INTO key_id FROM public.admin_exercise_test_runs r WHERE r.id=(operation->'source_snapshot'->>'receiptId')::uuid;
 UPDATE public.profiles SET role='user' WHERE id=actor;
 UPDATE novlearn_admin_private.test_signing_keys SET enabled=false WHERE id=key_id;
 SET LOCAL ROLE novlearn_publication_journal_executor;
 committed:=novlearn_admin_private.record_publication_outcome((operation->>'id')::uuid,operation->>'plan_digest','executing','committed',outcome,NULL);
 RESET ROLE;
 SELECT to_jsonb(x) INTO after_version FROM public.exercise_versions x WHERE id=version_id;
 SELECT to_jsonb(p) INTO after_parent FROM public.exercises p WHERE id=v.exercise_id;
 expected:=version_before||jsonb_build_object('editorial_status','published','published_at',transaction_timestamp(),'updated_at',transaction_timestamp());
 PERFORM pg_temp.source_assert(after_version=expected,'publish changes only status and exact managed timestamps in the full version row');
 expected:=parent_before||jsonb_build_object('active_version_id',version_id,'publication_epoch',(parent_before->>'publication_epoch')::bigint+1);
 IF parent_before?'updated_at' THEN expected:=expected||jsonb_build_object('updated_at',transaction_timestamp()); END IF;
 PERFORM pg_temp.source_assert(after_parent=expected,'publish changes only source pointer, epoch and exact managed timestamp in the full parent row');
 PERFORM pg_temp.source_assert(after_parent->>'active_version_id'=version_id::text AND version_id::text<>outcome->>'versionId','source activation uses source UUID, never target UUID');
 PERFORM pg_temp.source_assert(committed->>'state'='committed','journal commits together with published source');
 PERFORM pg_temp.source_assert((SELECT role='user' FROM public.profiles WHERE id=actor),'machine finalization does not undo actor revocation');
 PERFORM pg_temp.source_assert((SELECT NOT enabled FROM novlearn_admin_private.test_signing_keys WHERE id=key_id),'machine finalization does not reactivate revoked signing key');
 SELECT count(*) INTO event_count FROM novlearn_admin_private.publication_operation_events WHERE operation_id=(operation->>'id')::uuid AND state='committed' AND actor_id IS NULL;
 PERFORM pg_temp.source_assert(event_count=1,'one explicit machine committed event is appended');
 SET LOCAL ROLE novlearn_publication_journal_executor;
 observed:=novlearn_admin_private.record_publication_outcome((operation->>'id')::uuid,operation->>'plan_digest','executing','committed',outcome,NULL);
 RESET ROLE;
 PERFORM pg_temp.source_assert(observed=committed,'same committed observation is an exact journal no-op');
 PERFORM pg_temp.source_assert((SELECT to_jsonb(x)=after_version FROM public.exercise_versions x WHERE id=version_id),'replay never rewrites a published version');
 PERFORM pg_temp.source_assert((SELECT to_jsonb(p)=after_parent FROM public.exercises p WHERE id=v.exercise_id),'replay never bumps source pointer or epoch');

 -- A historical record replay cannot undo a later source activation decision.
 UPDATE public.exercises SET active_version_id=NULL WHERE id=v.exercise_id;
 SELECT to_jsonb(p) INTO expected FROM public.exercises p WHERE id=v.exercise_id;
 SET LOCAL ROLE novlearn_publication_journal_executor;
 observed:=novlearn_admin_private.record_publication_outcome((operation->>'id')::uuid,operation->>'plan_digest','executing','committed',outcome,NULL);
 RESET ROLE;
 PERFORM pg_temp.source_assert((SELECT to_jsonb(p)=expected FROM public.exercises p WHERE id=v.exercise_id),'historical record replay cannot reactivate an old source pointer');
 UPDATE public.profiles SET role='admin' WHERE id=actor;
 UPDATE novlearn_admin_private.test_signing_keys SET enabled=true WHERE id=key_id;
 inspection:=jsonb_set(inspection,'{state}',inspection->'state'||jsonb_build_object('latestRevision',2,
  'parent',(inspection->'desiredHeader')||jsonb_build_object('id','9007199254740993','catalog_id',v.definition->>'id','publication_epoch',1,'admin_archived_at',NULL,'activeVersionId','a6200000-0000-4000-8000-000000000002'),
  'candidate',jsonb_build_object('id',outcome->>'versionId','revision',1,'status','published','businessDigest',outcome->>'businessDigest','definitionJson',v.definition::text),
  'active',jsonb_build_object('id','a6200000-0000-4000-8000-000000000002','revision',2,'status','published','businessDigest',public.exercise_publication_digest(jsonb_set(v.definition,'{revision}','"2"'::jsonb),v.engine_contract,v.generation_version,v.canonicalization_version),'definitionJson',jsonb_set(v.definition,'{revision}','"2"'::jsonb)::text)));
 SET LOCAL ROLE novlearn_publication_journal_executor;
 operation:=novlearn_admin_private.prepare_publication_operation(actor,gen_random_uuid(),v.id,v.approval_fingerprint_sha256,v.test_epoch,v.definition,'local-source-protocol','rollback',inspection);
 operation:=novlearn_admin_private.claim_publication_operation(actor,(operation->>'id')::uuid,operation->>'plan_digest','claim');
 observed:=novlearn_admin_private.record_publication_outcome((operation->>'id')::uuid,operation->>'plan_digest','executing','committed',outcome||'{"result":"rolled_back"}'::jsonb,NULL);
 RESET ROLE;
 PERFORM pg_temp.source_assert((SELECT active_version_id=version_id FROM public.exercises WHERE id=v.exercise_id),'a new confirmed rollback protocol activates the requested local source UUID');
 PERFORM pg_temp.source_assert((SELECT to_jsonb(x)=after_version FROM public.exercise_versions x WHERE id=version_id),'rollback protocol leaves published definition and timestamps immutable');
END; $test$;
SELECT jsonb_build_object('result','PASS','sourceAssertions',count(*),'targetObservation','synthetic protocol fixture') FROM pg_temp.source_checks;
ROLLBACK;
