# Consolidation des lectures SQL — préparation du 19 octobre 2026

**La correction SQL 68 est préparée, mais sa qualification native n'est pas
exécutée.** Aucun doublon n'est encore considéré comme corrigé sur une base.
La [preuve de suivi](reader-policies-proof.json) distingue cette préparation des
essais SQL 67 précédemment réussis.

## Modification proposée

La migration locale canonique créée par Supabase CLI 2.98.2 est
`Novlearn/supabase/migrations/20261019093842_consolidate_novlearn_admin_reader_policies.sql`,
SHA-256 `0e93f2931501ecb3f7575be0467d4f454fd43a061420a566d8abc4268479863f`.
Les 67 migrations antérieures ne sont pas réécrites.

Les advisors ont identifié des policies SELECT permissives redondantes pour
les trois lecteurs statistiques, liste et fiche. PostgreSQL combine ces
policies par OR, puis les policies restrictives par AND ; les grants restent
une condition d'accès distincte. Voir le [contrat PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Le projet de correction supprime treize alternatives `USING (true)` limitées
aux rôles nominaux. Pour cinq tables, leur exception d'identité physique est
intégrée à la policy SELECT publique existante, avec son ancien prédicat
conservé pour les autres rôles. Pour chapitres et compétences, la lecture
publique existante est déjà inconditionnelle. Aucun grant, rôle, policy
restrictive ou de mutation, fonction, contrainte ni donnée n'est modifié.

Le prérequis épingle les trois rôles non privilégiés, les noms, commandes,
rôles et expressions des policies, ainsi que l'absence d'alternative publique
inattendue. Le `search_path` est fixé à `pg_catalog` ; les anciennes sous-requêtes
restent qualifiées. Une dérive ou une réapplication doit échouer dans la transaction.

## Qualification à exécuter

Le pilote `scripts/test-reader-policies-local.mjs` n'accepte qu'une restauration
synthétique explicitement nommée et isolée sans réseau. Il prépare :

- Une matrice de dix tables, huit contextes de claims et tous les rôles existants
  hors rôles intégrés `pg_*`, avec projections réellement autorisées et refus SQL.
- La comparaison exacte des multisets de lignes visibles avant/après, avec cas
  nominaux positifs, compte permanent, invité et claims forgés.
- Quatre dérives intentionnelles annulées, un dry-run annulé et le refus de
  réapplication ; comparaison des 62 tables, séquences, ACL, rôles, appartenances,
  empreintes SCRAM, fonctions et toutes les policies hors changement attendu.

Ces critères sont des **contrôles préparés**, pas des résultats obtenus.

Le contrôle complet du code préparé passe réellement **1 143 tests / 59 fichiers**,
intégrité de l’archive Engine, types, lint, format, build autonome et smoke avec
Auth désactivée. Les 473 fichiers copiés restent identiques au retour. Cette
commande ne lance pas le nouveau pilote Docker et ne valide donc aucun de ses
cas SQL. Le seul avertissement lint `<img>` préexistant est conservé.
Les huit configurations applicatives, quatre fichiers Admin protégés, huit
modifications NovLearn préexistantes et 67 migrations antérieures gardent leurs
empreintes. Le dépôt Engine reste propre. Ce contrôle hors ligne ne compare
aucune donnée en base et ne certifie pas leur état après l’arrêt.
Restent aussi nécessaires : rejeu neuf des 68 migrations, restauration logique,
régressions SQL inchangées, vrais lecteurs PG/TLS et Auth/HTTP, puis advisors.
La migration ne doit pas être appliquée à la source connectée avant ces étapes.

## Panne locale observée

Le premier lancement du pilote échoue dès l'inspection Docker, avant connexion
à PostgreSQL ou application SQL : le pipe `dockerDesktopLinuxEngine` est absent.
Un démarrage normal de Desktop a ensuite été demandé une seule fois.

À **09:44:59 UTC le 19 octobre**, le journal Docker 4.90 indique l'échec du
renommage de `sailor-ingest.sock` en `.stale`, puis l'arrêt du backend. WSL décrit
`docker-desktop` comme arrêté. Le message ne démontre pas une interdiction Smart
App Control ou une erreur de notre migration. Un [signalement comparable chez
Docker](https://github.com/docker/desktop-feedback/issues/676) décrit la même
signature ; il ne prouve pas la cause particulière de cette machine.

La commande normale d'arrêt a été demandée sans `--force`. La fermeture par
« Quit », puis un lancement normal depuis le menu Démarrer sont demandés à
l'utilisateur. Aucun socket, ACL, réglage de protection, donnée Docker ou
environnement distant n'est modifié. Aucune réinitialisation ni contournement
par un autre lanceur n'est tenté. L'état réel sera réinspecté avant toute reprise.

Les qualifications SQL 67 et du code du jalon précédent restent des preuves
datées. Elles ne prouvent ni le test de SQL 68, ni la disponibilité actuelle des
services après cet arrêt. Le Lot 1A et le goal restent ouverts.
