# Environnements et configuration

## Staging

Staging est l'environnement de travail de l'Admin. La cible prévoit que Supabase Auth de Staging authentifie les administrateurs ; les opérations éditoriales (brouillons, validations, chapitres, compétences et flashcards) s'y dérouleront. Les comptes Auth Production ne sont pas supposés identiques. Les rôles et permissions doivent être vérifiés côté serveur et les politiques RLS auditées avant d'activer l'accès.

## Production

Les données Production sont des données réelles. L'Admin ne doit y accéder que pour les usages autorisés : agrégations statistiques minimisées, consultation autorisée des utilisateurs/catalogue et publication contrôlée d'exercices. La lecture statistique et l'écriture de publication sont des capacités serveur distinctes. L'accès ordinaire en édition n'écrit pas en Production.

La publication V1 concerne la table métier `public.exercises` seulement. Il n'y a pas de synchronisation des tentatives, profils, utilisateurs Auth, statistiques, chapitres, compétences, flashcards, feedbacks ou exercices Claude. Les absences constatées en Staging ne déclenchent aucune suppression en Production.

## Secrets et variables

`.env.example` contient des valeurs fictives et des noms provisoires destinés à illustrer les catégories. Il ne faut pas les considérer comme un contrat d'API stable. Les noms définitifs seront fixés avec chaque intégration. Une clé privilégiée reste serveur uniquement ; aucune clé de lecture Production ou de publication ne va dans une variable `NEXT_PUBLIC_*`. Ne copiez pas de secret d'un autre dépôt.

Les catégories prévues sont : environnement applicatif/base URL ; URL et clé publique Staging ; accès Production serveur en lecture restreinte ; capacité serveur distincte de publication ; configuration future du package Engine ; paramètres d'hébergement. Les opérations Production doivent être limitées explicitement à leur usage, sans supposer une clé universelle `service_role`.

## Schémas et migrations

Les migrations SQL sont coordonnées entre les projets et doivent être versionnées. Le CDC rapporte que l'audit initial a relevé des différences de définition de certaines fonctions SQL entre Staging et Production. Cette observation provient du CDC : elle n'a pas été vérifiée directement sur les bases pendant le Lot 0. Tout changement de schéma devra comparer les deux environnements et établir une stratégie de déploiement contrôlée.

## Déploiement

La sortie Next.js `standalone` prépare un déploiement autonome futur. L'hébergeur, les secrets de runtime, les domaines et la procédure de promotion restent ouverts. Le déploiement du code suit un processus distinct de publication de contenu. Aucun déploiement automatique de production n'est configuré.
