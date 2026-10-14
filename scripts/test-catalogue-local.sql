-- Synthetic fixtures only, all changes rolled back. Run on the isolated replay DB.
BEGIN;
CREATE TEMP TABLE catalogue_checks(label text);
CREATE FUNCTION pg_temp.catalogue_assert(ok boolean,label text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'catalogue assertion failed: %',label; END IF;
  INSERT INTO pg_temp.catalogue_checks VALUES(label);
END;
$$;
CREATE FUNCTION pg_temp.catalogue_denied(query text,expected_code text,label text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE failed boolean := false;
BEGIN
  BEGIN EXECUTE query;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_code THEN RAISE; END IF;
    failed := true;
  END;
  PERFORM pg_temp.catalogue_assert(failed,label);
END;
$$;
DO $$ BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon,authenticated,service_role',
    (SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema()));
END; $$;
DO $tests$
DECLARE admin_id uuid := '91000000-0000-0000-0000-000000000001';
  student_id uuid := '91000000-0000-0000-0000-000000000002';
  source jsonb := '{"schemaVersion":5,"kind":"composed","id":"draft","revision":"1","title":"LOCAL CATALOGUE TEST","catalogue":{"chapter":"TEST","skills":["test-skill"],"exerciseType":"classic","needsCalculator":false},"generation":{"schemaVersion":5,"definitions":[],"constraints":[],"maxAttempts":100,"maxDraws":1000},"variables":[],"elements":[]}';
  created jsonb; saved jsonb; copied jsonb; next_version jsonb; listing jsonb;
  exercise bigint; version uuid; original uuid; legacy bigint; attempt bigint; snapshot jsonb;
BEGIN
  INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    VALUES(admin_id,'authenticated','authenticated','catalogue-admin@fixture.test','',now(),
      '{"provider":"email","providers":["email"]}','{"first_name":"LOCAL TEST","birth_date":"2000-01-01"}',now(),now()),
      (student_id,'authenticated','authenticated','catalogue-student@fixture.test','',now(),
      '{"provider":"email","providers":["email"]}','{"first_name":"LOCAL TEST","birth_date":"2000-01-01"}',now(),now());
  UPDATE public.profiles SET role='admin' WHERE id=admin_id;
  INSERT INTO public.exercises(title,chapter,difficulty,content)
    VALUES('LEGACY CATALOGUE TEST','TEST','easy','{"legacy":true}') RETURNING id INTO legacy;
  SELECT to_jsonb(e) INTO snapshot FROM public.exercises e WHERE id=legacy;
  INSERT INTO public.exercise_attempts(user_id,exercise_id,is_correct) VALUES(student_id,legacy,true) RETURNING id INTO attempt;
  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'is_anonymous',false)::text,true);
  SET LOCAL ROLE authenticated;
  created := public.admin_save_exercise_draft(NULL,NULL,NULL,source);
  exercise := (created->>'exerciseId')::bigint; version := (created->>'versionId')::uuid; original:=version;
  PERFORM pg_temp.catalogue_assert((SELECT catalog_id IS NOT NULL AND content='{}' AND active_version_id IS NULL FROM public.exercises WHERE id=exercise),'new parent contains no expected answers or active publication');
  PERFORM pg_temp.catalogue_assert((SELECT definition->>'id'=e.catalog_id::text AND definition->>'revision'='1'
    AND editorial_status='draft' AND approved_by IS NULL AND published_at IS NULL
    FROM public.exercise_versions v JOIN public.exercises e ON e.id=v.exercise_id WHERE v.id=version),'canonical identity/revision assigned in SQL and approval absent');
  PERFORM pg_temp.catalogue_assert((SELECT definition_sha256=encode(extensions.digest(definition::text,'sha256'),'hex') FROM public.exercise_versions WHERE id=version),'draft hash is recomputed by actual pgcrypto');
  PERFORM pg_temp.catalogue_assert((SELECT count(*)=1 FROM public.admin_content_events WHERE version_id=version AND actor_id=admin_id AND action='draft_created'),'creation and actor audited atomically');

  saved := public.admin_save_exercise_draft(exercise,version,created->>'fingerprint',source || '{"title":"UPDATED CATALOGUE TEST"}');
  PERFORM pg_temp.catalogue_assert(saved->>'fingerprint'<>created->>'fingerprint','content edits change approval fingerprint');
  PERFORM pg_temp.catalogue_assert((SELECT count(*)=1 FROM public.exercise_versions WHERE exercise_id=exercise),'saving a draft does not append arbitrary revisions');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_save_exercise_draft(%s,%L,%L,%L)',exercise,version,created->>'fingerprint',source),'40001','stale save cannot overwrite another editor');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_save_exercise_draft(%s,%L,NULL,%L)',exercise,version,source),'40001','existing draft requires optimistic precondition');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_save_exercise_draft(%s,NULL,NULL,%L)',legacy,source),'22023','legacy content is not silently converted');
  PERFORM pg_temp.catalogue_denied('SELECT public.admin_save_exercise_draft(NULL,NULL,NULL,''{"schemaVersion":4,"kind":"composed","title":"bad"}'')','22023','noncanonical schema rejected');
  PERFORM pg_temp.catalogue_denied('SELECT public.admin_save_exercise_draft(NULL,NULL,NULL,NULL)','22023','NULL definition rejected before parent creation');

  copied := public.admin_duplicate_exercise(version);
  PERFORM pg_temp.catalogue_assert(copied->>'exerciseId'<>created->>'exerciseId' AND copied->>'versionId'<>created->>'versionId','duplicate receives independent parent and revision identity');
  PERFORM pg_temp.catalogue_assert((SELECT definition->>'id'<> (SELECT definition->>'id' FROM public.exercise_versions WHERE id=version)
    AND editorial_status='draft' AND revision=1 FROM public.exercise_versions WHERE id=(copied->>'versionId')::uuid),'duplicate remains unapproved revision one');
  next_version := public.admin_save_exercise_draft(exercise,NULL,NULL,source);
  PERFORM pg_temp.catalogue_assert((next_version->>'revision')::integer=2,'new revision is assigned under parent lock');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_save_exercise_draft(%s,%L,%L,%L)',legacy,version,saved->>'fingerprint',source),'22023','version cannot be retargeted to legacy parent');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_save_exercise_draft(%s,%L,%L,%L)',(copied->>'exerciseId')::bigint,version,saved->>'fingerprint',source),'P0002','version from another exercise cannot be edited');

  listing := public.admin_list_exercises('UPDATED CATALOGUE TEST','draft','title',0,25);
  PERFORM pg_temp.catalogue_assert((listing->>'total')::integer=1
    AND listing->'items'->0->>'id'=copied->>'exerciseId',
    'old title finds its independent duplicate but not the original latest revision');
  listing := public.admin_list_exercises('LOCAL CATALOGUE TEST','draft','title',0,25);
  PERFORM pg_temp.catalogue_assert((listing->>'total')::integer=1 AND jsonb_array_length(listing->'items')=1,'search and editorial filters select latest canonical revision');
  PERFORM pg_temp.catalogue_assert(NOT (listing->'items'->0 ? 'definition') AND NOT (listing->'items'->0 ? 'content') AND NOT (listing->'items'->0 ? 'expected'),'list excludes private definitions and expected answers');
  PERFORM pg_temp.catalogue_assert(jsonb_typeof(listing->'items'->0->'id')='string','bigint identity is projected as a string');
  PERFORM pg_temp.catalogue_assert(jsonb_array_length(public.admin_list_exercises('TEST','all','recent',0,1)->'items')=1,'pagination is bounded in SQL');
  PERFORM pg_temp.catalogue_assert((public.admin_list_exercises('LOCAL%CATALOGUE','all')->>'total')::int=0,'search treats wildcard characters literally');
  PERFORM pg_temp.catalogue_denied('SELECT public.admin_list_exercises('''',''all'',''recent'',0,1000)','22023','excessive SQL page size refused');

  PERFORM public.admin_archive_exercise(exercise,false,true);
  PERFORM pg_temp.catalogue_assert((SELECT admin_archived_at IS NOT NULL AND active_version_id IS NULL FROM public.exercises WHERE id=exercise),'archive does not activate or erase content');
  PERFORM pg_temp.catalogue_assert((SELECT count(*)=2 FROM public.exercise_versions WHERE exercise_id=exercise),'archive preserves all revisions');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_archive_exercise(%s,false,true)',exercise),'40001','archive rejects concurrent state mismatch');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_save_exercise_draft(%s,NULL,NULL,%L)',exercise,source),'40001','archived exercise cannot be edited');
  PERFORM public.admin_archive_exercise(exercise,true,false);
  PERFORM pg_temp.catalogue_assert((SELECT admin_archived_at IS NULL FROM public.exercises WHERE id=exercise),'restore returns editable catalogue state');
  PERFORM pg_temp.catalogue_denied('DELETE FROM public.admin_content_events','42501','even Admin cannot delete audit events');
  PERFORM pg_temp.catalogue_denied('TRUNCATE public.admin_content_events','42501','even Admin cannot truncate audit events');
  PERFORM pg_temp.catalogue_denied(format('INSERT INTO public.admin_content_events(actor_id,exercise_id,action) VALUES(%L,%s,''archived'')',student_id,exercise),'42501','Admin cannot impersonate another audit actor');

  UPDATE public.exercise_versions SET editorial_status='approved',approved_by=admin_id,approved_at=now() WHERE id=version;
  UPDATE public.exercise_versions SET editorial_status='published' WHERE id=version;
  PERFORM public.publish_exercise_version(exercise,version);
  PERFORM public.admin_archive_exercise(exercise,false,true);
  PERFORM pg_temp.catalogue_assert((SELECT active_version_id=original FROM public.exercises WHERE id=exercise),'archive preserves existing active version');
  PERFORM pg_temp.catalogue_denied(format('UPDATE public.exercise_versions SET definition=%L WHERE id=%L',source,version),'P0001','published definition stays immutable');
  PERFORM public.admin_archive_exercise(exercise,true,false);
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_save_exercise_draft(%s,%L,%L,%L)',exercise,version,saved->>'fingerprint',source),'40001','published revision cannot be saved as a draft');

  PERFORM set_config('request.jwt.claim.sub',student_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',student_id,'is_anonymous',false,'user_metadata',jsonb_build_object('role','admin'))::text,true);
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_save_exercise_draft(NULL,NULL,NULL,%L)',source),'42501','student metadata does not authorize creation');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_duplicate_exercise(%L)',version),'42501','student cannot duplicate private definitions');
  PERFORM pg_temp.catalogue_denied(format('SELECT public.admin_archive_exercise(%s,false,true)',exercise),'42501','student cannot archive');
  PERFORM pg_temp.catalogue_denied('SELECT public.admin_list_exercises()','42501','student cannot use Admin catalogue RPC');
  PERFORM pg_temp.catalogue_assert((SELECT count(*)=0 FROM public.exercises WHERE id=(copied->>'exerciseId')::bigint),'student cannot see new unpublished draft parent');
  PERFORM pg_temp.catalogue_assert((SELECT count(*)=0 FROM public.exercise_versions WHERE exercise_id=exercise),'student cannot read even a published private definition');
  PERFORM pg_temp.catalogue_assert((SELECT count(*)=0 FROM public.admin_content_events),'student cannot read Admin audit');

  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'is_anonymous',true)::text,true);
  PERFORM pg_temp.catalogue_denied('SELECT public.admin_list_exercises()','42501','anonymous Auth identity with admin profile is refused');
  RESET ROLE;
  PERFORM pg_temp.catalogue_assert((SELECT to_jsonb(e)=snapshot FROM public.exercises e WHERE id=legacy),'all preexisting legacy metadata/content remain identical');
  PERFORM pg_temp.catalogue_assert((SELECT exercise_id=legacy AND exercise_version_id IS NULL FROM public.exercise_attempts WHERE id=attempt),'historical attempt keeps its original link and unknown version');
  PERFORM pg_temp.catalogue_assert((SELECT count(*)=0 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('admin_save_exercise_draft','admin_duplicate_exercise','admin_archive_exercise','admin_list_exercises')
    AND (p.prosecdef OR NOT COALESCE(p.proconfig @> ARRAY['search_path=""'],false))),'all editorial RPCs are invoker functions with fixed namespace');
  SET LOCAL ROLE anon;
  PERFORM pg_temp.catalogue_denied('SELECT public.admin_list_exercises()','42501','anon has no RPC EXECUTE');
  PERFORM pg_temp.catalogue_denied('SELECT * FROM public.admin_content_events','42501','anon has no audit SELECT grant');
  RESET ROLE;
END;
$tests$;
SELECT jsonb_build_object('catalogueAssertions',count(*),'result','PASS') FROM pg_temp.catalogue_checks;
ROLLBACK;
