# Lot 1A — corrections et validation locales du 13 octobre 2026

**Complément courant :** le [rejeu Auth complet, la restauration et la
confidentialité des profils](lot-1a-local-restore-and-privacy.md) apportent
désormais 49 migrations et 35 assertions après restauration. Le tableau
ci-dessous reste la preuve datée de la première intervention, avant cette
nouvelle migration. Les lectures privées d'exercices et la certification
Engine demeurent des portes ouvertes.

Le Lot 1A reste **incomplet**. Les corrections locales et les contrôles SQL
ci-dessous sont réalisés ; la certification Engine complète et les prérequis
d'application distante ne sont pas validés. L'Auth Admin reste désactivée.

## Autorisation et périmètre

L'utilisateur autorise explicitement la finalisation locale dans NovLearn à
partir des propositions existantes : code, migrations locales, tests et
documentation. Aucune écriture distante, suppression de donnée existante,
publication, déploiement ou modification des sources Engine n'est autorisée.
Cette décision est tracée en D04. Aucun appel de mutation Supabase distant
n'est effectué pendant cette reprise.

Les modifications préexistantes et celles apparues en parallèle dans NovLearn
sont conservées. Les corrections historiques 010/022/028 et les deux premières
migrations Admin ne sont pas attribuées à cette intervention ; elles constituent
les sources locales utilisées pour le rejeu. Leurs originaux et la revue sont
dans les audits NovLearn. Les empreintes du relevé antérieur restent des preuves
datées, pas les empreintes des fichiers historiques maintenant corrigés.

## Modifications de cette intervention

- Ajout de `20261013174723_novlearn_admin_profile_role_hardening.sql` dans
  `Novlearn/supabase/migrations/` : contrôle du vrai pgcrypto dans `extensions`,
  refus des invités, policies restrictives de propriété, protection du rôle et
  de l'identité à INSERT/UPDATE, refus des suppressions de profils par clients.
  Le provisionnement Auth/service conserve son chemin privilégié existant.
- Remplacement ciblé des anciennes policies « No guest access » permissives
  ALL par des policies restrictives. Un prédicat historique inattendu provoque
  une erreur de migration, plutôt qu'un remplacement supposé équivalent.
- Références de versions de tentatives réservées au serveur ; instance privée
  liée à une version publiée du bon exercice et de la bonne génération.
  Grants serveur explicites ; DELETE/TRUNCATE des versions et instances privés
  retirés au rôle service. Aucune version historique, seed ou identité catalogue
  n'est inventée et aucune ligne historique n'est modifiée par cette migration.
- Route GET `/api/exercises` : rejet des identités Auth anonymes vérifiées,
  réponses privées sans cache et `Vary: Origin`, diagnostic interne non renvoyé
  au client. Les propositions existantes de contrôle bearer/admin et projection
  du catalogue sont préservées. Ajout de cinq tests serveur de sécurité.
- Banc SQL réel existant : verrouillage des connexions sur les seules adresses
  loopback sans options de substitution d'hôte ; neuf tests de ce garde-fou.
  Les refus SQL doivent correspondre aux SQLSTATE déclarés. Le test obsolète
  visant une colonne supprimée est remplacé par la contrainte NOT NULL du seed
  de la vraie table d'instances privées ; les fixtures ont un titre explicite.
- Ajout d'un banc embarqué avec pgcrypto réel, d'un banc de sécurité PostgreSQL
  avec fixtures annulées et d'un runbook de rejeu sur une instance neuve sans
  réseau. Le runbook attend le listener final, pas le serveur temporaire
  d'initialisation, et arrête uniquement le conteneur qu'il crée, sans effacer
  son volume ou réinitialiser la base locale existante.

Cette migration 23 et les nouveaux scripts/tests proviennent de la présente
intervention autorisée, ce qui précise leur origine dans l'audit parallèle
`Novlearn/docs/audits/2026-10-novlearn-admin-final-validation.md`.

## Vérifications réellement effectuées

| Vérification                                               | Résultat et limite                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rejeu des 48 migrations                                    | PASS, image locale `public.ecr.aws/supabase/postgres:17.11.0.003`, conteneur neuf `--network none`, SQL `ON_ERROR_STOP=1`, empreintes inchangées. Le helper structurel `auth.jwt()` vient du Supabase local ; aucune donnée Auth n'est exportée. |
| Intégration SQL sur `127.0.0.1:54322`                      | PASS, 30 assertions, dont vrai SHA-256 comparé à Node, immutabilité, approbation invalidée, pointeur/version, tentatives, duels et rôles. Retest après renforcement des SQLSTATE : PASS. Transaction annulée.                                    |
| Sécurité SQL réelle locale                                 | PASS, 26 assertions : INSERT/UPDATE/upsert de rôle, identité, lectures privées, invité, anon, rôle service et fixtures annulées.                                                                                                                 |
| PostgreSQL embarqué PGlite                                 | PASS, 57 assertions, vrai pgcrypto et comparaison Node. Auth/ACL synthétiques : preuve complémentaire au vrai Supabase, pas remplacement.                                                                                                        |
| Garde des URL de test                                      | PASS, 9 tests ; hôtes distants, IP LAN et options de connexion refusés.                                                                                                                                                                          |
| Route API NovLearn                                         | PASS, 9 tests (4 existants + 5 nouveaux).                                                                                                                                                                                                        |
| Frontend complet NovLearn                                  | PASS, 183 tests ; 9 todo préexistants restent visibles, sans ajout de skip.                                                                                                                                                                      |
| Backend NovLearn, commande générale `npm test`             | ÉCHEC initial : 150 PASS, 30 erreurs, `DEBUG=release` invalide dans la configuration locale. La chaîne s'arrête avant les autres suites.                                                                                                         |
| Backend, runner existant `npm run test:correction:backend` | PASS, 180 tests avec configuration fictive et dépendances mockées ; aucun changement de test ou d'environnement réel.                                                                                                                            |
| Serveur duel NovLearn                                      | PASS, 63 tests.                                                                                                                                                                                                                                  |
| Types et lint des changements frontend                     | PASS, `npm exec -- tsc --noEmit` et ESLint de la route et du nouveau test.                                                                                                                                                                       |
| Engine, `npm run check`, deux exécutions                   | ÉCHEC chacune : build/types/lint/format PASS ; 1532 PASS / 1 FAIL, 29 fichiers, 351,76 s puis 358,68 s. Aucun skip ni limite assouplie.                                                                                                          |
| Engine hôte/CLI, relance ciblée                            | PASS, 40 tests / 2 fichiers, 18,98 s. Ce résultat ne remplace pas les deux échecs globaux.                                                                                                                                                       |
| Engine `pack --dry-run` et `smoke:package`                 | PASS, tarball réellement installé, imports/types/API et bundle browser. SHA-256 du tarball : `f5a1f0c5e2067a8402bdfbce9f1149dd3ca11c4a1d6b2aed5fe6c8cefa38bdab`.                                                                                 |
| Engine Python/FastAPI officiel                             | PASS, 13 tests, 60,576 s, conteneur sans réseau et quotas du script existant. La permission d'exécution PowerShell est limitée au processus de test, pas changée globalement.                                                                    |

Le smoke test antérieur des propositions passe également, avec digest simulé
et sans RLS ; il ne constitue pas la certification retenue ici.

Le socle Admin est également revérifié par `npm run check` : 61 tests, types,
lint, format, build standalone et smoke Auth passent. `.env.example`, le CDC
et le document de design fourni restent identiques en octets à leur état
préexistant. Les modifications et preuves NovLearn restent dans son arbre de
travail local, pour préserver le travail parallèle ; aucun commit ou push de
ce dépôt n'est effectué par cette intervention.

L'échec Engine courant concerne
`tests/node-host.test.mjs:72`, « runs the real public engine, preserves raw
source and isolates names ». La réponse `real1` est `ok:false, error:timeout`
après 10 228 ms puis 10 138 ms. La cause précise du dépassement n'est pas
établie ; le succès ciblé montre une dépendance au contexte d'exécution, sans
prouver la qualification globale Windows. Aucune source Engine n'est corrigée.

Le manifeste [des 48 sources rejouées](lot-1a-local-replay-manifest.json)
identifie les octets testés. Les résultats concernent cette photographie locale.
Les documents Engine antérieurs ne sont pas réécrits avec ces nouvelles mesures.

## Reste obligatoire avant application distante

1. Corriger et requalifier le timeout Engine dans son dépôt avec autorisation
   dédiée : suite complète verte, sans élargir les limites pour masquer la panne,
   puis qualification du runtime effectivement retenu. Les contrôles package et
   Python réussis ne satisfont pas seuls cette porte.
2. Terminer le rapprochement de l'historique distant (70 entrées contre 48
   fichiers locaux, 25 statements absents au relevé précédent), et le diff des
   schémas, fonctions, grants, triggers et dépendances. Le rejeu local vert ne
   permet ni `migration repair` ni `db push` automatique. Les fichiers historiques
   010/022/028 modifiés localement ne doivent pas être rejoués sur une base existante.
3. Fermer les lectures historiques des réponses d'exercices et des attributs
   privés des autres profils après adaptation des consommateurs. Ces accès
   restent ouverts dans les migrations présentes : `profiles_select_others`,
   SELECT sur `exercises`, RPC historique et anciens chemins service. Le contrôle
   GET générique ne protège pas toutes ces routes. L'Engine non certifié bloque
   encore la transition vers la correction/instance officielle serveur.
4. Finaliser la revue des fonctions privilégiées historiques, les droits de
   lecture Production et du principal de publication techniquement limité.
   Le RPC local d'activation d'une version n'est pas le mécanisme de promotion
   Staging → Production approuvé et ne doit pas être présenté comme tel.
5. Valider le mapping catalogue interbases et la compatibilité des lecteurs,
   sauvegarde/PITR, restauration sur copie et stratégie de migration en avant.
   Le rollback des fixtures prouve l'isolation du banc, pas une restauration
   de sauvegarde. Aucun reset d'une base contenant des données n'est proposé ici.
6. Préparer un plan incrémental revu sur les schémas vivants, puis obtenir une
   autorisation distincte pour Staging ; Production et mise en service restent
   des décisions séparées. Maintenir l'accès Auth Admin désactivé jusque-là.

## Reproduction locale dans NovLearn

```powershell
node --test scripts/local-database-url.test.mjs
node scripts/test-novlearn-admin-embedded.mjs
node scripts/test-novlearn-admin-local.mjs
node scripts/test-novlearn-admin-security-local.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/replay-novlearn-admin-isolated.ps1
```

Les deux bancs réseau n'acceptent qu'un PostgreSQL loopback. Le dernier script
requiert l'image PostgreSQL déjà installée et le conteneur Supabase local pour
capturer le helper Auth ; il ne télécharge pas d'image ni ne contacte un projet
Supabase distant. Ses artefacts sont dans `.local/admin-sql-replay/`.

Les garanties de composition RLS et de différence entre rôle `anon` et compte
Auth anonyme sont revérifiées dans les [docs Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
et [Auth anonyme](https://supabase.com/docs/guides/auth/auth-anonymous). Le trigger
invoker s'appuie sur le rôle SQL effectif `current_user`, selon [PostgreSQL](https://www.postgresql.org/docs/current/functions-info.html).
