# Environnements et configuration

## Staging

Staging est l'environnement de travail de l'Admin. La cible prévoit que Supabase Auth de Staging authentifie les administrateurs ; les opérations éditoriales (brouillons, validations, chapitres, compétences et flashcards) s'y dérouleront. Les comptes Auth Production ne sont pas supposés identiques. Les rôles et permissions doivent être vérifiés côté serveur et les politiques RLS auditées avant d'activer l'accès.

## Production

Les données Production sont des données réelles. L'Admin ne doit y accéder que pour les usages autorisés : agrégations statistiques minimisées, consultation autorisée des utilisateurs/catalogue et publication contrôlée d'exercices. La lecture statistique et l'écriture de publication sont des capacités serveur distinctes. L'accès ordinaire en édition n'écrit pas en Production.

La publication V1 sélectionne uniquement le contenu métier approuvé de `public.exercises` et `public.exercise_versions`. Elle ne réplique pas intégralement leurs lignes. Il n'y a pas de synchronisation des tentatives, duels, profils, utilisateurs Auth, statistiques, chapitres, compétences, flashcards, feedbacks, `exercises_claude` ou de toute autre table. Les absences constatées en Staging ne déclenchent aucune suppression en Production. Les migrations de structure nécessaires à la compatibilité évoluent séparément et ne constituent pas un transfert de ces données.

## Secrets et variables

Les noms proposés pour le prochain lot Auth sont `APP_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, avec des valeurs locales/fictives. Ils figurent dans la modification locale préexistante de `.env.example`, préservée hors du commit documentaire. Le fichier versionné avant cette mission contient encore des placeholders documentaires anciens ; aucune variable n'est consommée par le code et aucun nom `READONLY_KEY`/`PUBLISH_KEY` ne constitue une permission technique. Une clé privilégiée future reste serveur uniquement ; aucune clé de lecture Production ou de publication ne va dans une variable `NEXT_PUBLIC_*`. Ne copiez pas de secret d'un autre dépôt.

Les intégrations Production et Engine restent documentaires jusqu'à validation des lots correspondants. Les opérations Production doivent être limitées explicitement à leur usage, sans supposer qu'une variable ou clé nommée `READONLY_KEY`, `PUBLISH_KEY` ou `service_role` possède un périmètre qui ne lui est pas imposé par des droits techniques.

## Schémas et migrations

Les projets `novlearn-prod` et `novlearn-staging` ont été inspectés en lecture seule le 13 octobre 2026. Chacun expose 22 tables `public` ; les migrations déclarées et les colonnes des tables principales concordent. Les politiques relevées pour `exercises` et `profiles` ouvrent cependant des lectures trop larges ; voir [sécurité](security.md). Les définitions actuelles des trois fonctions mentionnées dans le CDC étaient équivalentes lors du relevé, même si le CDC rapporte des divergences antérieures. Les migrations versionnées résident dans `Novlearn/supabase/migrations/`. Les noms de fichiers locaux ne correspondent pas directement à toute la liste distante : avant toute migration, réconcilier historique déclaré, fichiers, schémas, fonctions, policies et éventuels changements manuels. Voir [stratégie de base et migrations](database-strategy.md). Recommandation actuelle : une seule source canonique de migrations, sans historique concurrent dans l'Admin.

## Déploiement

La sortie Next.js `standalone` prépare un déploiement autonome futur. L'hébergeur, les secrets de runtime, les domaines et la procédure de promotion restent ouverts. Le déploiement du code suit un processus distinct de publication de contenu. Aucun déploiement automatique de production n'est configuré.
