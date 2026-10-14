# Catalogue Admin — implémentation locale

Le 14 octobre 2026, D07 autorise la construction locale d’Admin sur le schéma
NovLearn préparé. Les corrections de l’application élève sont hors périmètre.
Le catalogue n’est pas activé à distance ; Auth reste fermée par défaut.

Les migrations 24–27 sont enregistrées dans le commit NovLearn local
`766fd1d`. Le rejeu qualifié porte sur les empreintes de l’arbre local complet,
y compris les corrections historiques préexistantes 010/022/028 ; ces dernières
ne sont pas incorporées au nouveau commit. Ce résultat ne prétend pas qualifier
un clone Git propre ou un historique distant déjà réconcilié.

## Fonctionnement implémenté

- `/admin/exercises` : recherche par titre/ID, statut, tri et pagination de 25,
  métadonnées de la dernière révision et version active **Staging** distinguée.
- `/admin/exercises/new` : création d’un brouillon canonique schema 5 ; titre,
  titre application, chapitre, difficulté ordinale positive, compétences,
  format classique/flash et calculatrice. Aucune édition manuelle de JSON requise.
- `/admin/exercises/[id]` : édition des métadonnées d’un brouillon, création
  d’une nouvelle révision depuis une version conservée, duplication indépendante,
  archivage/restauration avec confirmation, historique paginé et diff structurel.
- Les anciennes définitions restent identifiées « historique » et en lecture
  seule. Leur contenu, IDs et anciennes tentatives ne sont pas convertis.
- Le formulaire préserve sa saisie en cas d’erreur, signale les changements non
  enregistrés et confirme fermeture/rechargement ou navigation par lien.

Le brouillon initial sans élément est **incomplet** : le validateur officiel
Engine renvoie son diagnostic `/elements`. Sauvegarder ne signifie ni valider,
ni approuver, ni publier. Le Creator visuel, ses diagnostics mathématiques,
son aperçu et la publication restent des lots suivants. Le formulaire actuel
ne prétend pas couvrir les éléments/questions/variables du Creator. La garde
du bouton navigateur « Retour » pendant une navigation SPA reste à compléter
dans ce lot d’édition.

## SQL et permissions

Migration propriétaire :
`Novlearn/supabase/migrations/20261013231328_novlearn_admin_catalogue_workflow.sql`.
Elle ajoute `exercises.admin_archived_at`, les policies Admin ciblées,
la table d’événements éditoriaux `admin_content_events` et quatre RPC
**SECURITY INVOKER**, avec namespace vide et grants explicites :
`admin_list_exercises`, `admin_save_exercise_draft`, `admin_duplicate_exercise`,
`admin_archive_exercise`.

Les RPC revérifient le rôle DB réel et appliquent RLS. Les nouveaux parents de
brouillons sont masqués aux élèves/anon ; ils n’embarquent pas d’attendus dans
`exercises.content`. La liste projette les métadonnées, jamais la définition
privée. `bigint` est transporté en chaîne pour préserver sa précision.
Les identités canoniques et numéros de révision sont attribués par SQL.
Une sauvegarde existante exige l’empreinte actuelle et le statut `draft`.
Le verrou du parent sérialise l’attribution des révisions ; une mauvaise
empreinte renvoie `40001`, traduite en HTTP 409. La version publiée est immuable.
Archivage et restauration gardent le pointeur actif et toutes les révisions.
Chaque mutation écrit son acteur vérifié et son événement dans la transaction.

Chaque appel API refait `getUser()` et la lecture du rôle serveur. POST exige
l’origine exacte de l’Admin, JSON UTF-8 réellement limité à 256 Kio et une action
connue. Aucune destination Production ou approbation venant du navigateur n’est
acceptée. Les erreurs DB sont masquées ; réponses privées `no-store`.
Le SDK utilise la session de l’Admin Staging, sans clé service role.

L’archivage est éditorial : il ne dépublie pas un exercice côté élève. Les
anciens lecteurs à clé service et RPC `SECURITY DEFINER` doivent encore être
adaptés avant une activation réelle ; les nouvelles policies ne les bornent
pas. L’ancienne suppression API et ses FK `SET NULL` restent une porte de
rétention à traiter séparément. Aucun DELETE n’est exposé par l’Admin.

## Vérifications réelles

- Rejeu complet : **52 migrations** dans un nouveau PostgreSQL Supabase
  17.11.0.003 avec Auth officiel 2.197.0, réseau désactivé, sources en lecture seule.
- **47 assertions catalogue** sous les rôles effectifs : refus élèves/anon/
  invités, faux rôle metadata, permissions/audit, empreintes pgcrypto, sauvegarde
  périmée, duplication, conservation des versions, protection des attentes
  privées, archivage réversible et absence de conversion des anciennes tentatives.
- Backup logique restauré dans une autre base neuve : comparateur existant
  données/schéma/ACL/séquences positif, **69 assertions de sécurité existantes**
  inchangées, puis les mêmes **47 assertions catalogue** positives sur la restauration.
- Concurrence réelle dans une troisième base de fixtures neuve : deux sessions
  de sauvegarde avec la même empreinte produisent exactement **un commit et un
  refus `40001`** ; deux créations simultanées produisent les révisions **2 et 3**.
  Le journal conserve quatre événements, sans événement du perdant. La base
  source et ses sessions de fond sont préservées. Le premier essai de copie
  par template a refusé des sessions actives ; une copie logique dump/restore
  a permis le test, sans terminer ces sessions ni changer les assertions.
- **98 tests Admin** couvrent Auth, routes, refus et contrats. Les doubles SDK
  restent distingués des assertions PostgreSQL réelles. `check` couvre aussi
  types, lint, format, build standalone, assets et refus HTTP directs du catalogue.
  Lint : zéro erreur, un avertissement Next relatif à l’image SVG du banc Vite ;
  le produit utilise déjà `next/image`. Les critères n’ont pas été assouplis.
- Contrôle visuel du catalogue et du formulaire dans Brave via un banc Vite
  local étiqueté synthétique : logo, polices locales, palette, états vide/panne,
  conflit 409 et conservation des champs. Aucune connexion Supabase.
  Catalogue et formulaire ont aussi été vérifiés à 390 px, sans débordement
  horizontal global ; le tableau possède sa propre zone de défilement.
- `npm run verify:engine` contrôle SHA256 de l’archive certifiée et SHA512 du
  lockfile ; Cortex est fixé à 0.151.0. Deux tests passent par le vrai validateur
  structurel Engine ; ils ne prétendent pas qualifier des calculs utilisateurs.

`scripts/test-catalogue-local.ps1` accepte uniquement les noms de conteneurs
de tests locaux attendus, sur le pipe Docker Linux local. Les fixtures sont
annulées par `ROLLBACK`, les volumes conservés. `scripts/catalogue-browser.mjs`
sert un banc synthétique sur 127.0.0.1:3139 ; ses ponts de navigation sont propres
au banc et ne sont pas utilisés par Next. Les artefacts temporaires ignorés
`.local/lot1a` sont exclus du lint comme du format ; tous les fichiers produit,
scripts permanents et tests restent vérifiés.

`node scripts/test-catalogue-concurrency.mjs <conteneur-de-rejeu-local>` exécute
le banc de concurrence dans une nouvelle base copiée logiquement. Il conserve
sa base/volume de fixtures et restaure l’état de fonctionnement du conteneur.

## Avant application distante

Réconcilier l’historique et les schémas vivants, accepter les migrations et leur
diff, vérifier backup/PITR réel et rétention, puis organiser la compatibilité
élève dans son intervention séparée. Provisionner et tester un compte Admin
Staging et ses droits/révocations avant activation Auth. Les chapitres et
compétences saisis dans un brouillon devront être validés avant approbation.
La publication Production exige encore la capacité techniquement bornée, le
diff, ses tests et une autorisation distincte. Aucun push ou déploiement effectué.
