# Rapports Engine persistés — état local

Les tests peuvent maintenant être consignés pour une révision **enregistrée**.
Le serveur relit sa définition, vérifie l’empreinte et l’état demandés, exécute
le banc natif, puis relit l’identité et le rôle avant de signer le résultat.
Le navigateur fournit les seeds et cas de réponse ; il ne fournit ni définition
faisant autorité, ni verdict, ni acteur, ni signature. Le rapport consigné et
l’historique restent distincts des tests temporaires du formulaire.

## Preuve et invalidation

La migration propriétaire
`Novlearn/supabase/migrations/20261014202629_novlearn_admin_test_receipts.sql`
ajoute `exercise_versions.test_epoch`, `admin_exercise_test_runs` et un registre
de clés dans `novlearn_admin_private`. Aucun contenu ou statut existant n’est
réécrit. Le compteur avance sur les changements de contenu ou contrat et ne
peut pas être fixé directement par le client. Revenir à un contenu identique
conserve un compteur nouveau : l’ancien rapport reste historique.

Un reçu associe acteur Auth vérifié, révision, empreinte SQL, compteur d’état,
rapport complet, cas, archive Engine certifiée, date et identité unique. Node
signe ses octets UTF8 avec HMAC-SHA256. Le RPC SQL vérifie identité Admin fraîche,
clé active, signature en comparaison de longueur fixe, archive/version Engine,
date et état courant sous verrou. Une course d’édition retourne un conflit 409.
Le même reçu rejoué est idempotent ; aucune mutation de rapport n’est exposée.
Les droits de lecture sont réservés aux Admins ; INSERT/UPDATE/DELETE/TRUNCATE
directs ne sont pas accordés aux rôles API.

Le registre est **vide par défaut**. Les variables serveur
`ADMIN_TEST_SIGNING_KEY_ID` (UUID v4) et `ADMIN_TEST_SIGNING_KEY` (32 octets en
hexadécimal) doivent correspondre à une clé provisionnée séparément par le
propriétaire DB. Aucun secret réel n’est généré, provisionné ou placé dans
`NEXT_PUBLIC_*`. Les clés connues des tests sont exclusivement des fixtures.
`.env.example` préexistant est conservé. Sans configuration valide et registre
correspondant, aucun reçu ne peut être enregistré.

La clé reste inaccessible à `anon`, `authenticated` et `service_role`, dans un
schéma sans accès public et avec RLS. La fonction qui consulte cette clé a un
namespace vide et revérifie le rôle et l’acteur avant toute lecture/mutation.
La signature établit l’origine serveur du rapport ; elle ne remplace pas ces
permissions. Références : [pgcrypto](https://www.postgresql.org/docs/17/pgcrypto.html)
et [fonctions Supabase](https://supabase.com/docs/guides/database/functions).

## Interface

« Tester et consigner la révision enregistrée » est proposé pour une révision
existante. Le bouton précise que les changements du formulaire doivent être
enregistrés pour être inclus. La révision conservée peut aussi être testée sans
être modifiée. Le serveur relit toujours son contenu ; sauvegarder ou tester
ne l’approuve pas.

L’historique affiche les dix derniers rapports, leurs dates, seeds, verdicts et
vérifications par question. Il distingue l’état courant de l’ancien état par
empreinte **et compteur**. Les anciens résultats restent conservés. Une annulation
de navigateur ne prétend pas effacer un rapport déjà commité ; l’historique
permet de vérifier le résultat avant de relancer.

## Vérifications locales

- **53 migrations passent** dans un nouveau PostgreSQL Supabase 17.11.0.003,
  sans réseau, avec bootstrap Auth officiel 2.197.0 et empreintes stables.
- **21 assertions reçus passent avant et après restauration** : HMAC UTF8 Node/
  PostgreSQL, clé privée/inactive, signature falsifiée, acteur, élèves/invités,
  droits directs, idempotence, conservation et invalidation après édition/revert.
  Ces fixtures testent les permissions SQL ; elles ne simulent pas une
  certification mathématique.
- Le parcours réel **Engine Linux borné → Node HMAC → SQL** passe sur une nouvelle
  base de fixtures conservée : contenu relu de SQL, seeds 0/42, corrections,
  signature vérifiée, rapport enregistré et révision toujours en `draft`.
  L’identité Auth est synthétique ; aucun compte distant n’est utilisé.
- La sauvegarde réelle est restaurée sur un nouveau conteneur. Données, colonnes,
  contraintes, index, RLS, privilèges, rôles et séquences concordent. Les **69
  assertions historiques de sécurité** et les **47 assertions catalogue** passent
  inchangées sur la restauration, ainsi que les nouvelles assertions reçus.
- **195 tests Admin**, types, lint sans erreur, format, build et smoke HTTP passent.
  Le seul warning lint reste l’image du banc catalogue synthétique.

Deux écarts intermédiaires sont conservés : l’ancien outil de sauvegarde utilisait
une ancienne fixture, et la table privée restaurée utilisait une ACL NULL plutôt
que l’ACL propriétaire explicite. Aucun test n’est assoupli. Les droits effectifs
ont été comparés directement avec `acldefault`/`aclexplode` PostgreSQL : mêmes
grantees, privilèges et options, aucun droit public ajouté. Le snapshot actuel
inclut le schéma privé et les ACL effectives ; les anciens snapshots bruts restent
archivés. Le comparateur conserve ses 11 tests qui refusent notamment ajout de
grant, changement de propriétaire, désactivation RLS et altération de données.

Les empreintes et artefacts sont dans [test-receipts-local-proof.json](test-receipts-local-proof.json).
Le rejeu qualifie l’arbre SQL local complet, avec les modifications historiques
010/022/028 préexistantes, sans prétendre qualifier un clone Git propre ou
l’historique distant. Le nouveau commit SQL n’inclut que la nouvelle migration.

## Travail restant

**La relecture/approbation n’est pas encore ouverte.** Son contrôle SQL doit exiger
un rapport positif adapté à la version, valider les références pédagogiques,
enregistrer l’attestation humaine et fermer les anciens chemins qui permettraient
une approbation directe sans tests. Aucun reçu ne change un statut éditorial.
La publication sélective reste à construire ensuite, sans copier ces rapports,
acteurs, clés ou autres données internes en Production.

Avant activation distante : réconciliation SQL, sauvegarde/PITR réel, provisioning
sécurisé des clés et du compte Admin, révocation, qualification de l’hébergement
complet et compatibilité élève. Le rôle de publication et la première application
distante gardent leurs autorisations séparées. Aucun push, déploiement, changement
distant ou suppression de donnée existante n’a lieu. L’objectif global reste actif.
