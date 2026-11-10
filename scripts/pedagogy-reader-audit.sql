-- Effective privileges, evaluated separately as session login and assumed role.
-- Catalog metadata only; no credential, account row or user-selected identifier.
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
)
SELECT jsonb_build_object(
 'accountProjection',(SELECT md5(pg_get_viewdef(c.oid,true))
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='novlearn_admin_read' AND c.relname='accounts' AND c.relkind='v'
     AND pg_get_userbyid(c.relowner)='postgres'
     AND c.reloptions @> ARRAY['security_barrier=true']
     AND NOT c.reloptions @> ARRAY['security_invoker=true']),
 'transactionReadOnly',current_setting('transaction_read_only')='on',
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
 'schemaCreate',EXISTS(SELECT 1 FROM pg_namespace n
   WHERE has_schema_privilege(current_user,n.oid,'CREATE')),
 'ownedObjects',EXISTS(SELECT 1 FROM pg_shdepend d WHERE d.refclassid='pg_authid'::regclass
   AND d.refobjid=me.oid AND d.deptype='o'),
 'tableWrite',EXISTS(SELECT 1 FROM relations c WHERE c.relkind IN ('r','p','v','m','f')
   AND has_schema_privilege(current_user,c.relnamespace,'USAGE')
   AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
       AND has_column_privilege(current_user,c.oid,a.attnum,'INSERT,UPDATE,REFERENCES')))),
 'sequenceAccess',EXISTS(SELECT 1 FROM relations c WHERE c.relkind='S'
   AND has_schema_privilege(current_user,c.relnamespace,'USAGE')
   AND has_sequence_privilege(current_user,c.oid,'SELECT,USAGE,UPDATE')),
 'unexpectedDefinerAccess',EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE p.prosecdef AND n.nspname !~ '^pg_' AND has_schema_privilege(current_user,n.oid,'USAGE')
   AND has_function_privilege(current_user,p.oid,'EXECUTE')
   -- Existing RLS helper: only coalesce(auth.jwt()->'is_anonymous',false),
   -- boolean result, auth.jwt explicitly qualified. Pin the complete reviewed
   -- definitions: isolated copy (empty search_path) and Production (public).
   AND NOT coalesce((p.oid=to_regprocedure('public.is_guest()')
     AND md5(pg_get_functiondef(p.oid)) IN ('12a65aed1e8a67a9de23751a793fd2db',
       '0c5197aaa06e8d8114be6dc2af3a25a0')),false)),
 'largeObjectCreate',EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='pg_catalog' AND p.proname IN ('lo_create','lo_creat','lo_from_bytea','lo_import')
   AND has_function_privilege(current_user,p.oid,'EXECUTE')),
 -- Production requires explicit unfiltered SELECT policies for each readable RLS table.
 -- Missing policies must never silently turn real statistics into zeroes.
 'unrestrictedRead',NOT EXISTS(SELECT 1 FROM relations c
   WHERE c.relkind IN ('r','p') AND c.relrowsecurity
     AND has_schema_privilege(current_user,c.relnamespace,'USAGE')
     AND has_any_column_privilege(current_user,c.oid,'SELECT')
     AND (NOT EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid
       AND p.polpermissive AND p.polcmd='r' AND me.oid=ANY(p.polroles)
       AND pg_get_expr(p.polqual,p.polrelid)='true')
       OR EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid
         AND NOT p.polpermissive AND p.polcmd IN ('r','*')
         AND (0::oid=ANY(p.polroles) OR me.oid=ANY(p.polroles))))),
 'rlsTables',(SELECT count(*)::integer FROM relations c WHERE c.relrowsecurity
   AND ((nspname='auth' AND relname='users') OR (nspname='public'
     AND relname IN ('exercise_attempts','duel_attempts','duels','exercises','chapters','competences'))))
) AS audit FROM me;
