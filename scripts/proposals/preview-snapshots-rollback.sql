-- Seulement après arrêt des nouvelles générations et expiration des aperçus.
-- Les aperçus sont éphémères : pas de modification d'exercice ou de tentative.
BEGIN;
DROP FUNCTION public.admin_get_preview_snapshot(uuid,text);
DROP FUNCTION public.admin_put_preview_snapshot(text,bigint,jsonb,text);
DROP TABLE novlearn_admin_private.preview_snapshots;
COMMIT;
