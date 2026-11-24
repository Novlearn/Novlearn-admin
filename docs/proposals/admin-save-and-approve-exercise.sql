-- Proposition Staging pour le dépôt canonique NovLearn.
-- Rétablit les transitions source du contrat 20261112102327, écrasées par
-- 20261112123000, et conserve les contrôles d’insertion de cette dernière.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF NOT public.novlearn_catalog_is_staging() THEN
    RAISE EXCEPTION 'This migration is for the Staging source only';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_exercise_version()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
DECLARE content_changed boolean:=false; ready_changed boolean:=false;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.editorial_status='published' THEN RAISE EXCEPTION 'published exercise versions are immutable'; END IF;
    RETURN OLD;
  END IF;
  -- Historical execution occupies revision zero, outside source numbering.
  -- Only the reviewed operator preparation can create it; never the importer.
  IF TG_OP='INSERT' AND NEW.publication_origin='historical' THEN
    IF current_user<>'postgres' OR NEW.revision<>0 OR NEW.editorial_status<>'published' THEN
      RAISE EXCEPTION 'historical execution requires operator preparation' USING ERRCODE='42501';
    END IF;
    NEW.definition_sha256:=encode(extensions.digest(convert_to(NEW.definition::text,'UTF8'),'sha256'),'hex');
    NEW.approval_fingerprint_sha256:=NEW.definition_sha256;
    RETURN NEW;
  END IF;
  IF TG_OP='INSERT' AND NEW.publication_origin='transfer' THEN
    IF current_user NOT IN ('novlearn_publication_writer','novlearn_catalogue_sync_writer') OR NEW.editorial_status<>'published' OR
      NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.approved_fingerprint_sha256 IS NOT NULL OR
      NEW.created_by IS NOT NULL OR NEW.updated_by IS NOT NULL THEN
      RAISE EXCEPTION 'transfer insertion requires the bounded publication capability' USING ERRCODE='42501';
    END IF;
    NEW.definition_sha256:=encode(extensions.digest(convert_to(NEW.definition::text,'UTF8'),'sha256'),'hex');
    NEW.approval_fingerprint_sha256:=encode(extensions.digest(convert_to(jsonb_build_object('exercise_id',NEW.exercise_id,'revision',NEW.revision,
      'definition',NEW.definition,'engine_contract',NEW.engine_contract,'generation_version',NEW.generation_version,
      'canonicalization_version',NEW.canonicalization_version)::text,'UTF8'),'sha256'),'hex');
    NEW.published_at:=clock_timestamp();NEW.updated_at:=clock_timestamp();RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND NEW.publication_origin IS DISTINCT FROM OLD.publication_origin THEN RAISE EXCEPTION 'publication origin is immutable' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.editorial_status='published' THEN RAISE EXCEPTION 'published exercise versions are immutable'; END IF;
    content_changed:=NEW.exercise_id IS DISTINCT FROM OLD.exercise_id OR NEW.revision IS DISTINCT FROM OLD.revision OR NEW.definition IS DISTINCT FROM OLD.definition OR
      NEW.engine_contract IS DISTINCT FROM OLD.engine_contract OR NEW.generation_version IS DISTINCT FROM OLD.generation_version OR NEW.canonicalization_version IS DISTINCT FROM OLD.canonicalization_version;
    ready_changed:=NEW.ready_at IS DISTINCT FROM OLD.ready_at OR NEW.ready_by IS DISTINCT FROM OLD.ready_by OR
      NEW.ready_fingerprint_sha256 IS DISTINCT FROM OLD.ready_fingerprint_sha256;
    IF content_changed AND OLD.editorial_status='ready' THEN NEW.editorial_status:='draft'; END IF;
    IF NEW.editorial_status='ready' AND (OLD.editorial_status<>'ready' OR ready_changed) AND
       current_setting('novlearn_catalog_sync.ready_version',true) IS DISTINCT FROM NEW.id::text THEN
      RAISE EXCEPTION 'use the protected readiness transition';
    END IF;
    -- The existing source receipt finalizer is SECURITY DEFINER, owned by postgres.
    IF NEW.editorial_status='published' AND
       (current_user<>'postgres' OR OLD.editorial_status<>'ready' OR content_changed OR ready_changed) THEN
      RAISE EXCEPTION 'only unchanged ready revisions can be published';
    END IF;
  ELSIF NEW.editorial_status<>'draft' THEN RAISE EXCEPTION 'insert a draft before review, approval, or publication';
  END IF;
  NEW.definition_sha256:=encode(extensions.digest(convert_to(NEW.definition::text,'UTF8'),'sha256'),'hex');
  NEW.approval_fingerprint_sha256:=encode(extensions.digest(convert_to(jsonb_build_object('exercise_id',NEW.exercise_id,'revision',NEW.revision,
    'definition',NEW.definition,'engine_contract',NEW.engine_contract,'generation_version',NEW.generation_version,
    'canonicalization_version',NEW.canonicalization_version)::text,'UTF8'),'sha256'),'hex');
  IF NEW.editorial_status='ready' THEN
    IF NEW.ready_at IS NULL OR NEW.ready_by IS NULL THEN
      RAISE EXCEPTION 'readiness metadata is required';
    END IF;
    NEW.ready_fingerprint_sha256:=NEW.approval_fingerprint_sha256;
  ELSIF NEW.editorial_status='published' THEN
    IF NEW.ready_at IS NULL OR NEW.ready_by IS NULL OR
       NEW.ready_fingerprint_sha256 IS DISTINCT FROM NEW.approval_fingerprint_sha256 THEN
      RAISE EXCEPTION 'published source must retain its readiness proof';
    END IF;
    NEW.published_at:=coalesce(NEW.published_at,now());
  ELSE
    NEW.ready_at:=NULL;NEW.ready_by:=NULL;NEW.ready_fingerprint_sha256:=NULL;
  END IF;
  NEW.updated_at:=now();RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.manage_exercise_version() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_save_and_approve_exercise(
  p_exercise_id bigint,
  p_version_id uuid,
  p_expected_fingerprint text,
  p_definition jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  saved jsonb;
  saved_version_id uuid;
  saved_fingerprint text;
BEGIN
  IF public.novlearn_catalog_is_staging() IS DISTINCT FROM true OR
     public.is_novlearn_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Staging administrator access required' USING ERRCODE='42501';
  END IF;
  saved := public.admin_save_exercise_draft(
    p_exercise_id, p_version_id, p_expected_fingerprint, p_definition
  );
  saved_version_id := (saved->>'versionId')::uuid;
  saved_fingerprint := saved->>'fingerprint';

  PERFORM public.admin_set_exercise_version_ready(saved_version_id, saved_fingerprint);

  IF NOT EXISTS (
    SELECT 1 FROM public.exercise_versions
    WHERE id = saved_version_id AND editorial_status = 'ready'
      AND approval_fingerprint_sha256 = saved_fingerprint
      AND ready_fingerprint_sha256 = saved_fingerprint
  ) THEN
    RAISE EXCEPTION 'readiness could not be confirmed' USING ERRCODE='PT409';
  END IF;

  RETURN saved || jsonb_build_object('status', 'ready');
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_save_and_approve_exercise(bigint,uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_and_approve_exercise(bigint,uuid,text,jsonb)
  TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
