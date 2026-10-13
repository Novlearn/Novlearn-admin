# Stratégie de bases et migrations

**État local courant D04 :** les corrections NovLearn sont autorisées, avec
une source canonique de 49 migrations testée sur une instance neuve avec le
bootstrap officiel Auth. Une [restauration logique sur fixtures synthétiques](lot-1a-local-restore-and-privacy.md)
est démontrée, avec contrôles de données, schéma et permissions. Les relevés
distants historiques ci-dessous ne sont pas une réconciliation complète et
n'autorisent aucune application distante. Les sauvegardes/PITR des projets
réels restent à qualifier séparément.

Le [complément de rapprochement](lot-1a-hash-reconciliation.md) compare maintenant
les empreintes des statements archivés : sept candidats, 25 entrées sans SQL.
Il ne remplace pas la réconciliation sémantique ou l'accord d'application.

État vérifié le 13 octobre 2026, en lecture seule. Ce rapport établit un point de départ ; ce n'est pas un plan d'exécution de migration.

## Modèle validé et distinction structure / contenu

Le modèle cible est désormais `public.exercises` pour l'identité et `public.exercise_versions` pour les révisions. La publication sélectionne exclusivement leur contenu métier approuvé. Elle ne réplique pas toutes les lignes/champs et ne copie aucune autre table. Les migrations de structure peuvent faire évoluer les tentatives et duels pour conserver leurs FK et leur traçabilité, sans jamais synchroniser leurs données. L'autorisation documentaire actuelle ne permet ni création de table ni application de migration distante.

## État vivant observé

Les projets Supabase `novlearn-prod` et `novlearn-staging` sont tous deux actifs dans `eu-west-3`. Les deux exposent 22 tables dans `public`. La structure observée est identique pour les tables listées ci-dessous. Les versions Postgres majeures sont toutes deux 17 ; les versions mineures annoncées diffèrent (Production 17.6.1.054, Staging 17.11.0.003).

| Table               | Points structurels confirmés                                                                 | Relations observées                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `exercises`         | `id bigint`, colonnes éditoriales, `content jsonb`, RLS active                               | Référencée par tentatives, duels et feedbacks                                         |
| `exercise_attempts` | `id bigint`, `user_id uuid`, `exercise_id bigint`, score, exactitude, date, invités/abandons | FK utilisateur vers Auth ; FK exercice avec comportement à revérifier avant évolution |
| `duels`             | `id bigint`, `exercise_id bigint`, `exercise_data jsonb`, joueurs et scores                  | FK exercice et utilisateurs                                                           |
| `duel_attempts`     | duel/joueur/élément, réponse et résultat                                                     | FK vers duels et Auth                                                                 |
| `profiles`          | `id uuid`, email, noms, birth date, rôle, préférences et attributs, RLS active               | `id` vers `auth.users`                                                                |

Les métadonnées confirment les 22 tables et les relations mentionnées. Elles ne fournissent pas de preuve que les données elles-mêmes soient cohérentes ou que les schémas complets (vues, triggers, extensions, privilèges, politiques, fonctions et séquences) soient identiques.

## Migrations : emplacement, historique et source de vérité

Les fichiers SQL actuels sont dans `Novlearn/supabase/migrations/`. `Novlearn/package.json` expose `db:push` (`supabase db push`) et sa documentation d'environnement prescrit le parcours CLI avec `db push --dry-run`, puis Staging, validation, ensuite Production. Ce sont les commandes/documentations déclarées ; l'historique des commandes réellement exécutées n'est pas accessible ici. Le même guide reconnaît des changements Dashboard directs possibles et indique que le dump de schéma réel peut les inclure. Aucune migration SQL n'existe dans `novlearn-admin`.

La préparation du Lot 1A relève **45 fichiers SQL suivis dans NovLearn** et **70 entrées de migration déclarées par chacun des deux projets**, listes distantes identiques. 35 versions portent le même identifiant entre Git et les bases (`001` à `034` et `20260525203757`), sans preuve d'équivalence de leur SQL. Les 10 versions locales `035` à `044` ne portent pas de version identique à distance ; 35 versions horodatées distantes n'ont pas de fichier local portant leur version. Le fichier local `044_fix_handle_new_user_birth_date.sql` a par exemple un intitulé proche de l'entrée distante `20260910122045`, mais leurs contenus ne sont pas déclarés équivalents par cet audit.

Le [manifeste de réconciliation](lot-1a-migration-inventory.json) conserve les versions/noms et empreintes SHA-256 des fichiers locaux, le commit NovLearn observé et les deux listes à rapprocher. Ce manifeste contient uniquement des métadonnées techniques. Il n'est ni une baseline approuvée ni un historique réparé.

Les projets déclarent donc le même historique, mais ni les fichiers Git ni les entrées de migration ne suffisent à établir une correspondance bit à bit. Certains intitulés suggèrent un lien entre migrations séquentielles et horodatées, mais leur équivalence SQL n'a pas été établie et ne doit pas être présumée. Une modification directe via Dashboard ou SQL ne peut être exclue par ces métadonnées. Les noms/fichiers décalés, doublons apparents d'intitulés et historique de migrations irrégulier imposent un rapprochement explicite avant d'ajouter une version.

**Source unique recommandée :** `Novlearn/supabase/migrations/` demeure l'historique canonique des schémas communs tant que les bases et l'application existante y sont rattachées. `novlearn-admin` ne crée pas sa propre table d'historique ou son propre dossier de migrations concurrent. Toute migration requise par l'Admin est d'abord arbitrée et maintenue dans la source canonique. Un transfert de propriété ultérieur demanderait une décision tracée, un gel des changements, une baseline vérifiée et un plan de coordination des déploiements ; rien de cela n'est effectué ici.

## Réconciliation préalable requise

Avant une migration future, un responsable doit recueillir un dossier versionné et sans données métier :

1. Inventaire SQL structurel de chaque environnement : tables, colonnes, types, défauts, identités, contraintes, index, triggers, vues, fonctions/procédures, ACL, RLS/policies, extensions et séquences. Comparer les fonctions par signature et corps normalisé.
2. Liste distante des versions déclarées, fichiers Git, empreintes SHA-256 locales, dates et descriptions ; relier une à une les migrations horodatées et les fichiers séquentiels sans présumer de leur équivalence.
3. Vérification de l'origine réelle de `exercises_claude` et des changements qui peuvent avoir été appliqués manuellement. Le fichier local `028_claude_exercises.sql` et la doc de synchronisation catalogue indiquent une dépendance préalable ; ne pas supposer que la migration seule recrée l'environnement.
4. Comparaison des schémas Production et Staging et distinction entre dérive voulue, changement manuel, différences de données et défaut d'historique. Le guide voisin avertit notamment que `028_claude_exercises.sql` présuppose `exercises_claude` existante ; l'historique Git seul ne reconstruit pas forcément le schéma vivant.
5. Construction d'une baseline seulement après rapprochement et revue par le propriétaire DB. Ne pas réécrire l'historique appliqué pour faire correspondre les numéros.

Le relevé actuel a trouvé des politiques identiques sur `exercises`, `profiles`, `exercise_attempts`, `duels` et `duel_attempts`, et des corps équivalents pour les trois fonctions auditées. Il ne constitue pas un diff complet de base.

La collecte additionnelle du Lot 1A compare les colonnes, contraintes, index, policies, fonctions, ACL, triggers personnalisés et extensions dans le périmètre de la [requête de lecture](lot-1a-readonly-audit.sql). Après normalisation des fins de ligne et de l'ordre des ACL, aucune différence structurelle n'a été trouvée dans ce périmètre. L'ordre textuel des grants de `admin_get_profile` diffère, mais ses droits effectifs et son corps sont identiques. Les schémas privés/gérés, réglages Auth/Data API, valeurs des séquences et contenus métier restent hors de ce relevé. Les risques SQL actuels et les étapes restantes sont dans [la préparation du Lot 1A](lot-1a-preparation.md).

## Pipeline proposé

| Étape                | Garde-fous obligatoires                                                                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Développement local  | Version Postgres/extensions compatible ; base jetable restaurée de schéma et données synthétiques/anonymisées ; migration versionnée unique ; vérification répétée depuis une base vide et sur une copie représentative ; assertions pré/post et tests de permissions. |
| Revue                | Revue SQL par pair ; détection des verrous, durée, volume, clés/indices et opérations non transactionnelles ; plan de déploiement par étapes ; compatibilité avec l'ancien code.                                                                                       |
| Sauvegarde           | Vérifier qu'une sauvegarde/PITR exploitable existe, consigner son heure et tester la restauration sur environnement isolé. Une sauvegarde ne remplace pas un rollback de code/schéma.                                                                                  |
| Précontrôles Staging | Confirmer projet ciblé par nom/ref, statut, migration attendue, drift nul ou expliqué, sauvegarde, prérequis et absence de processus d'édition/import concurrent. Aucun secret affiché dans les logs.                                                                  |
| Staging              | Appliquer la migration unique via le workflow approuvé ; exécuter contrôles de schéma, contraintes, politiques et parcours d'écriture ; vérifier les données existantes et les journaux.                                                                               |
| Validation           | Vérifier les fonctions, RLS, FK, indices, performances de requêtes représentatives, compatibilité avec code courant et Engine ; obtenir une validation humaine explicite avant Production.                                                                             |
| Production           | Fenêtre approuvée, backup/PITR récent validé, même artefact immuable, contrôle explicite de projet et de version, exécution sous rôle le moins privilégié adapté ; surveillance et vérifications postérieures.                                                         |
| Après migration      | Comparer invariants et volumes sans exporter d'informations personnelles, contrôler erreurs/latence, vérifier contraintes et routes clientes, documenter l'état final des versions des deux bases.                                                                     |

### Compatibilité et données existantes

Préférer les changements additifs compatibles arrière : ajouter une colonne nullable ou une table, déployer code qui écrit/relit les deux formes si besoin, backfill idempotent et mesuré, vérifier, puis seulement dans une livraison ultérieure retirer l'ancien chemin après preuve d'absence d'usage et autorisation explicite. Les migrations de données doivent être batchées, reprenables et auditables. Ne jamais renuméroter ou remplacer en masse les IDs d'exercice référencés.

Éviter les migrations destructives dans une transaction de déploiement qui combine d'autres changements. Aucune suppression, `TRUNCATE`, réécriture de clés, ou reconstruction de tentatives n'est proposée dans cet audit.

### Retour arrière

Le retour opérationnel par défaut est de revenir à la version précédente du code tout en conservant un schéma additif compatible. Une migration inverse n'est acceptable que si elle est testée et sans perte. Après backfill/écriture de données, ne pas exécuter un `DOWN` destructif ; corriger par une migration en avant ou restaurer un snapshot dans un environnement isolé puis effectuer une procédure de reprise validée. La restauration Production est un dernier recours coordonné avec décision explicite car elle peut perdre les écritures postérieures au point restauré.

## Outil actuel de synchronisation de catalogue NovLearn

`Novlearn/docs/catalog-sync.md` et `scripts/sync-catalog.mjs` décrivent un outil qui copie actuellement Production vers Staging : par défaut `chapters`, `competences`, `exercises`, avec `flashcards` en option. Il comprend une table de suivi privée Staging, reprend les IDs Production, remplace certaines lignes importées et garde les autres. Ce processus est distinct des migrations et ne correspond pas à la publication Admin Staging vers Production. Il inclut des tables explicitement exclues du CDC Admin ; ne pas l'invoquer ni l'étendre comme implémentation de publication V1.
