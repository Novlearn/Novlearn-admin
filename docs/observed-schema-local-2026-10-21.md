# Compatibilité locale avec les écarts Staging observés

Ce contrôle complète le rejeu neuf SQL 71. Il teste le delta Admin sur une
base synthétique dont certains attributs reproduisent les métadonnées Staging
réellement lues le 20 octobre à 22:04:47 UTC. Il ne constitue ni un export,
ni une restauration fidèle de Staging, ni une autorisation de migration distante.

Les [attributs observés](observed-staging-shape-2026-10-20.json) et le
[SELECT de catalogues](observed-staging-shape-2026-10-20.sql) sont conservés.
Cette collecte ne lit aucune ligne métier ou Auth. Les résultats natifs et
leurs empreintes sont consignés dans la [preuve locale](observed-schema-local-2026-10-21.json).

## Résultat exécuté

Les 45 migrations historiques puis les 26 migrations Admin passent réellement.
Les 49 tables suivies conservent toutes leurs anciennes lignes et valeurs ;
les 13 séquences présentes avant le delta conservent leurs états et paramètres
pendant son application. Les onze contrats de colonnes et huit index restent
identiques après migration. Aucune version historique n'est inventée.

| Suite SQL existante      | Assertions réussies |
| ------------------------ | ------------------: |
| Intégration canonique    |                  30 |
| Sécurité canonique       |                  26 |
| Catalogue                |                  48 |
| Reçus                    |                  21 |
| Relecture éditoriale     |                  43 |
| Chapitres et compétences |                  39 |
| Flashcards               |                  38 |
| Dashboard                |                  35 |
| Auth et amitiés          |                   6 |
| **Total**                |             **286** |

Les 43 notices de relecture et son compteur final décrivent les mêmes
assertions et ne sont pas comptés deux fois. Les fixtures des suites sont
annulées, avec comparaison des 49 tables après chaque suite. Le conteneur est
arrêté normalement et conservé. Aucune migration canonique n'est corrigée :
ce test n'a pas mis en évidence de défaut nécessitant une nouvelle migration.

Ces assertions vérifient SQL et ses permissions. Les signatures de rapports
utilisées par les suites SQL sont synthétiques ; aucune nouvelle certification
mathématique Engine ou réception HTTP/navigateur n'est attribuée à ce test.
Le dernier contrôle complet de l'application demeure le succès antérieur de
1 505 tests ; il n'est pas annoncé comme réexécuté ici.

## Périmètre du test

Le script `scripts/test-observed-schema-local.mjs` crée un nouveau PostgreSQL
17.11 local, sans réseau ni port publié, limité à deux CPU, 1 Gio de mémoire,
zéro swap et 256 processus. Il utilise les images PostgreSQL, Auth et Node
verrouillées par digest ; aucun téléchargement implicite n'est demandé.

Il rejoue les 45 migrations historiques canoniques, puis applique uniquement
dans cette base vide le fixture `scripts/observed-staging-shape-local.sql` :

- identités BY DEFAULT pour les deux identifiants d'exercices et de tentatives ;
- titre et date de création d'exercice obligatoires ;
- colonne de création de tentative distincte de sa date de réalisation ;
- nullabilité et defaults des six colonnes de profils et compétences ;
- conservation des huit définitions d'index sélectionnées sur Staging.

Les onze contrats de colonnes sont comparés intégralement par nom : type,
nullabilité, identité, default et nom de séquence. L'ordre physique observé
reste différent et est signalé ; il n'est pas présenté comme reproduit.
La fixture conserve aussi les deux anciennes séquences serial sous des noms
de test avant de créer les identités. Elle ne supprime aucun objet, mais ces
deux séquences supplémentaires sont une autre différence synthétique explicite.
Les opérations d'identité ne sont pas une procédure de conversion d'une base
existante. [Contrat PostgreSQL 17](https://www.postgresql.org/docs/17/sql-altertable.html).

Des sentinelles locales contiennent des dates distinctes et des NULL autorisés
par les contrats observés. Ces NULL sont synthétiques : les six compteurs
Staging précédemment lus étaient nuls. Les 26 migrations Admin sont ensuite
appliquées sans changer leur contenu. Les contrôles comparent toutes les
anciennes lignes et colonnes, ainsi que les états et paramètres des séquences
existantes, avant et après le delta. Aucune version d'exercice ou de tentative
historique ne doit être inventée.

Les suites canoniques et les suites SQL existantes sont exécutées sans modifier
leurs assertions, délais ou permissions. Chaque suite doit annuler ses
fixtures et conserver les sentinelles et toutes les anciennes valeurs. Les
avances de séquence dues aux essais après migration restent distinctes de la
conservation stricte vérifiée pendant l'application du delta.

## Essai initial conservé

Le premier essai s'arrête avant le delta Admin, sur une comparaison d'ordre de
colonnes. L'ordre des métadonnées suivait les positions physiques différentes
déjà connues entre Git et Staging. La comparaison est corrigée pour indexer
chaque contrat par table et nom de colonne, en refusant les doublons et sans
retirer aucun attribut. La preuve finale signale que l'ordre ne correspond pas.
L'artefact échoué reste conservé ; il ne compte pas comme une qualification.

## Portes restantes

La provenance des 25 migrations sans statements distants n'est pas prouvée
par les seules archives retrouvées. Les autres contraintes, fonctions,
policies, ACL, extensions dont `pg_cron`, réglages gérés et données réelles ne
sont pas reconstitués par ce test partiel.

Une restauration fidèle du schéma vivant, la revue du delta réellement
nécessaire et la qualification de sauvegarde/restauration restent donc
obligatoires avant une proposition d'application distante. Les tentatives
d'export restent arrêtées à la demande de l'utilisateur. Le contrôle TLS
refusé n'est pas contourné. Staging, Production, activation Auth, première
publication et déploiement conservent leurs autorisations séparées.

Les bases applicatives, configurations privées, sources NovLearn et Engine
existantes ne sont pas modifiées par cette qualification. Le Lot 1A et le
goal restent ouverts.
