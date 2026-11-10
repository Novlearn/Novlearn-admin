-- Approved by the user on 8 November 2026: production statistics/users READ ONLY.
-- Target: novlearn-prod / abwipnppcrghdhwriyjp. Apply as a transactional remote migration.
-- No business rows, passwords, Auth settings or exercise content are modified.
-- Logins stay NOLOGIN until privately provisioned; no credential belongs in migration history.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $access$
DECLARE
  expected_md5 text;
  f record;
  existing_role record;
  spec jsonb;
  rel record;
  policy record;
  source_schema text;
  source_table text;
  column_list text;
  specs constant jsonb := '[{"name":"activity","login":"novlearn_admin_activity_service","role":"novlearn_activity_reader","relations":{"novlearn_admin_read.accounts":["id","created_at","is_anonymous"],"public.exercise_attempts":["user_id","attempted_at","is_correct","is_abandoned"],"public.duel_attempts":["duel_id","player_id","submitted_at"],"public.duels":["id","player1_id","player2_id","status","finished_at"]}},{"name":"users","login":"novlearn_admin_users_service","role":"novlearn_users_reader","relations":{"novlearn_admin_read.accounts":["id","email","is_anonymous"],"public.profiles":["id","first_name","last_name"],"public.exercise_attempts":["user_id","attempted_at"],"public.duel_attempts":["duel_id","player_id","submitted_at"],"public.duels":["id","player1_id","player2_id"]}},{"name":"user-detail","login":"novlearn_admin_user_detail_service","role":"novlearn_user_detail_reader","relations":{"novlearn_admin_read.accounts":["email","id","is_anonymous"],"public.chapters":["id","name"],"public.competences":["chapter_id","id","max_points","name"],"public.duel_attempts":["duel_id","id","is_correct","player_id","submitted_at"],"public.duels":["exercise_id","id","player1_id","player2_id"],"public.exercise_attempts":["attempted_at","exercise_id","id","is_abandoned","is_correct","user_id"],"public.exercises":["app_title","id","title"],"public.profiles":["first_name","id","last_name"],"public.user_competence_scores":["competence_id","points","updated_at","user_id"],"public.user_progress":["chapter","exercises_completed","id","last_activity","level","user_id"]}},{"name":"pedagogy","login":"novlearn_admin_pedagogy_service","role":"novlearn_pedagogy_reader","relations":{"novlearn_admin_read.accounts":["id"],"public.exercise_attempts":["id","exercise_id","user_id","attempted_at","is_correct","is_abandoned"],"public.duel_attempts":["id","duel_id","player_id","submitted_at","is_correct"],"public.duels":["id","exercise_id","player1_id","player2_id","status","finished_at"],"public.exercises":["id","title","app_title","chapter","difficulty","competences","Is_Flash"],"public.chapters":["id","name","aliases"],"public.competences":["id","name","chapter_id"]}}]'::jsonb;
  definitions constant jsonb := '[{"signature":"public.admin_get_profile(uuid)","md5":"48355e8b123d1f4f6668fb46cd590ea4"},{"signature":"public.award_weekly_top3()","md5":"1a49f3f09b286bfc263f1e513903f2be"},{"signature":"public.create_friend_code_for_new_user()","md5":"b255e4f6429a24a4cf2354a66d07607e"},{"signature":"public.feedbacks_nullify_missing_profile()","md5":"e4c3f48b60184d7b0555b199cd7fdf53"},{"signature":"public.find_user_by_friend_code(text)","md5":"82f1e20283f9aa8889d6a5996721affe"},{"signature":"public.generate_random_code(integer)","md5":"909b0afcacedcf485418176c9388bd2a"},{"signature":"public.get_chapters_with_count(uuid)","md5":"d8e84685973d3fe7b190c2921ad75f10"},{"signature":"public.get_friends_and_requests(uuid)","md5":"fc379d285dab722a5d8092aabc13d6e1"},{"signature":"public.get_monthly_leaderboard(timestamp with time zone,integer,text)","md5":"9f276e44efe7e40e440f8872f98c917f"},{"signature":"public.get_my_role()","md5":"696cc719ac92bb502bfa5fec8690005d"},{"signature":"public.get_public_profile(uuid)","md5":"bdc176996488539adab4389785e8a702"},{"signature":"public.get_random_exercise(text,text)","md5":"d48884e53b7f1187d8dd8ec983434320"},{"signature":"public.get_success_rate_leaderboard(timestamp with time zone,integer,integer)","md5":"329b217c714e48937bd0d8f42033c479"},{"signature":"public.get_weekly_leaderboard(timestamp with time zone,integer,text)","md5":"6771b7ab4b2ed8a2f8160289735d22a5"},{"signature":"public.handle_exercise_completion()","md5":"eb0c2e9ecdd108693137a874d99365eb"},{"signature":"public.handle_friend_request_acceptance()","md5":"2a2a5bb43af716fb9d348e9c6b3aeed0"},{"signature":"public.handle_new_user()","md5":"c26382ec7c8bf22795afe93430377dd3"},{"signature":"public.handle_updated_at()","md5":"9550931156286d9e37542104616996c5"},{"signature":"public.is_guest()","md5":"0c5197aaa06e8d8114be6dc2af3a25a0"},{"signature":"public.update_user_stats_on_attempt()","md5":"8236d2bb24e6dcac2b562d2b01bce000"}]'::jsonb;
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' THEN
    RAISE EXCEPTION 'Wrong production database or migration identity';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(specs) s JOIN pg_roles r
    ON r.rolname IN (s->>'login',s->>'role')) OR
    EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='novlearn_admin_read') THEN
    RAISE EXCEPTION 'Read access already exists; inspect instead of replaying';
  END IF;
  SELECT md5(coalesce(string_agg(p.oid::text||':'||p.polname||':'||p.polcmd::text||':'||p.polpermissive::text||':'||p.polroles::text||':'||coalesce(p.polqual::text,'')||':'||coalesce(p.polwithcheck::text,''),'|' ORDER BY p.oid),'')) AS policy_md5 INTO expected_md5 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('chapters','competences','duel_attempts','duels','exercise_attempts','exercises','profiles','user_competence_scores','user_progress');
  IF expected_md5<>'39297cb9c315c38b2ffc979e8eac7bbd' THEN
    RAISE EXCEPTION 'Site policies changed since the reviewed baseline';
  END IF;
  FOR spec IN SELECT value FROM jsonb_array_elements(definitions) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(spec->>'signature')
      AND pg_get_userbyid(p.proowner)='postgres'
      AND md5(pg_get_functiondef(p.oid))=spec->>'md5') THEN
      RAISE EXCEPTION 'Application function changed: %',spec->>'signature';
    END IF;
  END LOOP;

  -- Preserve effective EXECUTE for EVERY existing SQL role before removing PUBLIC.
  -- Only the new readers/logins, created afterwards, lose these inherited capabilities.
  -- Function bodies and existing explicit/grantable privileges remain untouched.
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.oid<>to_regprocedure('public.is_guest()')
      AND EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
  LOOP
    FOR existing_role IN SELECT rolname FROM pg_roles LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I',f.signature,existing_role.rolname);
    END LOOP;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',f.signature);
  END LOOP;

  CREATE SCHEMA novlearn_admin_read AUTHORIZATION postgres;
  REVOKE ALL ON SCHEMA novlearn_admin_read FROM PUBLIC,anon,authenticated,service_role;
  -- Auth is managed by Supabase. This private owner-controlled projection is intentional:
  -- the view never exposes secrets, is not in the Data API schemas, and has column ACLs.
  CREATE VIEW novlearn_admin_read.accounts WITH (security_barrier=true) AS
    SELECT id,email,created_at,is_anonymous FROM auth.users;
  REVOKE ALL ON novlearn_admin_read.accounts FROM PUBLIC,anon,authenticated,service_role;

  -- Site policies remain site policies, including the existing classic admin checks.
  -- Their predicates and permissive/restrictive modes are not changed.
  FOR policy IN SELECT p.polname,n.nspname,c.relname FROM pg_policy p
    JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND 0::oid=ANY(p.polroles)
      AND c.relname IN ('chapters','competences','duel_attempts','duels','exercise_attempts',
        'exercises','profiles','user_competence_scores','user_progress')
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO anon, authenticated',policy.polname,policy.nspname,policy.relname);
  END LOOP;

  FOR spec IN SELECT value FROM jsonb_array_elements(specs) LOOP
    EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',spec->>'role');
    EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2',spec->>'login');
    EXECUTE format('ALTER ROLE %I SET default_transaction_read_only=on',spec->>'login');
    EXECUTE format('ALTER ROLE %I SET statement_timeout=%L',spec->>'login','10s');
    EXECUTE format('ALTER ROLE %I SET lock_timeout=%L',spec->>'login','3s');
    EXECUTE format('ALTER ROLE %I SET idle_in_transaction_session_timeout=%L',spec->>'login','15s');
    EXECUTE format('GRANT CONNECT ON DATABASE postgres TO %I',spec->>'login');
    EXECUTE format('GRANT %I TO %I WITH ADMIN FALSE, INHERIT FALSE, SET TRUE',spec->>'role',spec->>'login');
    EXECUTE format('GRANT USAGE ON SCHEMA public,novlearn_admin_read TO %I',spec->>'role');
    FOR rel IN SELECT * FROM jsonb_each(spec->'relations') LOOP
      source_schema:=split_part(rel.key,'.',1);
      source_table:=split_part(rel.key,'.',2);
      SELECT string_agg(quote_ident(value),',') INTO column_list FROM jsonb_array_elements_text(rel.value);
      EXECUTE format('GRANT SELECT (%s) ON %I.%I TO %I',column_list,source_schema,source_table,spec->>'role');
      IF source_schema='public' THEN
        EXECUTE format('CREATE POLICY %I ON %I.%I FOR SELECT TO %I USING (true)',
          'novlearn_admin_'||replace(spec->>'name','-','_')||'_read',source_schema,source_table,spec->>'role');
      END IF;
    END LOOP;
  END LOOP;
END
$access$;
