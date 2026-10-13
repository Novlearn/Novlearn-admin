# Lot 1A — restauration locale et confidentialité des profils

Complément du 13 octobre 2026 au [bilan précédent](lot-1a-local-validation.md).
Cette reprise traite deux prérequis SQL indépendants de la certification
Engine bloquée. Les résultats Engine restent ceux des exécutions précédentes.
**Le Lot 1A et l'objectif Admin complet restent incomplets.**

## Source et autorisation

D04 autorise les corrections NovLearn et migrations locales du Lot 1A. Aucun
projet distant, source Engine, déploiement ou donnée existante n'est modifié.
La base Supabase locale de travail n'est pas réinitialisée ou modifiée pendant
cette reprise : seuls des conteneurs de certification neufs sans réseau sont
utilisés. Les fixtures et volumes sont conservés après arrêt.

## Bootstrap de certification corrigé

L'image PostgreSQL nue possède un ancien schéma Auth. Le rejeu DDL de 48
migrations du relevé précédent ne testait pas à lui seul le runtime complet
Auth : la création de la fixture a échoué sur `email_confirmed_at` absent.
Le runbook NovLearn exécute maintenant les migrations embarquées du binaire
officiel **Supabase Auth 2.197.0**, déjà installé localement, avant les migrations
applicatives. Le socket Unix et le rôle SQL `supabase_auth_admin` sont utilisés
dans la seule instance de certification ; aucune configuration ou clé réelle
du service Auth existant n'est copiée. Le secret de configuration nécessaire
est une constante de fixture, et aucun serveur HTTP Auth n'est démarré.

Le binaire est relevé par SHA-256
`f2aa147268461f74784ddc8b2240aa446ee71ceb9633bac41c30e7b852a860aa`.
Les runbooks refusent les endpoints Docker distants : la connexion utilisée
est le named pipe local `dockerDesktopLinuxEngine`. Ils ne téléchargent pas
d'images et n'utilisent jamais un reset ou `pg_restore --clean`.

La commande officielle [`auth migrate`](https://github.com/supabase/auth)
est vérifiée dans le point d'entrée de la version installée. Les erreurs
d'ownership rencontrées sur le premier prototype ont été corrigées dans le
bootstrap de fixture, sans relâcher les droits ou les critères des migrations.

## Fermeture des profils et adaptation des lecteurs

La nouvelle migration canonique locale
`20261013174724_novlearn_profile_privacy.sql` :

- Ferme la lecture complète des autres profils aux utilisateurs ordinaires,
  avec une policy restrictive ; conserve son propre profil et la lecture
  administrative contrôlée. La protection de rôle du fichier 23 reste requise.
- Expose `get_public_profiles(uuid[])` uniquement aux identités Auth permanentes,
  avec au plus 100 UUID explicites par appel. Elle retourne exactement `id`,
  `first_name`, `last_name`, `avatar_id`, `avatar_color`, selon la proposition
  sociale existante ; aucun email, date de naissance, rôle ou attribut privé.
- Protège `admin_get_profile` par le contrôle Admin commun qui refuse les
  invités, y compris si une fixture leur attribue un rôle Admin.
- Corrige la comparaison NULL de `get_friends_and_requests`, ferme l'accès
  croisé et retire l'email des amis. Aucun consommateur de ce RPC historique
  n'a été trouvé dans le frontend/backend ; l'API amis existante sélectionne
  déjà des champs publics sans email.

Le lecteur d'avatars du duel et les noms d'auteurs des feedbacks utilisent le
RPC minimal. Les auteurs sont demandés par lots de 100, ce qui conserve le
parcours tuteur sans réouvrir les profils privés. Les lecteurs personnels,
la requête de statistiques des administrateurs et les routes backend avec
sélection publique explicite restent compatibles avec ces policies.

Cette migration est **préparée et testée sur les instances de certification**.
Elle n'est pas appliquée en Staging/Production ni sur la base locale de travail.
Le code et le SQL doivent être livrés ensemble après leurs portes de validation.

## Sauvegarde et restauration démontrées

`test-admin-backup-local.ps1` ne peut cibler qu'un conteneur de rejeu isolé et
arrêté. La préparation refuse une source contenant une identité ou un historique
existant. Deux comptes synthétiques, une amitié acceptée, une version publiée,
un pointeur actif, une tentative sans version, une tentative versionnée, les
instances privées et une manche de duel sont ajoutés dans cette source neuve.

La définition canonique schéma 5 vient du fixture Engine existant
`rational-minimum.definition.json`. `validateDefinition` puis
`instantiateExercise` sont appelées via l'API publique de son package, avec
seed 42 et génération `mulberry32-rejection-v1`. Aucune logique mathématique
locale concurrente ni version historique fictive n'est créée.

Une archive logique complète `pg_dump --format=custom` est restaurée avec
`pg_restore --exit-on-error --single-transaction` dans une nouvelle base vide
d'un autre conteneur sans réseau. Owners et ACL sont conservés. L'archive reste
hors Git ; sa SHA-256 est
`1107075dd1c5d810b0fa18ca127a4410a2f23aa3455f0ccbde744db4e83c1341`.
Le [rapport machine](lot-1a-local-restore-proof.json) contient seulement les
empreintes, versions et résultats, aucune archive ni ligne de données.

## Vérifications et portée

| Contrôle                           | Résultat                                                                                                                                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rejeu avec bootstrap Auth officiel | **49 migrations PASS**, hashes des sources vérifiés, aucun fichier ignoré.                                                                                                                                                                               |
| Source → archive → restauration    | **PASS logique**, SHA-256 des lignes de toutes les tables `public`/`auth`, séquences, colonnes/types/defaults, RLS, policies, contraintes, indexes, fonctions, triggers, ACL, owners, schemas/default ACL, extensions, rôles et memberships concordants. |
| Droits après restauration          | **35 assertions PASS**, dont profils privés, projections, bornes, invités/anon, rôle service, immutabilité et identité NULL/croisée de la liste d'amis. Transaction des assertions annulée.                                                              |
| Comparateur de snapshots           | **11 tests PASS**, refus de données modifiées/perdues, grants/options ajoutés, changement d'owner/RLS, contraintes ou séquence, nullabilité et ordre des colonnes.                                                                                       |
| Frontend NovLearn                  | Types **PASS**, lint des deux lecteurs **PASS**, **183 tests PASS / 9 todo préexistants**.                                                                                                                                                               |
| Sources Engine                     | Git propre, aucune modification. Certification globale toujours bloquée par les deux `check` précédents à **1532 PASS / 1 FAIL**.                                                                                                                        |

La comparaison brute ne donne **pas** une identité bit à bit : les ACL ont leurs
entrées réordonnées et les colonnes Auth supprimées laissent des trous d'ordinal
dans la source, compactés à la reconstruction. Les snapshots bruts et leurs
différences restent archivés (`rawSnapshotMatched:false`). Le comparateur
normalise seulement l'ordre d'un ensemble ACL et l'ordre relatif des colonnes
visibles ; il conserve chaque privilège, grant option, owner, type et contrainte.
Une ACL avec syntaxe non supportée est refusée, jamais ignorée. Cela démontre
une restauration logique applicative, pas une restauration physique identique.

Les [options de pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) et
[pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) sont revérifiées
dans PostgreSQL 17. La présence de rôles compatibles sur la cible est testée ;
une archive de base ne provisionne pas les globals d'un futur serveur.

## Reste avant ouverture des lots suivants

La restauration sur fixtures prouve le chemin local, pas une sauvegarde/PITR
réelle de Staging ou Production, les secrets externes ni les transports HTTP
Auth/OAuth. L'historique et les schémas distants restent à réconcilier, puis
leurs migrations incrémentales et restauration doivent être revues et autorisées.
Les lectures historiques d'exercices/attendus et leurs chemins privilégiés
restent à fermer après adaptation des consommateurs.

La certification Engine Windows reste non validée. Une autorisation distincte
de correction locale de ses sources est demandée, selon AGENTS et le goal
initial ; aucun accord n'est déduit d'une continuation automatique. Le succès
du cœur utilisé pour la fixture ne remplace pas la qualification du worker.
L'Auth Admin reste désactivée, aucun lot fonctionnel suivant n'est ouvert.

## Reproduction locale

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/replay-novlearn-admin-isolated.ps1
# Utiliser le nom du NOUVEAU conteneur indiqué dans les artefacts de ce rejeu.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-admin-backup-local.ps1 -SourceContainer novlearn-admin-lot1a-replay-<horodatage>
node --test scripts/compare-admin-backup.test.mjs
```

Les comptes de fixture sont conservés seulement dans le volume de certification.
Pour refaire le banc complet, créer un nouveau rejeu ; ne pas supprimer ou
réutiliser silencieusement les données d'une précédente fixture. Les archives,
snapshots, binaires et logs sont ignorés dans `.local/admin-sql-backup/` et
`.local/admin-sql-replay/`. Les changements NovLearn restent non committés afin
de préserver le travail préexistant et parallèle.
