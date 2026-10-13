-- Lot 1A : inventaire de metadonnees exclusivement en lecture.
-- Requete executee sur les deux projets ; aucun appel de fonction applicative.
-- Les corps de fonctions, defaults et triggers sont haches pour eviter un export brut.
-- Comparer les ACL comme ensembles : leur ordre textuel n'indique pas une derive.
-- Ne compare ni les donnees metier ni l'historique SQL des migrations.

select jsonb_build_object(
 'relations', (select jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text)
      order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','S')),
 'columns', (select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default_hash',md5(coalesce(pg_get_expr(d.adbin,d.adrelid),'')),'acl',a.attacl::text)
      order by c.relname,a.attnum)
    from pg_attribute a
    join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
    where n.nspname='public' and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped),
 'constraints', (select jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,'kind',k.contype,'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated)
      order by c.relname,k.conname)
    from pg_constraint k
    join pg_class c on c.oid=k.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'),
 'indexes', (select jsonb_agg(jsonb_build_object('table',t.relname,'name',i.relname,'valid',x.indisvalid,'ready',x.indisready,'hash',md5(pg_get_indexdef(x.indexrelid)))
      order by t.relname,i.relname)
    from pg_index x
    join pg_class t on t.oid=x.indrelid
    join pg_class i on i.oid=x.indexrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'),
 'policies', (select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check)
      order by tablename,policyname)
    from pg_policies
    where schemaname='public'),
 'functions', (select jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'search_path',(select option_value
    from pg_options_to_table(p.proconfig)
    where option_name='search_path'),'body_hash',md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'acl',p.proacl::text)
      order by p.proname,pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p')),
 'triggers', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'function',p.proname,'hash',md5(replace(pg_get_triggerdef(t.oid,true),E'\r\n',E'\n')))
      order by n.nspname,c.relname,t.tgname)
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    join pg_proc p on p.oid=t.tgfoid
    join pg_namespace pn on pn.oid=p.pronamespace
    where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and c.relname='users' and pn.nspname='public'))),
 'effective_grants', (select jsonb_agg(jsonb_build_object('role',r.rolname,'table',c.relname,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'update',has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'),'bypassrls',r.rolbypassrls,'superuser',r.rolsuper)
      order by r.rolname,c.relname)
    from pg_roles r
    cross join pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where r.rolname in ('anon','authenticated','service_role') and n.nspname='public' and c.relkind in ('r','p')),
 'extensions', (select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)
      order by e.extname)
    from pg_extension e
    join pg_namespace n on n.oid=e.extnamespace)
) as audit;
