-- Metadata hashes only. No statements, identities, secrets or business rows returned.
-- Executed independently on Staging and Production; never an application migration.
+select version, name, coalesce(array_length(statements,1),0) as statement_count, statements is null as statements_missing, md5(replace(array_to_string(statements,E'\n'),E'\r\n',E'\n')) as lf_joined_md5, md5(btrim(replace(array_to_string(statements,E'\n'),E'\r\n',E'\n'),E' \t\r\n')) as lf_boundary_trimmed_md5 from supabase_migrations.schema_migrations order by version;
