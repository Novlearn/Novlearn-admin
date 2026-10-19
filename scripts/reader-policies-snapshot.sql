-- Owner-only fixture snapshot. The driver supplies the row-hash helper and
-- wraps this file in BEGIN/ROLLBACK; no passwords or row values are returned.
SET LOCAL search_path=pg_catalog;
CREATE FUNCTION pg_temp.reader_policy_sequences() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE item record; result jsonb:='{}'; state jsonb;
BEGIN
  FOR item IN SELECT schemaname,sequencename FROM pg_sequences
    WHERE schemaname IN ('public','auth','novlearn_admin_private') ORDER BY 1,2 LOOP
    EXECUTE format('SELECT jsonb_build_object(''last_value'',last_value,''is_called'',is_called) FROM %I.%I',
      item.schemaname,item.sequencename) INTO state;
    result:=result||jsonb_build_object(item.schemaname||'.'||item.sequencename,state);
  END LOOP;
  RETURN result;
END; $$;
SELECT jsonb_build_object(
  'rows',pg_temp.detail_seed_rows(),
  'sequences',pg_temp.reader_policy_sequences(),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname)
    FROM pg_policies p WHERE schemaname IN ('public','auth','novlearn_admin_private')),
  'metadata',jsonb_build_object(
    'relations',(SELECT jsonb_agg(to_jsonb(r) ORDER BY schema,name) FROM
      (SELECT n.nspname AS schema,c.relname AS name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
        pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('public','auth','novlearn_admin_private') AND c.relkind IN ('r','p','S','v','m')) r),
    'columns',(SELECT jsonb_agg(to_jsonb(r) ORDER BY schema,table_name,attnum) FROM
      (SELECT n.nspname AS schema,c.relname AS table_name,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS type,
        a.attnotnull,a.attidentity,a.attgenerated,a.attacl::text AS acl,pg_get_expr(d.adbin,d.adrelid) AS default_value
       FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
       WHERE n.nspname IN ('public','auth','novlearn_admin_private') AND c.relkind IN ('r','p','v','m')
         AND a.attnum>0 AND NOT a.attisdropped) r),
    'functions',(SELECT jsonb_agg(to_jsonb(r) ORDER BY signature) FROM
      (SELECT p.oid::regprocedure::text AS signature,pg_get_functiondef(p.oid) AS definition,
        pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname IN ('public','auth','novlearn_admin_private') AND p.prokind='f') r),
    'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY rolname) FROM
      (SELECT r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,
        r.rolreplication,r.rolbypassrls,r.rolconnlimit,r.rolvaliduntil,r.rolconfig,
        md5(a.rolpassword) AS password_digest FROM pg_roles r JOIN pg_authid a ON a.oid=r.oid) r),
    'memberships',(SELECT jsonb_agg(to_jsonb(r) ORDER BY role,member,grantor) FROM
      (SELECT pg_get_userbyid(roleid) AS role,pg_get_userbyid(member) AS member,
        pg_get_userbyid(grantor) AS grantor,admin_option,inherit_option,set_option FROM pg_auth_members) r),
    'schemas',(SELECT jsonb_agg(to_jsonb(r) ORDER BY name) FROM
      (SELECT nspname AS name,pg_get_userbyid(nspowner) AS owner,nspacl::text AS acl FROM pg_namespace
       WHERE nspname IN ('public','auth','extensions','novlearn_admin_private')) r),
    'database',(SELECT jsonb_build_object('name',datname,'owner',pg_get_userbyid(datdba),'acl',datacl::text,
      'connections',datallowconn,'limit',datconnlimit) FROM pg_database WHERE datname=current_database()),
    'settings',(SELECT jsonb_agg(jsonb_build_object('database',coalesce(d.datname,'ALL'),
      'role',coalesce(r.rolname,'ALL'),'config',s.setconfig) ORDER BY s.setdatabase,s.setrole)
      FROM pg_db_role_setting s LEFT JOIN pg_database d ON d.oid=s.setdatabase LEFT JOIN pg_roles r ON r.oid=s.setrole),
    'constraints',(SELECT jsonb_agg(to_jsonb(r) ORDER BY table_name,name) FROM
      (SELECT c.oid::regclass::text AS table_name,k.conname AS name,pg_get_constraintdef(k.oid) AS definition
       FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('public','auth','novlearn_admin_private')) r),
    'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY schemaname,tablename,indexname) FROM pg_indexes i
      WHERE schemaname IN ('public','auth','novlearn_admin_private')),
    'triggers',(SELECT jsonb_agg(to_jsonb(r) ORDER BY table_name,name) FROM
      (SELECT c.oid::regclass::text AS table_name,t.tgname AS name,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
       FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('public','auth','novlearn_admin_private') AND NOT t.tgisinternal) r),
    'defaults',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(d.defaclrole),'schema',n.nspname,
      'type',d.defaclobjtype,'acl',d.defaclacl::text) ORDER BY d.defaclrole,n.nspname,d.defaclobjtype)
      FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace)
  )
);
