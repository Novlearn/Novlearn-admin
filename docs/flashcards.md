# Flashcards — intégration locale Staging

Le Lot 7 dispose de son interface, de son API et de ses contrôles SQL locaux.
Sa réception visuelle reste **bloquée par la politique du navigateur**. Le lot,
le Lot 1A et le goal global ne sont donc pas déclarés terminés. Aucun accès
distant, publication ou déploiement n'a été activé.

## Fonctionnement

`/admin/flashcards` propose recherche, filtre chapitre, pagination de 25,
création, édition, aperçu recto/verso et suppression avec confirmation.
Les champs sont conservés en cas d'erreur ou de conflit. Les références non
résolues exigent un choix explicite du chapitre avant sauvegarde.

Le formulaire utilise les composants, polices locales Inter/Fredoka, couleurs
et SVG existants. MathLive insère le LaTeX exact à la sélection du texte.
Les délimiteurs `$...$` et `$$...$$` servent uniquement à la présentation,
conformément au lecteur élève examiné en lecture seule. Le texte et ses espaces
sont conservés ; aucune génération ou correction mathématique n'est ajoutée.
L'aperçu React échappe le texte. L'interaction MathLive dans ce nouvel écran
n'a pas été vérifiée dans un navigateur.

## Permissions et données

Migration propriétaire NovLearn, commit local `62629ac` :
`20261015100454_novlearn_admin_flashcards.sql`.

Les RPC `admin_list_flashcards` et `admin_mutate_flashcard` revérifient le profil
Admin Staging et la session non invitée à chaque appel. L'écriture directe API
est révoquée. Les helpers privés sont invoker, sans EXECUTE API ; les fonctions
privilégiées utilisent un namespace fixe. Les lectures publiques existantes
ne sont pas remplacées.

L'API `/api/admin/flashcards` reprend la configuration fermée par défaut et
le contrôle serveur Auth existants. POST exige l'origine exacte, du JSON borné
réellement à 64 Kio et un contrat fermé. Seuls chapitre, question et réponse
sont éditables ; chaque texte est limité à 4 000 caractères. Identité, date,
acteur d'audit et destination ne sont pas fournis par le navigateur. Les erreurs
détaillées sont masquées ; les réponses sont privées `no-store`.

Un compteur `admin_epoch` et l'empreinte de la ligne empêchent les éditions
périmées, y compris après modification puis retour au contenu initial.
`admin_flashcard_events` conserve l'acteur et l'avant/après dans la transaction,
y compris après suppression. Les tests de suppression portent sur des fixtures
synthétiques ; aucune donnée existante n'a été supprimée.

Le stockage conserve le nom exact du chapitre, requis par le filtre du lecteur
élève actuel. Un trigger refuse désormais de renommer un chapitre dont le nom
est utilisé par une flashcard : ajouter un alias seul ne suffirait pas à
préserver cette lecture. Les mutations se synchronisent avec celles du
référentiel. Les flashcards ne sont pas transférées en Production par la V1
de publication.

## Résultats réellement exécutés

Les [preuves et empreintes](flashcards-local-proof.json) renvoient aux artefacts
locaux conservés, sans remplacer les journaux bruts.

- `npm.cmd run check` : **302 tests dans 23 fichiers**, intégrité de l'archive
  Engine, types, format, build et smoke standalone réussis. Le smoke vérifie
  aussi le refus des nouvelles pages et API avant activation. Le lint ne
  signale aucune erreur ; un avertissement `<img>` préexistant demeure dans
  le banc catalogue.
- **38 assertions flashcards** passent avant et après restauration sur copie :
  permissions, rôle révoqué, contrats, conservation du texte, références,
  recherche littérale, conflits, audit et protection du renommage de chapitre.
  Les anciennes colonnes des **59 tables préexistantes** sont conservées ;
  seule la nouvelle colonne `public.flashcards.admin_epoch` est exclue de
  cette comparaison. Les snapshots des **60 tables** correspondent après
  annulation des fixtures et restauration. Ce contrôle incrémental ne compare
  pas les séquences.
- Deux sessions d'édition avec la même empreinte donnent un commit et un
  conflit `40001`, une époque et deux événements (création + édition gagnante).
- Un **rejeu neuf des 58 migrations** passe ensuite dans un nouveau conteneur
  PostgreSQL local isolé. Il qualifie l'arbre local, y compris les anciennes
  modifications SQL préexistantes ; ce n'est pas un rejeu d'un clone Git propre
  ni une réconciliation de l'historique distant.
- Le parcours **Engine natif Linux, signature HMAC, reçu SQL et relecture
  synthétique** passe sur ce rejeu, avec deux seeds et une seule approbation
  acceptée entre deux sessions concurrentes. Cela ne remplace ni une véritable
  relecture pédagogique ni une nouvelle exécution complète des tests source Engine.
- Une sauvegarde/restauration dans un autre conteneur passe avec le comparateur
  existant : données, structure, droits et séquences correspondent après ses
  normalisations documentées. **La comparaison brute n'est pas identique** :
  sections `columns`, `functions`, `relations` (ordre des ACL et trous de colonnes
  supprimées). Aucun critère du comparateur n'est modifié. Les **69 assertions
  historiques de sécurité** passent après restauration.
- Sur cette restauration des 58 migrations, les suites **48 catalogue,
  21 reçus, 43 relecture, 39 référentiel et 38 flashcards** passent.

L'échec initial du build (`EPERM` sur `.next`) est conservé séparément ; le
contrôle complet final a réussi sous le compte propriétaire via l'autorisation
normale de l'outil. Aucune permission Windows ou protection n'a été modifiée.
Les erreurs intermédiaires du nouveau lanceur SQL et d'une expression de
fixture ont été corrigées sans retirer d'assertion ni réduire leur nombre.

## Blocage visuel et suite autorisée

Le navigateur intégré a refusé l'autorité d'observer la page à cause de sa
politique d'URL, avec instruction explicite de ne pas utiliser un autre moyen
de pilotage pour obtenir le même résultat. Aucun autre navigateur, protocole
de commande ou capture indirecte n'a été employé après ce refus. Aucun test
visuel flashcards ni capture d'écran n'est annoncé comme réussi.

Une personne peut effectuer la réception manuelle du banc synthétique existant :
lancer `node scripts/content-browser.mjs`, puis ouvrir elle-même
`http://127.0.0.1:3140/tests/browser/flashcards.html`. Saisir `stop` dans le
terminal arrête le banc. Il n'utilise ni compte ni base Supabase. Contrôler
saisie MathLive, aperçu, confirmation annulable, conservation après conflit,
focus et petits écrans ; enregistrer les résultats effectivement observés.
Le pilotage automatique nécessite une session dont l'autorité navigateur est
normalement accordée, sans affaiblir les protections.

La publication complète (service, journal durable, confirmation individuelle
et groupée), la réception restante du Creator, les statistiques/utilisateurs
et la mise en service restent ouvertes. Avant toute application distante :
réconcilier l'historique SQL, obtenir sauvegarde/PITR réel, vérifier la
compatibilité élève, provisionner comptes/secrets/hébergement séparés et
recueillir l'autorisation explicite. La qualification complète du confinement
de publication reste distincte des contrôles ordinaires exécutés ici.
