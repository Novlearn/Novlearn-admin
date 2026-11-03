-- Revenir au corps exact observé le 30 octobre ; grants et signature inchangés.
-- Archiver les pilotes et vérifier leurs sélections avant tout retour à l'ancien lecteur.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_random_exercise(p_chapter text DEFAULT NULL,p_difficulty text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE
  exercise_data JSON;
BEGIN
  SELECT row_to_json(e) INTO exercise_data
  FROM public.exercises e
  WHERE (p_chapter IS NULL OR e.chapter = p_chapter)
    AND (p_difficulty IS NULL OR e.difficulty = p_difficulty)
  ORDER BY RANDOM()
  LIMIT 1;

  RETURN exercise_data;
END;
$function$;
COMMIT;
