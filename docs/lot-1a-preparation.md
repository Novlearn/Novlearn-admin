# Lot 1A — dossier technique de réconciliation et sécurisation SQL

Préparation réalisée le 13 octobre 2026. Les relevés sont exclusivement en lecture. La réconciliation des historiques, les correctifs SQL et leur déploiement restent **non réalisés et non autorisés dans cette mission**. Aucune migration exécutable corrective n'est créée dans Admin ; aucun client Auth/Production ou lot fonctionnel ne commence.

## Livrables disponibles

- [Inventaire de migrations](lot-1a-migration-inventory.json) : commit NovLearn, fichiers locaux suivis et SHA-256 de leurs octets, versions/noms distants et comparaison de métadonnées. Aucun contenu métier ni secret.
- [Requête SQL de lecture](lot-1a-readonly-audit.sql) : un SELECT de catalogues PostgreSQL, validé par exécution sur les deux projets. Les définitions de fonctions/defaults/triggers sont hachées ; aucune fonction applicative n'est appelée. Ce fichier est un outil de diagnostic, pas une migration.
- [Stratégie DB](database-strategy.md), [sécurité](security.md) et [modèle validé](exercise-data-model.md) : responsabilités, constats et invariants auxquels les futurs correctifs devront se conformer.

## Résultats et niveau de preuve

La source NovLearn observée est le commit `07a1764b2225fb72c67c2fa9c6a7937cc0ae4fb6`, sans modification locale au moment du relevé. Git est utilisé avec `--no-optional-locks` et une exception `safe.directory` limitée à chaque commande ; aucune configuration persistante ni fichier du dépôt voisin n'est modifié.

| Comparaison                  | Résultat                                                                                                           | Limite                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Migrations                   | 45 fichiers Git ; 70 versions déclarées dans chacune des deux bases ; listes distantes identiques                  | L'égalité des entrées ne prouve pas que le SQL des fichiers a été appliqué                                              |
| Versions communes            | 35 identifiants présents des deux côtés                                                                            | Leurs corps SQL restent à rapprocher                                                                                    |
| Versions non correspondantes | 10 versions locales `035`–`044`, 35 versions horodatées distantes sans fichier du même numéro                      | Certaines ont des intitulés voisins ; ne pas les renommer/réparer par simple ressemblance                               |
| Métadonnées comparées        | 170 colonnes, 71 contraintes, 61 index, 59 policies, 20 fonctions, 7 triggers, 6 extensions, 66 couples rôle/table | Périmètre `public`, plus triggers applicatifs sur `auth.users` ; pas un dump complet de tous les schémas                |
| Structure comparée           | Pas de divergence trouvée dans ce périmètre, après normalisation CRLF et ordre des ACL                             | `admin_get_profile` a un ordre de grants différent, sans différence de droit effectif ou de corps                       |
| FK d'exercices               | Tentatives : `ON DELETE SET NULL` ; duels : FK sans action explicite                                               | La suppression d'exercice efface la référence des tentatives et peut être bloquée par un duel ; conserver les identités |
| Nouvelle table               | `exercise_versions` absente du relevé                                                                              | Sa création est un chantier de migration futur, distinct de ce dossier                                                  |

Les hashes SQL MD5 servent uniquement à détecter une différence entre relevés ; ils ne valident pas un artefact de publication. Les SHA-256 de fichiers locaux portent sur la copie de travail, dont les fins de ligne peuvent différer des blobs Git. Les schémas privés/gérés, paramètres Auth/Data API, valeurs de séquences et lignes métier n'ont pas été collectés. Aucun compte nominatif, token ou donnée d'activité n'a été lu.

## Travaux de réconciliation à réaliser sous autorisation ultérieure

1. Désigner le propriétaire et le reviewer SQL. La recommandation reste de conserver l'unique historique dans `Novlearn/supabase/migrations/`; sa gouvernance n'est pas validée par le seul choix du modèle d'exercices.
2. Geler les changements de schéma pendant une capture cohérente. Obtenir un export structurel contrôlé sans données métier, incluant les objets privés/applicatifs utiles, ACL, memberships de rôles, default privileges, vues, triggers Auth et dépendances. Filtrer les fonctions susceptibles d'embarquer URLs/secrets avant de les versionner.
3. Obtenir les statements distants de l'historique par un accès autorisé, les examiner dans un espace sécurisé et rapprocher leur SQL avec les fichiers Git. Le manifeste actuel contient seulement versions/noms et ne permet pas ce rapprochement complet.
4. Construire une matrice **version locale ↔ version distante ↔ objets/effets ↔ preuve ↔ décision** : « appliqué identique », « appliqué autrement », « absent », « hors fichier Git », « incertain ». Pour les effets de données (renumérotation, flags, corrections de scores), contrôler séparément les invariants par agrégats autorisés ; ne pas les rejouer pour remplir l'historique.
5. Vérifier notamment `028_claude_exercises.sql` (table préalable manquante dans la suite initiale), les changements sécurité de mars, les versions locales `035`–`044` et les changements de données horodatés. Des objets de `040`/`041`/`042` peuvent exister sans entrée portant ces numéros ; ni les supprimer ni les rejouer sans preuve.
6. Choisir la stratégie de reprise de l'historique avec le propriétaire : récupération des migrations manquantes, consolidation de schéma/baseline pour nouveaux environnements ou réparation ciblée de l'historique **uniquement après preuve**. Ne pas modifier les fichiers déjà appliqués ni effacer les entrées existantes pour faire correspondre les nombres.
7. Démontrer localement, sur PostgreSQL compatible et données synthétiques, que la source canonique recrée le schéma et peut faire évoluer une copie représentative. Une baseline peut être nécessaire pour la création locale, mais elle ne doit jamais être exécutée comme remplacement du schéma Production existant.

`migration repair`, `db push`, restauration, reset, changements de policies/grants ou génération de DDL dans le dépôt voisin ne sont pas exécutés par cette préparation. Ces opérations nécessitent une mission d'application distincte.

## Plan de sécurisation SQL à détailler après rapprochement

Les constats exacts et l'analyse de composition des policies figurent dans [sécurité](security.md). Les corrections doivent porter sur les droits réels et préserver les usages élèves autorisés.

| Priorité | Travail SQL proposé, à préparer/revoir localement                                                                                                                                                | Conditions de compatibilité                                                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critique | Remplacer les policies guest `ALL PERMISSIVE` par des règles explicitant session, propriétaire et opération, ou une garde restrictive revue ; vérifier toutes les branches permissives restantes | Ne pas bloquer par défaut les tentatives du mode invité autorisé. Un invité Auth utilise le rôle DB `authenticated`; définir explicitement ses droits propres et ceux des comptes permanents                                                      |
| Critique | Empêcher toute écriture client de `profiles.role`, à l'INSERT comme à l'UPDATE, et toute modification d'un autre profil ; defaults/provisionnement serveur protégés                              | Retirer un grant de colonne seul ne suffit pas si un grant UPDATE de table subsiste. Recomposer les privilèges par colonne ou une opération serveur dédiée, puis tester la création automatique de profil et les préférences personnelles         |
| Haute    | Supprimer les lectures transversales de profils privés et exposer une projection publique minimale aux vrais usages sociaux/classements                                                          | Cartographier les lecteurs et fournir le chemin limité avant révocation ; les vues ont leurs propres grants et droits d'exécution/RLS à vérifier                                                                                                  |
| Haute    | Retirer l'accès aux définitions et réponses privées ; revoir `get_random_exercise` et les lectures `SELECT *`                                                                                    | La route NovLearn GET utilisant `service_role` doit être corrigée par son propriétaire : une policy SQL ne protège pas ce chemin qui contourne la RLS. Préparer la transition vers des instances/projections serveur avec la qualification Engine |
| Haute    | Revoir toutes les fonctions `SECURITY DEFINER`, propriétaires, EXECUTE directs/hérités via PUBLIC, `search_path` et contrôle interne                                                             | Préférer invoker si possible ; si definer indispensable, noms qualifiés, chemin sûr, droit EXECUTE limité, rôle courant vérifié. Ne pas retirer `get_my_role`/`is_guest` sans gérer leurs dépendances de policies                                 |
| Future   | Préparer grants/RLS explicites pour `exercise_versions`, immutabilité des versions publiées et liens cohérents                                                                                   | Ne pas créer la table avant schéma détaillé, transition lecteurs et migration approuvés ; aucun droit public à la définition privée par défaut                                                                                                    |

La colonne de rôle ne doit pas provenir de `user_metadata` modifiable par l'utilisateur. Une future autorisation Admin relit une source de rôle protégée et vérifie session et permission pour chaque opération. Les rôles Staging n'accordent jamais directement une session Production. La préparation ne crée pas le premier compte Admin.

## Matrice de tests locaux requise pour le vrai Lot 1A

Ces scénarios sont préparés, **pas exécutés** : aucun correctif n'existe encore. Les tests devront employer des fixtures synthétiques, les rôles SQL effectifs et des claims représentatifs, jamais un test RLS uniquement sous `postgres`/`service_role`.

| Acteur/scénario             | Résultat attendu après correction                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon`, JWT absent          | Pas de profil privé ni écriture de profil/rôle/tentative/duel ; pas de définition ou attendu privé                                                                    |
| Utilisateur Auth invité     | Seulement ses opérations explicitement permises ; pas de rôle Admin, autre profil ou autre historique                                                                 |
| Utilisateurs permanents A/B | A lit/modifie les champs personnels autorisés de A ; B reste invisible/non modifiable ; propriété et IDs non réassignables                                            |
| Escalade de rôle            | `role='admin'` à INSERT/UPDATE, suppression/recréation du profil, payload user metadata ou claims fabriqués ne donnent aucun accès administratif                      |
| Admin Staging               | Opérations Staging autorisées après validation ; aucune identité Auth Production déduite du compte Staging                                                            |
| RPC/vues/direct table       | Même confidentialité quel que soit le chemin ; EXECUTE hérité via PUBLIC et sous `anon` contrôlé ; réponse publique sans champs privés                                |
| Anciennes tentatives/duels  | IDs et FK conservés ; version historique inconnue non backfillée arbitrairement ; clients legacy documentés pendant transition                                        |
| Révisions futures           | Modifier/supprimer une définition publiée refusé ; version active appartenant à un autre exercice refusée ; nouvelle tentative liée à sa vraie version/instance       |
| Répétition/rollback         | Reconstruction locale et migration sur copie compatibles ; restauration locale démontrée ; pas de réactivation des permissions trop larges comme rollback automatique |

## Portes avant application et avant Auth Admin

La préparation est terminée lorsque la décision est tracée, les requêtes de lecture valides, le manifeste produit et les risques/prérequis décrits. Elle ne permet pas de marquer la réconciliation ou la sécurisation comme terminées.

Le vrai Lot 1A devra apporter : historique canonique rapproché, plan SQL revu, preuves locales des permissions et de compatibilité, backup/PITR et restauration vérifiés, stratégie en avant/retour compatible et autorisation explicite d'appliquer d'abord en Staging. Production attendra une validation séparée. L'Auth Admin (volet 1B) attend cette sécurisation et un provisionnement initial contrôlé. Ne pas ouvrir automatiquement le catalogue, Creator, Dashboard ou publication.

## Vérifications de la préparation

Les contrôles de ce dossier passent : `npm.cmd run check` (types, lint, format et build), diff sans erreur d'espacement sur le périmètre à committer, cibles des liens locaux présentes et vérification que seules les sections 10, 11 et 20 du CDC changent. La copie préexistante de `.env.example` est identique octet pour octet au début de la mission et reste hors du commit. Le SQL livré correspond à la requête de lecture réellement exécutée, à la mise en forme près. Ces vérifications ne sont pas des tests d'autorisation des futurs correctifs.

## Documentation officielle vérifiée

Les références consultées décrivent la combinaison grants/RLS, la gestion des fonctions et le workflow de migrations : [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [fonctions](https://supabase.com/docs/guides/database/functions), [migrations](https://supabase.com/docs/guides/deployment/database-migrations) et [composition PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

La consultation du changelog signale deux points à recontrôler avant les futures intégrations : nouveaux objets `public` nécessitant des grants explicites (ne pas compter sur une exposition automatique de `exercise_versions`) et versions clients Supabase ayant cessé le support Node 20. Aucun paramètre ni dépendance n'est changé ici. [Exposition Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [support Node](https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20).
