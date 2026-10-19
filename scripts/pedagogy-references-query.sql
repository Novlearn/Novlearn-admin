-- Literal substring search of current metadata. No wildcard interpretation,
-- dynamic SQL, user identities, definitions or exercise answers.
WITH bounds AS MATERIALIZED (
 SELECT $1::text AS kind,$2::text AS q
 WHERE $1::text IN ('chapter','competence') AND char_length($2::text)<=200
   AND $2::text !~ '[[:cntrl:]]'
), chapters AS MATERIALIZED (
 SELECT id,coalesce(nullif(btrim(name),''),'Chapitre sans nom') AS label,aliases
 FROM public.chapters
), candidates AS (
 SELECT c.id::text AS id,c.label FROM chapters c CROSS JOIN bounds b
 WHERE b.kind='chapter' AND (strpos(lower(c.id::text),lower(b.q))>0 OR
   strpos(lower(c.label),lower(b.q))>0 OR EXISTS(SELECT 1 FROM unnest(c.aliases) a WHERE strpos(lower(a),lower(b.q))>0))
 UNION ALL
 SELECT c.id,CASE WHEN ch.id IS NOT NULL THEN ch.label||' · ' ELSE '' END||
   coalesce(nullif(btrim(c.name),''),'Compétence sans nom') AS label
 FROM public.competences c LEFT JOIN chapters ch ON ch.id=c.chapter_id CROSS JOIN bounds b
 WHERE b.kind='competence' AND char_length(c.id) BETWEEN 1 AND 200 AND c.id !~ '[[:cntrl:]]'
   AND (strpos(lower(c.id),lower(b.q))>0 OR strpos(lower(coalesce(c.name,'')),lower(b.q))>0 OR
     strpos(lower(coalesce(ch.label,'')),lower(b.q))>0)
), page AS (
 SELECT c.* FROM candidates c CROSS JOIN bounds b
 ORDER BY (c.id=b.q) DESC,c.label COLLATE "C",c.id COLLATE "C" LIMIT 200
)
SELECT jsonb_build_object('schemaVersion',1,'kind',b.kind,'q',b.q,
 'more',(SELECT count(*)>200 FROM candidates),
 'items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'label',left(label,200),
   'truncated',char_length(label)>200) ORDER BY (id=b.q) DESC,label COLLATE "C",id COLLATE "C") FROM page),'[]'::jsonb))
AS reference_choices FROM bounds b;
