-- Fixed detail query: user UUID, inclusive UTC start, exclusive UTC end,
-- view, after key, before key, trusted page size. No definitions or answers.
WITH bounds AS MATERIALIZED (
 SELECT $1::uuid AS user_id,$2::date AS first_day,$3::date AS until_day,
   $4::text AS view,$5::text AS after_key,$6::text AS before_key,$7::integer AS page_size,
   statement_timestamp() AS as_of,
   U&'\0009\000a\000b\000c\000d\0020\00a0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200a\2028\2029\202f\205f\3000\feff'::text AS whitespace
 WHERE $1::uuid IS NOT NULL AND $2::date>=date '2000-01-01'
   AND $3::date<=date '2200-01-01' AND $3::date-$2::date BETWEEN 1 AND 90
   AND $3::date<=(statement_timestamp() AT TIME ZONE 'UTC')::date+1
   AND $4::text IN ('history','chapters','competences')
   AND NOT ($5::text IS NOT NULL AND $6::text IS NOT NULL)
   AND coalesce(char_length($5::text),0)<=1000 AND coalesce(char_length($6::text),0)<=1000
   AND $7::integer BETWEEN 1 AND 25
), identity AS MATERIALIZED (
 SELECT a.id,a.is_anonymous,
   CASE WHEN a.is_anonymous THEN 'Compte invité' ELSE
     coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(p.first_name),''),nullif(btrim(p.last_name),'')),b.whitespace),''),'Nom non renseigné') END AS name,
   CASE WHEN a.is_anonymous THEN NULL ELSE a.email END AS email
 FROM auth.users a CROSS JOIN bounds b LEFT JOIN public.profiles p ON p.id=a.id
 WHERE a.id=b.user_id
), exercise_activity AS MATERIALIZED (
 SELECT a.* FROM (
   SELECT x.id,x.user_id,x.exercise_id,x.is_correct,x.is_abandoned,x.attempted_at,x.exercise_version_id
   FROM public.exercise_attempts x CROSS JOIN bounds b WHERE x.user_id=b.user_id
     AND x.attempted_at>=(b.first_day::timestamp AT TIME ZONE 'UTC')
     AND x.attempted_at<(b.until_day::timestamp AT TIME ZONE 'UTC') AND x.attempted_at<=b.as_of
 ) a
), duel_activity AS MATERIALIZED (
 SELECT a.id,a.duel_id,a.is_correct,a.submitted_at FROM public.duel_attempts a CROSS JOIN bounds b
 WHERE a.player_id=b.user_id AND a.submitted_at>=(b.first_day::timestamp AT TIME ZONE 'UTC')
   AND a.submitted_at<(b.until_day::timestamp AT TIME ZONE 'UTC') AND a.submitted_at<=b.as_of
), activity AS (
 SELECT jsonb_build_object(
   'exerciseAttempts',(SELECT count(*)::text FROM exercise_activity),
   'exerciseCorrect',(SELECT count(*)::text FROM exercise_activity WHERE is_correct AND NOT is_abandoned),
   'exerciseIncorrect',(SELECT count(*)::text FROM exercise_activity WHERE NOT is_correct AND NOT is_abandoned),
   'exerciseAbandoned',(SELECT count(*)::text FROM exercise_activity WHERE is_abandoned),
   'duelAttempts',(SELECT count(*)::text FROM duel_activity),
   'duelCorrect',(SELECT count(*)::text FROM duel_activity WHERE is_correct),
   'duelIncorrect',(SELECT count(*)::text FROM duel_activity WHERE NOT is_correct),
   'undatedExerciseAttempts',(SELECT count(*)::text FROM public.exercise_attempts x CROSS JOIN bounds b WHERE x.user_id=b.user_id AND x.attempted_at IS NULL),
   'undatedDuelAttempts',(SELECT count(*)::text FROM public.duel_attempts x CROSS JOIN bounds b WHERE x.player_id=b.user_id AND x.submitted_at IS NULL),
   'lastActivity',to_char(greatest((SELECT max(attempted_at) FROM exercise_activity),(SELECT max(submitted_at) FROM duel_activity)) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
 ) AS value
), history_raw AS (
 SELECT 'exercise'::text AS kind,e.id,e.attempted_at AS occurred_at,e.exercise_id,
   CASE WHEN e.is_abandoned THEN 'abandoned' WHEN e.is_correct THEN 'correct' ELSE 'incorrect' END AS outcome,
   NULL::bigint AS duel_id,e.exercise_version_id AS version_id
 FROM exercise_activity e CROSS JOIN bounds b WHERE b.view='history'
 UNION ALL
 SELECT 'duel',d.id,d.submitted_at,u.exercise_id,CASE WHEN d.is_correct THEN 'correct' ELSE 'incorrect' END,
   d.duel_id,NULL::uuid
 FROM duel_activity d JOIN public.duels u ON u.id=d.duel_id CROSS JOIN bounds b WHERE b.view='history'
), rows AS MATERIALIZED (
 SELECT (to_char(h.occurred_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISSUS')||':'||lpad(h.id::text,19,'0')||':'||h.kind) COLLATE "C" AS key,
   jsonb_build_object('kind',h.kind,'id',h.id::text,
     'occurredAt',to_char(h.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
     'exerciseId',h.exercise_id::text,'currentTitle',left(t.title,200)||CASE WHEN char_length(t.title)>200 THEN '…' ELSE '' END,
     'titleTruncated',coalesce(char_length(t.title)>200,false),'duelId',h.duel_id::text,
     'versionId',h.version_id::text,'outcome',h.outcome) AS value
 FROM history_raw h CROSS JOIN bounds b LEFT JOIN public.exercises e ON e.id=h.exercise_id
 CROSS JOIN LATERAL (SELECT coalesce(nullif(btrim(e.app_title,b.whitespace),''),nullif(btrim(e.title,b.whitespace),'')) AS title) t
 UNION ALL
 SELECT lpad(p.id::text,19,'0') COLLATE "C",jsonb_build_object(
   'kind','chapter','id',p.id::text,'label',left(t.label,200)||CASE WHEN char_length(t.label)>200 THEN '…' ELSE '' END,
   'labelTruncated',char_length(t.label)>200,'level',p.level,
   'completed',CASE WHEN p.exercises_completed>=0 THEN p.exercises_completed::text END,
   'recordedAt',to_char(p.last_activity AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'issues',to_jsonb(array_remove(ARRAY[
     CASE WHEN p.level IS NULL THEN 'missing-level' END,
     CASE WHEN p.exercises_completed IS NULL THEN 'missing-count' WHEN p.exercises_completed<0 THEN 'invalid-count' END,
     CASE WHEN p.last_activity IS NULL THEN 'missing-date' WHEN p.last_activity>b.as_of THEN 'future-date' END
   ]::text[],NULL)))
 FROM public.user_progress p CROSS JOIN bounds b
 CROSS JOIN LATERAL (SELECT coalesce(nullif(btrim(p.chapter,b.whitespace),''),'Chapitre non renseigné') AS label) t
 WHERE b.view='chapters' AND p.user_id=b.user_id
 UNION ALL
 SELECT s.competence_id COLLATE "C",jsonb_build_object(
   'kind','competence','id',s.competence_id,
   'label',left(t.label,200)||CASE WHEN char_length(t.label)>200 THEN '…' ELSE '' END,
   'labelTruncated',char_length(t.label)>200,
   'chapterName',left(t.chapter,200)||CASE WHEN char_length(t.chapter)>200 THEN '…' ELSE '' END,
   'chapterNameTruncated',coalesce(char_length(t.chapter)>200,false),'points',s.points::text,'maximum',c.max_points::text,
   'recordedAt',to_char(s.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'issues',to_jsonb(array_remove(ARRAY[
     CASE WHEN c.id IS NULL THEN 'unknown-competence' WHEN s.points>c.max_points THEN 'points-above-current-maximum' END,
     CASE WHEN s.updated_at IS NULL THEN 'missing-date' WHEN s.updated_at>b.as_of THEN 'future-date' END
   ]::text[],NULL)))
 FROM public.user_competence_scores s CROSS JOIN bounds b
 LEFT JOIN public.competences c ON c.id=s.competence_id LEFT JOIN public.chapters ch ON ch.id=c.chapter_id
 CROSS JOIN LATERAL (SELECT coalesce(nullif(btrim(c.name,b.whitespace),''),nullif(btrim(s.competence_id,b.whitespace),''),'Compétence non renseignée') AS label,
   CASE WHEN ch.id IS NOT NULL THEN coalesce(nullif(btrim(ch.name,b.whitespace),''),'Chapitre sans nom') END AS chapter) t
 WHERE b.view='competences' AND s.user_id=b.user_id
), selected AS MATERIALIZED (
 SELECT r.* FROM rows r CROSS JOIN bounds b
 WHERE (b.after_key IS NULL OR CASE WHEN b.view='history' THEN r.key<b.after_key COLLATE "C" ELSE r.key>b.after_key COLLATE "C" END)
   AND (b.before_key IS NULL OR CASE WHEN b.view='history' THEN r.key>b.before_key COLLATE "C" ELSE r.key<b.before_key COLLATE "C" END)
 ORDER BY CASE WHEN ($4::text='history')=($6::text IS NULL) THEN r.key END DESC,
   CASE WHEN ($4::text='history')<>($6::text IS NULL) THEN r.key END ASC LIMIT $7::integer
), ordered AS (
 SELECT s.*,row_number() OVER (ORDER BY CASE WHEN $4::text='history' THEN key END DESC,
   CASE WHEN $4::text<>'history' THEN key END ASC) AS position FROM selected s
), envelope AS (
 SELECT b.*,jsonb_build_object('schemaVersion',1,'asOf',to_char(b.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'userId',b.user_id::text,'period',jsonb_build_object('from',b.first_day::text,'until',b.until_day::text),
   'view',b.view,'cursor',jsonb_build_object('after',b.after_key,'before',b.before_key)) AS value FROM bounds b
)
SELECT b.value || CASE WHEN u.id IS NULL THEN jsonb_build_object('found',false) ELSE jsonb_build_object(
 'found',true,'user',jsonb_build_object('id',u.id::text,
   'name',left(u.name,200)||CASE WHEN char_length(u.name)>200 THEN '…' ELSE '' END,
   'nameTruncated',char_length(u.name)>200,'email',u.email,'anonymous',u.is_anonymous),
 'activity',a.value,'page',jsonb_build_object('size',b.page_size,'total',(SELECT count(*)::text FROM rows),
   'previous',CASE WHEN EXISTS(SELECT 1 FROM rows r WHERE CASE WHEN b.view='history' THEN r.key>(SELECT key FROM ordered WHERE position=1) ELSE r.key<(SELECT key FROM ordered WHERE position=1) END)
     THEN (SELECT key FROM ordered WHERE position=1) END,
   'next',CASE WHEN EXISTS(SELECT 1 FROM rows r WHERE CASE WHEN b.view='history' THEN r.key<(SELECT key FROM ordered ORDER BY position DESC LIMIT 1) ELSE r.key>(SELECT key FROM ordered ORDER BY position DESC LIMIT 1) END)
     THEN (SELECT key FROM ordered ORDER BY position DESC LIMIT 1) END),
 'items',coalesce((SELECT jsonb_agg(value ORDER BY position) FROM ordered),'[]'::jsonb)) END AS detail
FROM envelope b CROSS JOIN activity a LEFT JOIN identity u ON true;
