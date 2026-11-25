DO $$
BEGIN
  IF public.novlearn_catalog_is_staging() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Staging catalogue required';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS novlearn_admin_private.exercise_import_receipts (
  actor_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  source_key text NOT NULL,
  definition_hash bytea NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (actor_id, batch_id, source_key)
);

REVOKE ALL ON novlearn_admin_private.exercise_import_receipts
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_import_exercise_draft(
  p_batch_id uuid, p_source_key text, p_definition jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  receipt novlearn_admin_private.exercise_import_receipts;
  fingerprint bytea;
  saved jsonb;
BEGIN
  IF actor IS NULL OR public.novlearn_catalog_is_staging() IS DISTINCT FROM true OR
     public.is_novlearn_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Staging administrator required' USING ERRCODE = '42501';
  END IF;
  IF p_batch_id IS NULL OR p_source_key IS NULL OR
     p_source_key !~ '^[a-zA-Z0-9_-]{1,64}$' OR
     jsonb_typeof(p_definition) IS DISTINCT FROM 'object' OR
     octet_length(p_definition::text) > 262144 THEN
    RAISE EXCEPTION 'Invalid import item' USING ERRCODE = '22023';
  END IF;

  -- Serialize retries of this item and commit its receipt with both draft rows.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor::text || ':' || p_batch_id::text || ':' || p_source_key, 0
  ));
  fingerprint := extensions.digest(
    convert_to((p_definition - 'id' - 'revision')::text, 'UTF8'), 'sha256'
  );
  SELECT * INTO receipt
  FROM novlearn_admin_private.exercise_import_receipts
  WHERE actor_id = actor AND batch_id = p_batch_id AND source_key = p_source_key;
  IF FOUND THEN
    IF receipt.definition_hash IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'Import item already exists with different content' USING ERRCODE = 'PT409';
    END IF;
    RETURN receipt.result || jsonb_build_object('reused', true);
  END IF;

  saved := public.admin_save_exercise_draft(NULL, NULL, NULL, p_definition);
  INSERT INTO novlearn_admin_private.exercise_import_receipts
    (actor_id, batch_id, source_key, definition_hash, result)
  VALUES (actor, p_batch_id, p_source_key, fingerprint, saved);
  RETURN saved || jsonb_build_object('reused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_import_exercise_draft(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_import_exercise_draft(uuid,text,jsonb)
  TO authenticated;
NOTIFY pgrst, 'reload schema';
