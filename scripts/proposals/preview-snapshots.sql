-- PROPOSITION MISSION 1. Ne pas appliquer à distance sans autorisation distincte.
-- Aucune définition canonique n'est rendue publique ; auth.uid() reste l'autorité.
BEGIN;
CREATE SCHEMA IF NOT EXISTS novlearn_admin_private;
CREATE TABLE novlearn_admin_private.preview_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,
 digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
 seed bigint NOT NULL CHECK (seed BETWEEN 0 AND 4294967295),
 artifact text NOT NULL CHECK (artifact ~ '^[a-f0-9]{64}$'),
 official jsonb NOT NULL CHECK (jsonb_typeof(official)='object' AND octet_length(official::text)<=524288 AND official->>'schemaVersion'='5'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes'
);
ALTER TABLE novlearn_admin_private.preview_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON novlearn_admin_private.preview_snapshots FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.admin_put_preview_snapshot(p_digest text,p_seed bigint,p_official jsonb,p_artifact text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; item novlearn_admin_private.preview_snapshots;
BEGIN
 IF NOT public.is_novlearn_admin() THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 actor:=auth.uid();
 IF actor IS NULL THEN RAISE EXCEPTION 'session required' USING ERRCODE='42501'; END IF;
 LOCK TABLE novlearn_admin_private.preview_snapshots IN SHARE ROW EXCLUSIVE MODE;
 DELETE FROM novlearn_admin_private.preview_snapshots WHERE expires_at<=clock_timestamp();
 IF (SELECT count(*) FROM novlearn_admin_private.preview_snapshots WHERE owner_id=actor)>=2 THEN
  DELETE FROM novlearn_admin_private.preview_snapshots WHERE id=(SELECT id FROM novlearn_admin_private.preview_snapshots WHERE owner_id=actor ORDER BY created_at,id LIMIT 1);
 END IF;
 IF (SELECT count(*) FROM novlearn_admin_private.preview_snapshots)>=32 THEN RAISE EXCEPTION 'preview capacity' USING ERRCODE='P0001'; END IF;
 INSERT INTO novlearn_admin_private.preview_snapshots(owner_id,digest,seed,official,artifact)
 VALUES(actor,p_digest,p_seed,p_official,p_artifact) RETURNING * INTO item;
 RETURN jsonb_build_object('previewId',item.id,'owner',item.owner_id,'digest',item.digest,'seed',item.seed,'artifact',item.artifact,'official',item.official,'expiresAt',floor(extract(epoch from item.expires_at)*1000)::bigint);
END $$;
CREATE FUNCTION public.admin_get_preview_snapshot(p_id uuid,p_artifact text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item novlearn_admin_private.preview_snapshots;
BEGIN
 IF NOT public.is_novlearn_admin() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM novlearn_admin_private.preview_snapshots WHERE id=p_id AND owner_id=auth.uid() AND expires_at>clock_timestamp() AND artifact=p_artifact;
 IF NOT FOUND THEN RAISE EXCEPTION 'preview unavailable' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('previewId',item.id,'owner',item.owner_id,'digest',item.digest,'seed',item.seed,'artifact',item.artifact,'official',item.official,'expiresAt',floor(extract(epoch from item.expires_at)*1000)::bigint);
END $$;
REVOKE ALL ON FUNCTION public.admin_put_preview_snapshot(text,bigint,jsonb,text),public.admin_get_preview_snapshot(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_put_preview_snapshot(text,bigint,jsonb,text),public.admin_get_preview_snapshot(uuid,text) TO authenticated;
COMMIT;
