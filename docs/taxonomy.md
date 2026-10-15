# Chapitres et compétences — gestion locale Staging

Le Lot 6 est implémenté et vérifié localement, avec activation distante fermée.
D02/D07 autorisent ce travail indépendant pendant que la publication et les
portes du Lot 1A restent ouvertes. Le CDC n'est pas modifié.

## Parcours

`/admin/chapters` propose recherche, liste paginée de 25, création, édition du
nom, ordre, emoji et alias, puis consultation des compétences associées.
`/admin/competences` ajoute le filtre chapitre, un identifiant texte stable,
le rattachement et le maximum de points. Les liens d'exercices conservent les
`bigint` en chaînes ; les 25 premiers liens et le nombre total sont distingués.

Un renommage de chapitre conserve son ancien nom comme alias. Retirer un alias
encore référencé est refusé. Les identifiants existants ne sont jamais réécrits.
Un nom de compétence utilisé comme référence ne peut pas être renommé ; une
compétence liée à des exercices/révisions/scores ne peut pas changer de chapitre.
Modifier son maximum ne réécrit ni ne recalcule les scores existants.

Les formulaires conservent les champs après erreur ou conflit. Une confirmation
intégrée permet d'annuler une fermeture ou un changement de fiche. Le focus va
au titre de l'éditeur. La garde de navigation commune reste utilisée ; la
réception complète du bouton Retour SPA reste la limite documentée de l'éditeur.
La suppression exige une confirmation distincte et un nouveau contrôle SQL.
Elle n'est permise que pour une fiche sans dépendance ; aucune suppression
d'une donnée préexistante n'a été exécutée pendant ces vérifications.

## SQL et autorisations

Migration propriétaire, commit NovLearn local `c7e9f9e` :
`20261015072729_novlearn_admin_taxonomy.sql`.

Les deux RPC `admin_list_taxonomy` et `admin_mutate_taxonomy` sont des fonctions
à corps SQL fixe, `SECURITY DEFINER`, namespace vide, EXECUTE réservé à
`authenticated`. Chaque appel revérifie `is_novlearn_admin()` : profil réel et
session non invitée. Ce choix évite d'ouvrir l'écriture directe des tables et
permet de compter les dépendances de scores sans exposer leurs utilisateurs.
Les helpers privés sont invoker et sans EXECUTE API. Les rôles de publication
n'obtiennent aucun nouveau grant.

L'API `/api/admin/taxonomy` conserve la configuration Staging existante, fermée
par défaut. Chaque GET/POST refait la vérification Auth/du rôle. POST impose
l'origine exacte, JSON borné réellement à 16 Kio et un schéma fermé ; aucune
destination Production ni identité d'audit n'est acceptée du navigateur.
Les réponses sont privées `no-store`, les erreurs SQL détaillées sont masquées.

Les écritures API directes des chapitres/compétences sont révoquées. Un compteur
`admin_epoch` contrôlé par trigger et l'empreinte complète de la ligne empêchent
une sauvegarde périmée, même après édition puis revert. Les opérations réussies
écrivent dans `admin_taxonomy_events` leur acteur Auth, action et avant/après
dans la même transaction. Cette table est lisible seulement par un Admin ; les
rôles API n'ont aucun droit d'y fabriquer ou modifier un événement.

Les dépendances couvrent parents historiques, JSON historique, catalogue des
révisions canoniques, flashcards, compétences filles et les deux tables de scores.
Le JSON historique est parcouru de façon conservatrice : une valeur chaîne
égale à une référence peut bloquer la suppression, sans conversion implicite.
Les anciennes définitions, tentatives et scores ne sont jamais réécrits.

Les mutations rares du référentiel prennent des verrous de table pour sérialiser
leur contrôle avec les écritures de références sans FK. Cela ferme la course
entre décompte et suppression ; ce choix peut temporairement attendre ou bloquer
d'autres écritures. La durée sur un jeu Staging représentatif reste à mesurer
avant activation. Les fonctions ne copient aucune taxonomie en Production.

## Vérifications exécutées

- **39 assertions PostgreSQL**, puis les mêmes après dump/restore dans une autre
  base du même cluster local : CRUD, permissions, rôle révoqué, alias, dépendances
  canoniques/historiques/flashcards/scores, stabilité des IDs, conflit et audit.
- Les fixtures sont annulées ; les **59 tables** retrouvent leurs lignes et
  empreintes. Les **58 tables préexistantes** conservent toutes leurs anciennes
  colonnes à travers la migration. Seules les deux nouvelles colonnes
  `admin_epoch` sont exclues de cette comparaison de colonnes anciennes.
- Deux sessions de modification du même chapitre avec la même empreinte donnent
  exactement **un commit et un conflit `40001`**, une époque et deux événements
  d'audit (création + édition gagnante). Le perdant ne laisse aucun événement.
- Les **48 assertions catalogue, 21 reçus et 43 relecture** passent après ajout.
- `npm.cmd run check` : **257 tests / 21 fichiers**, archive Engine, types, lint,
  format, build et smoke standalone passent. Le smoke refuse aussi les accès
  directs aux nouvelles pages et à l'API tant que l'activation est fermée.
  Un avertissement `<img>` préexistant demeure dans le banc catalogue.
- Banc navigateur synthétique : liste, édition, annulation de fermeture,
  conservation des champs sur 409, états vide/panne, ID readonly, focus,
  Inter locale, logo et palette. Vérification desktop et viewport demandé
  390 px, sans débordement global après correction ; le tableau défile localement.
  [Desktop](taxonomy-local.jpg) · [Mobile](taxonomy-mobile-local.jpg).

Les échecs intermédiaires restent conservés : compteur temporaire sans droit
INSERT anon, total de tests attendu incorrect, dialogue natif du navigateur
interrompu, débordement du texte masqué mobile et délimiteur du nouveau
comparateur SQL. Les corrections concernent le banc ou le produit ; aucune
assertion n'a été supprimée ou affaiblie. Le dialogue intégré garde l'obligation
de confirmer et permet explicitement d'annuler.

## Reproduction et limites

Les scripts permanents acceptent seulement un conteneur local de rejeu nommé,
en réseau `none`, et des bases de fixtures reconnues. Ils conservent les copies :

```powershell
node scripts/test-taxonomy-local.mjs novlearn-admin-lot1a-replay-20261015061424058 admin_friend_trigger_1792047994904
# Utiliser ensuite le nom admin_taxonomy_<timestamp> indiqué par la preuve :
node scripts/test-taxonomy-concurrency-local.mjs novlearn-admin-lot1a-replay-20261015061424058 admin_taxonomy_1792049908226
```

Il s'agit d'un ajout incrémental au clone déjà qualifié, pas d'un rejeu neuf de
57 migrations. La restauration utilise les rôles du même cluster ; bootstrap
neuf, séquences et manifeste structurel complet ne sont pas recertifiés ici.
Les séquences des seules copies synthétiques peuvent avancer malgré ROLLBACK.
Les fixtures Auth SQL et le fetch simulé du navigateur ne certifient pas une
session Auth réelle ou un parcours navigateur relié à Supabase.

La [preuve machine](taxonomy-local-proof.json) conserve empreintes et périmètres.
La qualification complète de publication, le contrôle de sécurité précédemment
refusé et les autres lots restent ouverts. Avant usage distant : rejeu complet
de l'arbre final, réconciliation SQL, revue des permissions/temps de verrouillage,
sauvegarde réelle, validation Auth et autorisation distincte. Aucun changement
distant, push ou déploiement n'est effectué.
