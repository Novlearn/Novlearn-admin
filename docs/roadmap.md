# Roadmap

**État au 14 octobre 2026 :** D07 recentre le travail sur les migrations
locales NovLearn et la construction d’Admin. Les adaptations de l’application
élève sont hors de ce périmètre ; elles ne bloquent plus le développement
local des lots Admin. Leur compatibilité reste une porte avant mise en service.
Auth distante, publication et déploiement restent désactivés.

Le [catalogue local](catalogue.md) est implémenté : liste, recherche, statuts,
tri, pagination, brouillons et métadonnées, duplication, archivage réversible,
historique et comparaison. **52 migrations passent**, ainsi que **47 assertions
catalogue avant et après restauration** et les **69 assertions de sécurité
existantes**. L’archive Engine certifiée Linux est verrouillée dans Admin.
Le [Creator canonique](creator.md) et la validation structurelle via worker Linux
sont construits localement. L’[aperçu et les tests Engine](preview.md) ajoutent
génération, correction et rapports multi-seeds. Courbes,
réception complète de l’édition et publication restent à réaliser. Les
[reçus de tests signés](test-receipts.md) et leur historique sont maintenant
implémentés localement. La [relecture humaine](editorial-review.md) ajoute
l’attestation et l’historique avec contrôles SQL, fermés par défaut. Le rejeu
courant atteint 54 migrations, avec 43 assertions relecture, 48 catalogue,
21 reçus et 69 contrôles historiques après restauration.

Les preuves antérieures sont des relevés datés :
[51 migrations](lot-1a-local-statistics-guard.md),
[RPC privilégiés](lot-1a-local-rpc-review.md),
[restauration/profils](lot-1a-local-restore-and-privacy.md),
[premiers correctifs](lot-1a-local-validation.md),
[certification Engine Linux](lot-1a-engine-linux-certification.md).
Le [refus Windows intermédiaire](lot-1a-engine-local-requalification.md)
ne décrit pas l’état du dernier artefact Linux certifié.

La roadmap décrit la cible du CDC ; documenter un lot ne signifie pas qu'il est livré. Les lots 0 et 0 bis sont terminés. Le goal courant (D02) autorise les travaux locaux et le passage automatique aux lots indépendants. Le modèle à deux tables est validé ; aucune migration ni correction distante n'est réalisée. Le code Auth du Lot 1B est préparé et testé localement, avec accès désactivé avant validation du Lot 1A. Voir [progression](progress.md) et [Auth](auth.md). Aucune fonctionnalité bloquée n'est déclarée opérationnelle.

| Lot                                | Périmètre                                                                    | Dépendances et portes de contrôle                                                                                                   | Critère de sortie                                                                                                                                            | État                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 0. Initialisation                  | Socle Next.js, conventions, configuration fictive                            | CDC                                                                                                                                 | Socle initial présent ; aucune fonction métier                                                                                                               | Terminé                                                        |
| 0 bis. Audit d'architecture        | Bases, migrations, sécurité, modèle/version, Engine, publication, arbitrages | Documents et dépôts accessibles ; métadonnées Supabase en lecture seule                                                             | Rapport documenté ; décisions ouvertes visibles ; aucune migration/code métier                                                                               | Terminé                                                        |
| 1A. Réconciliation et sécurité SQL | Historique Git/distant, grants/RLS, rôle Admin, RPC et lectures privées      | Correctifs locaux autorisés par D04 ; historique distant, confidentialité legacy, backup/retour et application distante à valider   | Historique rapproché ; policies/ACL testées ; rôle non modifiable par client ; compatibilité élèves ; application Staging puis Production validée séparément | SQL/Engine locaux vérifiés — réception distante restante       |
| 1B. Auth et socle Admin            | Auth Supabase Staging, session, rôle serveur, zones protégées                | Lot 1A réellement réalisé et validé ; provision premier Admin, MFA/révocation documentés ; vérification qu'un compte Staging existe | Accès refusé par défaut ; chaque action testée avec rôles permis/interdits ; aucune escalade via profile; secrets séparés                                    | Préparé localement — activation bloquée SQL/compte             |
| 2. Gestion catalogue               | Consultation et gestion du catalogue et brouillons Staging                   | Schéma local à deux tables, contrôles Auth ; D07 autorise l’implémentation locale sans activation distante                          | Contrats canoniques ; sauvegarde et permissions testées ; aucune mutation historique                                                                         | Implémenté et vérifié localement ; activation distante fermée  |
| 3. Creator                         | Édition de définitions canoniques et champs/éléments supportés               | Lot 2 ; contrat Engine et runtime qualifiés ; immutabilité des révisions publiée réellement protégée                                | Révisions traçables ; validation Engine ; aucune logique mathématique concurrente                                                                            | Creator et aperçu locaux ; réception complète restante         |
| 4. Tests et aperçu                 | Seeds, diagnostics, projection et simulation de correction côté serveur      | Lot 3 ; Engine corrigé/qualifié pour hébergement cible ; politique d'attendus privés                                                | Tests multi-seeds, rejeu reproductible, réponses attendues absentes de la projection élève                                                                   | Aperçu, rapports et relecture locaux ; rendu avancé restant    |
| 5. Publication                     | Diff, validation, transfert sélectif, audit et rollback fonctionnel          | Lots 2-4 ; deux tables autorisées ; projection métier, mapping, droits PG limités et refs manquantes définis/testés                 | Uniquement contenu métier approuvé de `exercises` et `exercise_versions` ; idempotence/concurrence ; aucune version publiée réécrite ni tentative modifiée   | À réaliser après tests/aperçu ; publication distante interdite |
| 6. Chapitres et compétences        | Édition Staging et validation des références                                 | Lot 1B ; aucune propagation en V1 de publication                                                                                    | CRUD contrôlé ; publication exercices bloque refs absentes sans copie implicite                                                                              | À faire                                                        |
| 7. Flashcards                      | Édition Staging                                                              | Lot 1B ; aucun transfert en V1                                                                                                      | Permissions et validations testées ; pas de propagation implicite                                                                                            | À faire                                                        |
| 8. Statistiques et utilisateurs    | Indicateurs et consultations Production minimisées                           | Définitions métriques ; rôle PostgreSQL read-only techniquement réel ; décisions de confidentialité et accès nominatif              | Agrégats vérifiables, sources étiquetées, autorisations et minimisation testées                                                                              | À faire — attente accès Production                             |
| 9. Mise en service                 | Hébergement, exploitation, accessibilité, performance et sécurité            | Lots concernés terminés ; hôte et secrets approuvés ; audit final                                                                   | Runbook, rollback, surveillance et revue sécurité acceptés                                                                                                   | À faire                                                        |

## Portes obligatoires avant la première migration

- Obtenir un diff complet structurel Production/Staging et réconcilier les fichiers `Novlearn/supabase/migrations/` aux versions distantes déclarées ; établir si des changements manuels existent.
- Valider l'unique repository propriétaire des migrations et publier une baseline seulement si le drift est compris.
- Le modèle `exercises` + `exercise_versions` et la publication sélective de leurs contenus métier sont **validés** (D01). Finaliser ses détails SQL, le mapping interbases et les évolutions compatibles des tentatives/duels, sans perdre les anciennes FK/données ni inventer leur version historique.
- Tester restauration backup/PITR et migrations locales sur copie sans données personnelles ; préparer compatibilité rétrograde, contrôles post-migration et rollback.
- Traiter les policies/RPC trop ouvertes et tester RLS/ACL sous les rôles API effectifs. Aucun accès Auth Admin ou Production avant ce garde-fou.
- Vérifier Engine/runtime et compatibilité de version entre Admin et application élève.

## Travaux documentaires sans risque

Le [rapprochement par empreintes](lot-1a-hash-reconciliation.md) affine le Lot 1A
en lecture seule : sept fichiers ont un candidat distant après normalisation
documentée ; 25 entrées n'ont pas de SQL archivé. Aucun historique n'est réparé
et aucune équivalence de leurs effets n'est annoncée.

Le composant de [saisie MathLive](math-input.md) est préparé et exercé dans un
banc navigateur local indépendant. Il ne vaut pas livraison du Creator ou des
tests Engine, et n'ouvre aucune route ni écriture métier.

Le [dossier Lot 1A](lot-1a-preparation.md), son manifeste et ses requêtes de lecture sont disponibles. La sécurisation SQL, les tests locaux des correctifs et leur application restent à autoriser/réaliser. La séparation structure/contenu permet des migrations de compatibilité des autres tables sans jamais synchroniser leurs données. La décision D01 autorise seulement la mise à jour ciblée du CDC ; elle ne démarre pas le Lot 1B ni un autre lot fonctionnel.
