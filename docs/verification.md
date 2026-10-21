# Vérifications et preuves

## Contrôles à exécuter selon le changement

| Commande                    | Ce qu’elle contrôle                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm.cmd run verify:engine` | Archive, fichier Engine installé, intégrité du lockfile et Cortex épinglé ; aucun calcul natif |
| `npm.cmd test`              | Tests Vitest, contrats, permissions et rendus serveur selon les suites                         |
| `npm.cmd run typecheck`     | Types TypeScript                                                                               |
| `npm.cmd run lint`          | Règles ESLint                                                                                  |
| `npm.cmd run format:check`  | Format Prettier, avec les exclusions versionnées                                               |
| `npm.cmd run build`         | Build Next et préparation du standalone                                                        |
| `npm.cmd run test:smoke`    | Smoke HTTP du build, Auth désactivée                                                           |
| `npm.cmd run check`         | Les contrôles précédents, dans l’ordre défini par `package.json`                               |

Ne pas annoncer un contrôle complet réussi si une étape échoue. Des tests ciblés
réussis après un timeout ne transforment pas l’exécution initiale en succès.
Les quotas, délais et assertions doivent rester inchangés.

Pour conserver une instance en cours, `node scripts/check-isolated-local.mjs`
exécute le contrôle général sur une copie des sources autorisées et des dépendances,
sans `.env`, `.git` ni état privé. Il consomme de l’espace temporaire. Une preuve
porte sur cette copie exacte et sur sa date, pas automatiquement sur les fichiers
modifiés après son exécution.

Pour une retouche documentaire, vérifier le format des fichiers concernés,
leurs liens locaux et ancres, les références textuelles depuis le code/configuration
et la préservation des pièces consommées par les scripts. Le contrôle applicatif
complet ne remplace pas cette vérification documentaire.

## Lire une preuve

Les JSON/SQL, captures et audits conservés sont rangés dans `docs/archives/`,
sans modification de leurs octets. Certains restent des entrées nécessaires aux
outils de contrôle : leurs chemins de lecture ont été adaptés dans les scripts.
Ce sont des **relevés datés**, avec succès, échecs, périmètres et limites ; leurs
champs `current`, `remaining`, anciens noms de documents et autorisations ne sont
pas l’état opérationnel actuel. Celui-ci est dans [la roadmap](roadmap.md).
Un artefact privé cité peut nécessiter la sauvegarde d’origine ; le JSON public
ne suffit pas toujours à reproduire une qualification.

| Sujet                                  | Preuves conservées et portée                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging réel                           | [Qualification SQL](archives/staging-sql-qualification-2026-10-21.json) et [réception D12](archives/staging-app-2026-10-21-proof.json) : restauration ciblée, application et sauvegarde de brouillon ; pas de sauvegarde complète Auth/Storage                                                                                                                                                                                                                                              |
| Dernier contrôle applicatif enregistré | [D13](archives/release-vercel-2026-10-21.json) : contrôle local, HTTP sans Docker, retrait et archives ; aucun déploiement Vercel                                                                                                                                                                                                                                                                                                                                                           |
| Ancien banc essentiel                  | [D11](archives/local-mvp-proof.json) et [restauration partielle](archives/docker-cleanup-recovery-2026-10-21.json) ; ne prouvent pas la disponibilité actuelle                                                                                                                                                                                                                                                                                                                              |
| Engine initial Linux                   | [Qualification](archives/lot-1a-engine-local-proof.json) : archive historique `650128cd…9190290`, package installé et profil OS précis                                                                                                                                                                                                                                                                                                                                                      |
| Engine actuellement épinglé            | [Correctif numérique](archives/engine-numeric-cache-proof.json) puis [adoption Admin / SQL64](archives/engine-admin-adoption-proof.json) : archive `d4d3abc4…a582f9`, Linux installé, nouvelles signatures et conservation des anciens reçus                                                                                                                                                                                                                                                |
| Engine 0.2.0, courbes                  | [Proposition](archives/engine-graph-proposal.json) et [résultats D10](archives/engine-graphs-proof.json) : phases package Linux réussies ; contrôle complet Windows en échec et suite Linux non démarrée à cause de `EAGAIN` sous 64 processus ; aucune adoption Admin                                                                                                                                                                                                                      |
| Creator, rendu et aperçu               | [Éditeur](archives/creator-local-proof.json), [coordonnées](archives/coordinate-rendering-proof.json), [aperçu](archives/preview-local-proof.json) et [Engine connecté](archives/local-admin-engine-proof.json) ; séparer capture native, rendu et interactions navigateur                                                                                                                                                                                                                  |
| Récupération Creator                   | [Contrat](archives/creator-recovery-proof.json), [refus de nettoyage](archives/recovery-cleanup-proof.json), [réception humaine](archives/recovery-reception-2026-10-21.json)                                                                                                                                                                                                                                                                                                               |
| Rapports et relecture                  | [Reçus](archives/test-receipts-local-proof.json), [relecture SQL](archives/editorial-review-local-proof.json), [parcours connecté](archives/local-admin-review-proof.json) ; résultats locaux, aucune clé opérationnelle Staging présumée                                                                                                                                                                                                                                                   |
| Référentiel et dashboard               | [Catalogue](archives/catalogue-local-proof.json), [chapitres/compétences](archives/taxonomy-local-proof.json), [flashcards](archives/flashcards-local-proof.json), [dashboard](archives/dashboard-local-proof.json)                                                                                                                                                                                                                                                                         |
| Statistiques et utilisateurs           | [Activité HTTP](archives/activity-http-proof.json), [pédagogie connectée](archives/pedagogy-connected-proof.json), [performance](archives/pedagogy-performance-proof.json), [liste](archives/users-readonly-proof.json), [fiche](archives/user-detail-proof.json), [deux compteurs](archives/completed-work-local-proof.json) ; copies synthétiques, pas de lecture Production                                                                                                              |
| Version active                         | [Lecteur connecté](archives/active-version-connected-proof.json) et [cible locale](archives/active-version-target-local-proof.json) ; pointeur réel distinct de la dernière révision                                                                                                                                                                                                                                                                                                        |
| Publication                            | [Capacité](archives/publication-capability-local-proof.json), [journal](archives/publication-journal-local-proof.json), [transfert cible](archives/publication-target-local-proof.json), [HTTP connecté](archives/publication-http-connected-proof.json), [lots](archives/publication-batch-http-proof.json), [finalisation source](archives/publication-source-local-proof.json), [rollback](archives/publication-rollback-local-proof.json) ; copies locales, pas de transfert Production |
| Réconciliation SQL                     | [Inventaire](archives/lot-1a-migration-inventory.json), [empreintes](archives/lot-1a-migration-hashes.json), [relevé distant](archives/lot-1a-remote-reconciliation-current.json), [écarts](archives/remote-readiness-2026-10-20.json), [qualification synthétique](archives/observed-schema-local-2026-10-21.json)                                                                                                                                                                         |
| Permissions SQL                        | [Restauration/profils](archives/lot-1a-local-restore-proof.json), [RPC](archives/lot-1a-local-rpc-proof.json), [écritures statistiques](archives/lot-1a-local-statistics-proof.json), [policies](archives/reader-policies-proof.json), [search_path](archives/legacy-search-path-proof.json), [triage](archives/sql-findings-triage.json)                                                                                                                                                   |
| Export de structure                    | [Preuve](archives/staging-schema-export-proof.json) et [reprise MCP](archives/mcp-resume-2026-10-20.json) ; dump synthétique qualifié, export standard Staging arrêté avant `pg_dump`                                                                                                                                                                                                                                                                                                       |

Les autres preuves JSON, manifestes, six SQL et captures restent conservés dans
ce même sous-dossier. La racine de `docs/` garde seulement les sept guides actifs
et le design de référence.
[L’audit du 15 octobre](archives/audit-current-2026-10-15.md) reste une pièce historique
inchangée dont l’empreinte apparaît dans plusieurs preuves. Il ne décrit pas
le dépôt actuel.

## Précautions SQL et Engine à conserver

Les scripts ne consomment pas tous seulement du code :

- `run-staging-admin.mjs` lit `docs/archives/staging-sql-qualification-2026-10-21.json` et compare
  son SHA256 à la configuration privée. Ne pas reformater ce fichier.
- `test-observed-schema-local.mjs` lit le snapshot
  [SQL](archives/observed-staging-shape-2026-10-20.sql) et son
  [JSON](archives/observed-staging-shape-2026-10-20.json). Les contrôles de pédagogie et de
  version active lisent aussi les preuves de leur baseline.
- `verify-engine-package.mjs` épingle archive, installation et lockfile ; les
  reçus SQL et les approbations sont liés à cette identité. Une rotation exige
  une qualification coordonnée, pas un remplacement de tarball isolé.
- `.env.publication.example` renvoie à `docs/auth.md` ; ce point d’entrée est
  maintenu. `AGENTS.md` renvoie à `docs/roadmap.md`.

Les outils `scripts/test-*.mjs`, les tests SQL et `replay-sql-local.ps1` ne sont
pas tous de simples lectures : plusieurs créent des bases/conteneurs de copie,
appliquent des migrations ou nécessitent des artefacts privés et le dépôt SQL
propriétaire. Examiner leur périmètre avant exécution. Ne pas les lancer contre
un environnement distant, ni les annoncer exécutés pendant ce nettoyage.

L’outil `scripts/export-staging-schema.ts --check` vérifie la forme de sa
configuration privée ; l’export réel est une opération séparée, en lecture seule,
avec TLS vérifié et snapshot commun. Les tentatives conservées ont d’abord échoué
en accès IPv6, puis sur la garde TLS du segment pooler→Postgres. L’arrêt demandé
par l’utilisateur demeure : aucune relance automatique ni assouplissement TLS.
Le raccordement D12 par restauration ciblée ne prouve pas qu’un export standard
complet a ensuite réussi.

## Réception humaine connue

Le 20 octobre, l’utilisateur a accepté le parcours local connexion, brouillon,
fraction MathLive, sauvegarde et réouverture, avec des soucis non précisés reportés :
[reçu](archives/local-reception-2026-10-20.json). Le 21 octobre, il a confirmé la récupération
d’un titre modifié après rechargement. Ni navigateur/version ni preuve de tous
les autres champs ou traversées ne sont déduits de ce retour. La réception D12
sur Staging est distincte. Aucune de ces observations ne réceptionne Vercel,
l’accessibilité complète, le mobile ou la publication Production.

## Regroupement documentaire et historique

L’[inventaire de refonte](archives/documentation-inventory.json) recense chaque ancien
Markdown de `docs/`, son empreinte, sa destination et les preuves qu’il citait.
Les anciens guides par fonctionnalité sont regroupés dans l’architecture et Auth ;
les bilans successifs dans la roadmap ; la qualification SQL/Engine et les
réceptions dans ce guide. Les comptes rendus redondants sont supprimés après
reprise de leurs informations utiles.

Pour lire un ancien document exactement tel qu’il était au début de la refonte :

```powershell
git show c2064bf13c0c20b094e30a9eb834869ff4420f3f:docs/engine-admin-adoption.md
git log -- docs/engine-admin-adoption.md
```

Les chemins et empreintes d’anciens Markdown dans les preuves JSON sont des
références à ce contenu historique, pas des liens vers les nouveaux guides.
Les réécrire ferait perdre la traçabilité des preuves. L’inventaire permet leur
résolution dans Git sans conserver tous les récits dans la documentation active.
Pour une pièce conservée désormais sous `archives/`, remplacer le préfixe
historique `docs/` par `docs/archives/` pour retrouver son emplacement actuel.
Les destinations vers les guides actifs gardent leur chemin.

Deux documents sont apparus pendant la refonte :
[audit V1](archives/audit-v1-2026-10-21.md) et [proposition de plan V1](archives/plan-v1-2026-10-21.md).
Ils sont conservés sans modification, hors du regroupement des 92 Markdown
présents initialement. Leurs constats, contrôles et propositions sont ceux de
leur auteur ; ils ne constituent pas des opérations exécutées dans cette mission.

## Contrôles de cette refonte

Contrôle d’intégrité `npm.cmd run verify:engine` réussi. Format Prettier des
documents réécrits et de l’inventaire vérifié ; liens Markdown locaux, références
documentaires depuis le code/configuration et destinations de l’inventaire
contrôlés. Les JSON ont été parsés et `git diff --check` passe.
Le rangement adapte uniquement des chemins dans six scripts et l’exemple public
Vercel ; aucune logique fonctionnelle ni contrôle n’est modifié. CDC, AGENTS,
design, configurations privées et octets des preuves JSON/SQL sont préservés.
Les empreintes du design et
de l’audit historique ont également été comparées à l’inventaire initial.

Aucun test applicatif, build, banc SQL, calcul natif Engine, réception navigateur,
accès distant ou restauration de sauvegarde n’a été exécuté pour cette refonte.
