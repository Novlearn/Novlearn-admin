-- Physical login/capability metadata only. The fixed reader's applicable SELECT
-- policies must remain exactly the two reviewed unconditional policies; an
-- unexpected restrictive filter must yield unavailable, never false absence.
WITH me AS (SELECT * FROM pg_roles WHERE rolname=current_user),
relations AS (
 SELECT c.*,n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
), columns_read AS (
 SELECT nspname||'.'||relname||'.'||a.attname AS name
 FROM relations c JOIN pg_attribute a ON a.attrelid=c.oid
 WHERE c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped
 AND has_schema_privilege(current_user,c.relnamespace,'USAGE')
 AND has_column_privilege(current_user,c.oid,a.attnum,'SELECT')
), applicable_policies AS (
 SELECT p.* FROM pg_policy p
 WHERE p.polrelid IN ('public.exercises'::regclass,'public.exercise_versions'::regclass)
 AND p.polcmd IN ('r','*') AND (0=ANY(p.polroles) OR 'novlearn_active_version_reader'::regrole=ANY(p.polroles))
)
SELECT jsonb_build_object(
 'login',session_user,'role',current_user,'database',current_database(),
 'flags',jsonb_build_object('login',me.rolcanlogin,'inherit',me.rolinherit,
   'super',me.rolsuper,'createdb',me.rolcreatedb,'createrole',me.rolcreaterole,
   'replication',me.rolreplication,'bypassrls',me.rolbypassrls),
 'memberships',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'role',pg_get_userbyid(m.roleid),'admin',m.admin_option,
   'inherit',m.inherit_option,'set',m.set_option) ORDER BY m.roleid)
   FROM pg_auth_members m WHERE m.member=me.oid),'[]'::jsonb),
 'columns',coalesce((SELECT jsonb_agg(name ORDER BY name) FROM columns_read),'[]'::jsonb),
 'databaseCreate',has_database_privilege(current_user,current_database(),'CREATE'),
 'temporary',has_database_privilege(current_user,current_database(),'TEMPORARY'),
 'schemaCreate',EXISTS(SELECT 1 FROM pg_namespace n WHERE has_schema_privilege(current_user,n.oid,'CREATE')),
 'ownedObjects',EXISTS(SELECT 1 FROM pg_shdepend d WHERE d.refclassid='pg_authid'::regclass
   AND d.refobjid=me.oid AND d.deptype='o'),
 'tableWrite',EXISTS(SELECT 1 FROM relations c WHERE c.relkind IN ('r','p','v','m','f')
   AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
       AND has_column_privilege(current_user,c.oid,a.attnum,'INSERT,UPDATE,REFERENCES')))),
 'sequenceAccess',EXISTS(SELECT 1 FROM relations c WHERE c.relkind='S'
   AND has_sequence_privilege(current_user,c.oid,'SELECT,USAGE,UPDATE')),
 'unexpectedDefinerAccess',EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE p.prosecdef AND n.nspname !~ '^pg_' AND has_schema_privilege(current_user,n.oid,'USAGE')
   AND has_function_privilege(current_user,p.oid,'EXECUTE')
   AND NOT(p.oid='public.is_guest()'::regprocedure AND md5(pg_get_functiondef(p.oid))='12a65aed1e8a67a9de23751a793fd2db')),
 'largeObjectCreate',EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='pg_catalog' AND p.proname IN ('lo_create','lo_creat','lo_from_bytea','lo_import')
   AND has_function_privilege(current_user,p.oid,'EXECUTE')),
 'rlsTables',(SELECT count(*)::integer FROM relations WHERE relrowsecurity AND nspname='public'
   AND relname IN ('exercises','exercise_versions')),
 'policyScopeVerified',(SELECT count(*)=2 AND bool_and(polcmd='r' AND polpermissive
    AND polroles=ARRAY['novlearn_active_version_reader'::regrole::oid]
    AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL
    AND ((polrelid='public.exercises'::regclass AND polname='novlearn_active_version_read_exercises') OR
      (polrelid='public.exercise_versions'::regclass AND polname='novlearn_active_version_read_versions')))
    FROM applicable_policies)
) AS audit FROM me;
