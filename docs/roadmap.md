# Roadmap

**20 octobre — palier local vérifié :** les [deux compteurs D09](completed-work-local.md)
et la [nouvelle expiration naturelle de 3 600 secondes](auth-expiry-local.md)
passent réellement. Le contrôle complet passe **1 432 tests / 75 fichiers**,
types, lint, format, build, intégrité Engine, onze SQL standalone et smoke.
Huit rapports SQL/TLS/HTTP et 28 mesures sur 100 000 réponses passent ;
données et configurations conservées. Réception visuelle, hôte cible,
politique opérationnelle et portes distantes restent ouverts. Aucun distant,
aucun contournement ni clôture du goal/Lot 1A.

Les relevés suivants sont historiques.

**20 octobre — deux compteurs (D09) :** [intégration locale](completed-work-local.md)
qualifiée par 151 tests ciblés, huit rapports SQL/TLS et HTTP, et conservation
exacte des données. Les 28 mesures sur 100 000 réponses passent sous dix secondes
(maximum 8,278 s). Vérification générale et expiration naturelle en cours ;
aucune activation distante ni clôture du goal.

Les relevés suivants décrivent les étapes antérieures.

**20 octobre — expiration et SQL 71 :** le [correctif Auth](auth-expiry-local.md)
refuse correctement une session réellement expirée et permet la déconnexion.
Les 25 tests de l’adaptateur et cinq observations HTTP passent ; une nouvelle
expiration complète d’une heure reste en cours, sans succès anticipé.
La [migration SQL 71](legacy-search-path.md) passe onze gardes, annulation,
restauration et rejeu neuf des 71 SQL ; 30 + 26 assertions canoniques et six
contrôles Auth/amis passent. Advisors comparables : 32 puis 30 avertissements,
zéro erreur ; les bases applicatives restent SQL 64/70 inchangées.
Le contrôle complet passe ensuite **1 422 tests / 75 fichiers**, intégrité
Engine, types, lint, format, build, onze SQL standalone et smoke. Les 567 sources
sont exactes à sa fin ; seules neuf preuves documentaires sont complétées après.
Les deux timeouts initiaux restent tracés et les délais/assertions inchangés.
L’expiration complète reste en cours. Aucun distant,
aucun contournement de sécurité ni clôture du goal/Lot 1A.

**20 octobre — indicateur de version active connecté :** [lecteur et permissions](active-version-connected.md)
sont qualifiés sur la cible locale conservée : huit groupes PG/TLS, 17 refus,
douze groupes Auth/HTTP, sept groupes sur 3150 et huit contrôles Engine après
redémarrage. Les fiches affichent une observation fraîche, y compris le retour
arrière vers 1 alors que MAX vaut 2 ; l’absence réelle reste distincte d’une
panne. Activation explicite, données et huit configurations préservées ;
publication ordinaire et Production fermées. Les 120 tests ciblés passent ;
le contrôle complet réussit : **1 404 tests / 75 fichiers**, intégrité Engine,
types, lint sans erreur, format, build, onze SQL standalone exacts et smoke. Les
557 sources sont exactes à sa fin ; seules huit preuves documentaires sont
complétées après le contrôle. Le goal reste ouvert.

Les relevés suivants retracent les étapes antérieures à ce raccordement.

**20 octobre — cible locale SQL 70 qualifiée :** [upgrade et régression](active-version-target-local.md)
passent après sauvegarde : 62 tables, 11 séquences et identités préexistantes
conservées, source Auth inchangée. Advisors : zéro erreur, 33 avertissements
ouverts. Treize groupes du pilote cible puis treize groupes Auth/HTTP réels
exercent publication et retour arrière. L’indicateur reste fermé en attendant
provision, Auth/HTTP spécifiques et activation explicite. Aucun distant ;
le contrôle complet réussit : **1 387 tests / 72 fichiers**, types, lint, format,
build, onze SQL standalone exacts et smoke. Les cinq nouveaux scripts sont
inclus ; les neuf documents de bilan sont complétés et vérifiés après le contrôle.
Le goal reste ouvert.

Les relevés suivants sont antérieurs à cet upgrade de la cible synthétique.

**20 octobre — reprise confirmée après réparation utilisateur :** les 14 services
conservés sont redémarrés sans recréation. La [connexion réelle et huit contrôles
Engine](local-recovery-2026-10-20.md) passent sur [3150](http://127.0.0.1:3150/login),
avec les mêmes identifiants ; les vingt anciens rapports restent exacts.
SQL 70 passe quinze prérequis négatifs, l’annulation DDL et une restauration
peuplée (62 tables, 11 séquences). Le vrai lecteur TLS passe huit groupes,
17 refus et trois dérives de droits. La cible applicative demeure SQL 64,
intégralement inchangée : advisors, régression de publication, upgrade et
qualification HTTP du nouvel indicateur restent à effectuer avant activation.
Le contrôle complet courant réussit : **1 387 tests / 72 fichiers**, types, lint
sans erreur, format, build, onze SQL standalone exacts et smoke. Les 539 sources
incluent les deux bancs de test ; seules les preuves documentaires listées sont
complétées après le contrôle. Aucun distant ni navigateur automatisé ; le goal
et le Lot 1A restent ouverts.

Les relevés suivants décrivent les observations antérieures à cette reprise.

**20 octobre — panne Docker précisée :** le [crash Ingest au renommage du socket](local-recovery-2026-10-20.md)
est reproduit par un unique lancement normal. Les vérifications connectées
restent arrêtées, sans reset ni contournement. Quinze scénarios de prérequis
et une restauration SQL 70 sont préparés, contrôlés statiquement, non exécutés.

**20 octobre — préparation de la version cible :** [SQL 70 et l’indicateur](active-version-readonly.md)
passent le rejeu neuf, l’upgrade d’une copie et les tests ciblés. Login/TLS et
Auth/HTTP réels restent à qualifier avant activation locale. Docker est
indisponible et les services 3150/3152 arrêtés au relevé de 11:33 UTC ; les
disponibilités antérieures ci-dessous ne décrivent pas l’état courant.

**Performance pédagogique du 19 octobre :** une [requête optimisée et mesurée](pedagogy-performance.md)
remplace le plan qui dépassait dix secondes sur 100 000 réponses synthétiques.
Les 28 mesures passent (maximum 3,443 s), puis quatre lectures du vrai pool TLS
avec deux appels simultanés (maximum observé 3,727 s). Les bornes SQL sont
renforcées à quatorze cas négatifs ; permissions et API restent qualifiées.
La volumétrie réelle, les caches froids et l’hôte cible restent à vérifier.

**Raccordement pédagogique du 19 octobre :** la [page et les API locales](pedagogy-connected.md)
sont disponibles sur 3150, depuis Statistiques. Le lecteur TLS et les quatorze
groupes HTTP réels passent ; la source SQL 69 synthétique reste distincte de
l’activité générale. Les [preuves](pedagogy-connected-proof.json) séparent les
résultats Engine et du contrôle complet. Réception navigateur, performances,
33 avertissements SQL et portes distantes restent ouverts.

Le relevé suivant décrit le socle antérieur à ce raccordement.

**Socle pédagogique du 19 octobre :** les [requêtes, filtres et droits SQL](pedagogy-readonly.md)
passent sur copies isolées. Le nouveau lecteur ne donne accès ni aux profils ni
aux définitions/réponses. Login/TLS, API et interface restent à raccorder ; les
filtres pédagogiques ne sont pas encore disponibles dans l’application.

**Reprise du 19 octobre :** [connexion et services locaux rétablis](local-recovery-2026-10-19.md),
SQL 68 et parcours de publication par lot qualifiés sur copies synthétiques.
Aucune activation distante ; voir les preuves et limites datées.

**19 octobre :** la [consolidation des policies SQL 68](reader-policies.md)
passe matrice RLS, rejeu neuf, restauration, régressions, PG/TLS et Auth/HTTP.
Les services conservés sont disponibles ; treize avertissements SQL disparaissent,
32 restent ouverts. Le parcours HTTP par lot passe sur trois exercices locaux.
Les portes du Lot 1A, la réception visuelle et la mise en service restent ouvertes.

**Utilisateurs locaux, 18 octobre :** [liste/recherche/activité](users-readonly.md)
raccordées avec identité SQL distincte et lecture minimisée. Rejeu 66, restauration,
35 assertions SQL, 16 groupes PG/TLS et 13 groupes Auth/HTTP passent. Les 62 tables
d’activité sont conservées. Contrôle complet : **1 023 tests / 54 fichiers**,
build et smoke passent ; huit contrôles Engine après redémarrage préservent
les seize anciens rapports. Profils détaillés, progression, historique, Production
et réception navigateur restent ouverts ; les jalons ci-dessous sont historiques.

**Statistiques connectées, 18 octobre :** [page/API locales](activity-http.md)
raccordées au lecteur TLS sur une source synthétique séparée. Douze groupes
Auth/HTTP/SQL et huit contrôles Engine après redémarrage passent. Les 62 tables
d’activité et toutes les lignes des 35 tables métier initiales sont conservées.
Production, filtres/métriques restants, utilisateurs et réception navigateur
restent ouverts. Les relevés suivants précèdent ce raccordement.

**Lecteur analytique, 18 octobre :** [login SCRAM/TLS et lecteur serveur](activity-pg.md)
qualifiés sur copie synthétique : treize groupes natifs, dix-huit refus SQL et
deux dérives de droits refusées. Les 62 tables sont conservées. Routes/page,
permissions HTTP, filtres et consultation nominative restent ouverts ; aucun
secret ou accès distant. Les relevés suivants précèdent ce jalon.
Contrôle complet final : 877 tests / 47 fichiers, build et smoke HTTP passent ;
la première tentative dans le Temp éphémère reste documentée comme échouée.

**Statistiques SQL, 18 octobre :** [migration locale 65 et agrégats](activity-readonly.md)
qualifiés sur copies. Rejeu neuf, 31 assertions de permissions, agrégations/bornes,
56 assertions historiques inchangées et restauration avec données non vides passent.
Le lecteur PostgreSQL/TLS, les routes et la consultation nominative restent à faire.
Les instances utilisateur restent au schéma conservé 64 ; aucun accès distant.

**Reprise connectée, 18 octobre :** les [services conservés sont rétablis](local-recovery-2026-10-18.md)
après sauvegarde à froid vérifiée et démarrage normal de Docker. Huit contrôles
Engine, huit de reprise publication et sept d’accès/isolation passent ; 3150
permet de nouveau les essais avec connexion et sauvegarde. Aucune mise à jour,
migration ou activation distante. Les bilans d’arrêt ci-dessous sont historiques.
Les champs utilisateurs V1 sont fixés par [D08](decisions.md#d08--champs-de-consultation-des-utilisateurs-v1) :
nom, e-mail et activité, sans capacité Production encore opérationnelle.

**Essais progressifs, 18 octobre :** la connexion désactivée en développement
propose un accès à l’aperçu fictif. [Quatre tests SSR et cinq contrôles HTTP](login-preview-proof.json)
passent ; contrôle complet **848 tests / 46 fichiers**. Ce lien ne rétablit pas
Docker, n’active pas Auth et n’apparaît pas dans le build Production.

Le [volet préparatoire du Lot 8](activity-statistics.md) définit les périodes,
agrégats et rendu de statistiques sur exemple fictif. Il ne clôture ni ne branche
le lecteur Production : la capacité SQL et les parcours réels restent ouverts.
Contrôle complet : **844 tests / 45 fichiers**, onze pages du banc compilées,
trois réponses HTTP vérifiées ; interactions navigateur non exécutées.

Le [relevé distant en lecture seule du 18 octobre](lot-1a-remote-reconciliation-current.md)
confirme l’historique incomplet et les tables Admin non appliquées. Il distingue
les comparaisons brutes et normalisées, sans nouvelle autorisation de migration.

La [matrice de livraison actuelle](readiness-current.md) distingue implémentation,
preuves locales et fonctions encore manquantes. Les statistiques/utilisateurs
Production, l’indication de version cible courante et les réceptions restent
ouverts ; le goal n’est pas réductible au seul redémarrage de Docker.

**Récupération Creator, 18 octobre :** la [copie facultative](creator-recovery.md)
conserve la saisie dans l’onglet pendant trente minutes de récupération.
Un changement de référence prépare une nouvelle révision. La réception
navigateur et l’essai connecté restent ouverts ; aucun accès distant.
802 tests et le contrôle complet passent ; dix pages du banc compilent.

**Publication HTTP connectée, 17–18 octobre :** le [parcours réel](publication-http-connected.md)
passe treize contrôles : Auth/REST, Engine natif, confirmation, deux révisions,
retour à la première et conservation des historiques. 767 tests et le contrôle
complet passent sur copie indépendante des sources. La vérification après
redémarrage reste non exécutée : Docker Desktop 4.90 échoue au démarrage et
les applications sont actuellement arrêtées. Réparation globale soumise à accord ;
aucune donnée supprimée, activation distante ou réception navigateur.

**Publication HTTP, préparation du 17 octobre :** les [copies source/cible](publication-http-local.md)
sont prêtes avec Auth/REST réels, TLS vérifié et rôles limités. Cinq contrôles
Auth/REST, six connexions/refus TLS/PG et 74 tests ciblés passent. Le vrai
transfert HTTP reste à exécuter ; le profil applicatif dédié est encore fermé.
L’instance 3150 reste disponible et ne publie rien.

**Adoption Engine, 17 octobre :** la [rotation SQL et le raccordement](engine-admin-adoption.md)
passent sur copie et sur l’instance conservée. SQL 64, 735 tests Admin, contrôle
complet, bootstrap neuf, 16 contrôles de relecture et huit contrôles avancés
connectés passent. Les données et historiques sont conservés. L’instance 3150
utilise le nouveau build ; publication et accès distants restent fermés.
Les qualifications suivantes décrivent leurs jalons antérieurs.

**Engine, 17 octobre :** le [correctif numérique ciblé](engine-numeric-cache.md)
est qualifié : 1 540 tests, tarball installé, six générations avancées en
2,41–2,64 s, comparaison exacte et contrôles Linux passent, avec limites
inchangées. **Adoption Admin restante** : SQL épingle encore l’ancienne archive ;
rotation locale et tests connectés à réaliser avant de changer l’instance.

**Figures et vecteurs, 16 octobre :** [flèches, découpage et descriptions](coordinate-rendering.md)
à partir des coordonnées publiques de l’Engine. Projections natives des seeds
0/42, tests de rendu serveur et page manuelle distincte ; aucune réception
visuelle ou capacité de tracé de formule n’est déduite de ces preuves.
718 tests et le contrôle complet passent. Un timeout natif après redémarrage,
suivi d’une reproduction identique réussie, garde la qualification de
disponibilité de cette charge avancée ouverte ; ses limites restent inchangées.

**Relecture connectée, 16 octobre :** [vraies sessions et rapports natifs](local-admin-review.md),
16 contrôles réels, quatre rapports et six événements synthétiques marqués.
696 tests Admin et contrôle complet passent ; dix contrôles du lancement local
passent séparément.
L’option locale `--engine --review` permet les essais progressifs ; elle ne
publie rien. Les anciennes qualifications et portes distantes restent distinctes.

**Publication par lots, 16 octobre :** [sélection, diffs et reprise](publication-batch.md)
avec résultats par exercice. 676 tests Admin, contrôle complet, cinq phases
natives sur copies SQL et 13 contrôles de pages/permissions HTTP réels passent.
Les transferts natifs utilisent une identité et une relecture synthétiques ;
aucune publication HTTP distante ou réception navigateur n'est déduite de ces
preuves. Rendu avancé, statistiques/utilisateurs et portes de mise en service restent ouverts.

**Dernier jalon, 16 octobre :** [Engine dans la session locale](local-admin-engine.md),
avec génération/correction natives et rapport signé persisté : 28 contrôles HTTP
réels, 641 tests Admin et contrôle complet passent. La réception visuelle, le
rendu avancé, les lots et les portes distantes restent ouverts. Le relevé juste
ci-dessous précède ce raccordement.

**État actuel, 16 octobre :** [connexion et sauvegarde locales](local-admin.md)
avec comptes d'essai réels : 17 contrôles HTTP et 621 tests Admin passent.
Le rejeu atteint 63 migrations, avec [conflits RPC HTTP corrigés](rpc-http-conflicts.md)
et restauration/concurrence vérifiées. Le moteur de l'instance connectée reste
à raccorder ; le banc Linux séparé conserve sa portée. Les relevés ci-dessous
sont historiques ; activation distante, réception visuelle et Lot 1A restent ouverts.

**Retour fonctionnel local :** le [parcours serveur/SQL](publication-rollback.md)
passe dix étapes entre deux révisions, avec nouveaux tests Engine, tentatives
liées et reprise sans transfert après réponse perdue. **584 tests Admin** et
le contrôle complet passent. Les lots, Auth/REST réels, rendu avancé et réception
visuelle restent ouverts ; aucune activation distante ni clôture du Lot 1A.

**Dernier jalon local :** la [finalisation source](publication-source-finalization.md)
réunit journal terminal, statut publié et pointeur source dans une transaction.
Le rejeu neuf atteint **62 migrations** ; 31 assertions SQL avant/après restauration
et 15 groupes d'intégration passent, dont huit scénarios dédiés avec Engine Linux
et reprise sans transfert. Le contrôle complet passe **578 tests Admin**,
types, lint sans erreur, format, build et smoke. Auth/REST réels et réception visuelle restent ouverts.
Les relevés ci-dessous décrivent leurs jalons antérieurs ; aucun accès distant.

**Interface de publication :** le [panneau et l'historique](publication-ui.md)
sont raccordés aux routes existantes, avec confirmation explicite, expiration
et observation après interruption. Un scénario de simulation est disponible dans
le banc local. La finalisation éditoriale source est maintenant vérifiée dans
le dernier jalon ; les lots, le rollback complet, Auth réelle et la réception
visuelle restent ouverts. Aucune activation distante.

**Orchestration locale :** le [service de publication](publication-service.md)
relie export source, nouveaux tests Engine, confirmation signée, journal et
transaction cible. Sa route reste fermée par défaut. La transition éditoriale
source, l'UI individuelle/groupée, le rollback complet et les parcours Auth réels
restent à terminer ; aucune activation distante ni réception visuelle.

Ce jalon passe **547 tests Admin**, types, lint sans erreur, format, build et
smoke, ainsi que sept scénarios réels du service sur copies locales avec Engine
Linux frais. Les preuves et les échecs intermédiaires restent datés et distincts.

**Transaction cible :** la [primitive serveur](publication-target.md) passe neuf
scénarios locaux avec PostgreSQL réel, dont commit incertain, perte de socket et
reprise sans répétition. 463 tests Admin et le contrôle complet passent. Le service
Engine/source/cible, les routes et les confirmations UI restent à raccorder ;
aucune activation distante ni réception visuelle n'est déclarée.

**Connexion privée et reprise :** le [pilote PostgreSQL](publication-pg.md) et
la migration 61 passent 11 contrôles d'intégration TLS/rôles/reprise et 16 assertions
SQL avant/après restauration. 424 tests Admin et le contrôle complet passent.
Le transfert, la relecture cible, la reprise de commit ambigu et les confirmations
restent à raccorder ; les portes distantes et la réception visuelle restent ouvertes.

**Essais progressifs :** le [banc commun local](local-workspace.md) donne accès
aux composants et au Creator avec le vrai Engine Linux, sans Auth ni base.
421 tests Admin, deux tests HTTP du banc, dix contrôles natifs et compilation
des sept pages passent. Cela ne livre pas l'application authentifiée : réception
visuelle, intégration de publication et portes distantes restent ouvertes.

**État au 15 octobre 2026 :** D07 recentre le travail sur les migrations
locales NovLearn et la construction d’Admin. Les adaptations de l’application
élève sont hors de ce périmètre ; elles ne bloquent plus le développement
local des lots Admin. Leur compatibilité reste une porte avant mise en service.
Auth distante, publication et déploiement restent désactivés.

La [reprise du 15 octobre](goal-recovery.md) établit le dernier arrêt
`cyber_policy`. La correction défensive des triggers (56e migration locale)
passe sur copie et restauration ; le rejeu neuf complet atteint alors 55.
La qualification complète du confinement reste ouverte. Le goal était enregistré
`blocked` lors de cet audit ; sa reprise à l'état `active` est vérifiée ensuite.
Le [référentiel Staging](taxonomy.md) ajoute la 57e migration, testée
incrémentalement : 39 assertions SQL avant/après restauration, concurrence et
257 tests Admin. À ce stade, aucun rejeu neuf de 57 migrations ni activation distante.

**Mise à jour suivante :** les [flashcards](flashcards.md) ajoutent la migration 58. Le rejeu neuf des **58 migrations**, la sauvegarde/restauration complète,
69 contrôles historiques et les suites de contenu passent, ainsi que **302 tests
Admin**, types, format, build et smoke. Les relevés 55/57 ci-dessus sont antérieurs.
La réception visuelle flashcards est bloquée par la politique d'URL du navigateur ;
aucun contournement. Le goal est actif, les lots et portes restantes restent ouverts.

Le [Dashboard Staging](dashboard.md) ajoute ensuite la migration 59 et remplace
son texte d'attente par les agrégats du catalogue et des contenus. **337 tests
Admin**, le rejeu neuf de **59 SQL**, la restauration complète, les 69 contrôles
historiques et les six suites de contenu passent. Les chiffres Production et la
réception visuelle restent ouverts ; ces résultats ne clôturent pas le Lot 1A.

Le [journal de publication](publication-journal.md) ajoute la migration 60 et
les protections de source persistantes pendant un résultat incertain. **378
tests Admin**, 41 assertions journal, concurrence, redémarrage/restauration,
rejeu neuf de 60 SQL, Engine natif, sauvegarde complète et régressions passent.
La connexion et le transfert serveur, la reprise reliée à la cible et l'UI
restent à construire ; aucun nouveau transfert ou activation réelle n'est certifié.

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
La [capacité de publication locale](publication-capability.md) porte maintenant
le rejeu à 55 migrations, avec 50 contrôles de transfert et 5 sur la capacité
restaurée. Le diff est construit ; service, journal et UI restent à relier.

Les preuves antérieures sont des relevés datés :
[51 migrations](lot-1a-local-statistics-guard.md),
[RPC privilégiés](lot-1a-local-rpc-review.md),
[restauration/profils](lot-1a-local-restore-and-privacy.md),
[premiers correctifs](lot-1a-local-validation.md),
[certification Engine Linux](lot-1a-engine-linux-certification.md).
Le [refus Windows intermédiaire](lot-1a-engine-local-requalification.md)
ne décrit pas l’état du dernier artefact Linux certifié.

La roadmap décrit la cible du CDC ; documenter un lot ne signifie pas qu'il est livré. Les lots 0 et 0 bis sont terminés. Le goal courant (D02) autorise les travaux locaux et le passage automatique aux lots indépendants. Le modèle à deux tables est validé ; aucune migration ni correction distante n'est réalisée. Le code Auth du Lot 1B est préparé et testé localement, avec accès désactivé avant validation du Lot 1A. Voir [progression](progress.md) et [Auth](auth.md). Aucune fonctionnalité bloquée n'est déclarée opérationnelle.

| Lot                                | Périmètre                                                                    | Dépendances et portes de contrôle                                                                                                   | Critère de sortie                                                                                                                                            | État                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 0. Initialisation                  | Socle Next.js, conventions, configuration fictive                            | CDC                                                                                                                                 | Socle initial présent ; aucune fonction métier                                                                                                               | Terminé                                                                                          |
| 0 bis. Audit d'architecture        | Bases, migrations, sécurité, modèle/version, Engine, publication, arbitrages | Documents et dépôts accessibles ; métadonnées Supabase en lecture seule                                                             | Rapport documenté ; décisions ouvertes visibles ; aucune migration/code métier                                                                               | Terminé                                                                                          |
| 1A. Réconciliation et sécurité SQL | Historique Git/distant, grants/RLS, rôle Admin, RPC et lectures privées      | Correctifs locaux autorisés par D04 ; historique distant, confidentialité legacy, backup/retour et application distante à valider   | Historique rapproché ; policies/ACL testées ; rôle non modifiable par client ; compatibilité élèves ; application Staging puis Production validée séparément | SQL/Engine locaux vérifiés — réception distante restante                                         |
| 1B. Auth et socle Admin            | Auth Supabase Staging, session, rôle serveur, zones protégées                | Lot 1A réellement réalisé et validé ; provision premier Admin, MFA/révocation documentés ; vérification qu'un compte Staging existe | Accès refusé par défaut ; chaque action testée avec rôles permis/interdits ; aucune escalade via profile; secrets séparés                                    | Auth locale réelle vérifiée ; activation distante fermée                                         |
| 2. Gestion catalogue               | Consultation et gestion du catalogue et brouillons Staging                   | Schéma local à deux tables, contrôles Auth ; D07 autorise l’implémentation locale sans activation distante                          | Contrats canoniques ; sauvegarde et permissions testées ; aucune mutation historique                                                                         | Implémenté et vérifié localement ; activation distante fermée                                    |
| 3. Creator                         | Édition de définitions canoniques et champs/éléments supportés               | Lot 2 ; contrat Engine et runtime qualifiés ; immutabilité des révisions publiée réellement protégée                                | Révisions traçables ; validation Engine ; aucune logique mathématique concurrente                                                                            | Creator et aperçu locaux ; réception complète restante                                           |
| 4. Tests et aperçu                 | Seeds, diagnostics, projection et simulation de correction côté serveur      | Lot 3 ; Engine corrigé/qualifié pour hébergement cible ; politique d'attendus privés                                                | Tests multi-seeds, rejeu reproductible, réponses attendues absentes de la projection élève                                                                   | Aperçu, rapports et relecture locaux ; rendu avancé restant                                      |
| 5. Publication                     | Diff, validation, transfert sélectif, audit et rollback fonctionnel          | Lots 2-4 ; deux tables autorisées ; projection métier, mapping, droits PG limités et refs manquantes définis/testés                 | Uniquement contenu métier approuvé de `exercises` et `exercise_versions` ; idempotence/concurrence ; aucune version publiée réécrite ni tentative modifiée   | Transferts individuels/par lots, retour SQL et UI locaux ; réception restante                    |
| 6. Chapitres et compétences        | Édition Staging et validation des références                                 | Lot 1B ; aucune propagation en V1 de publication                                                                                    | CRUD contrôlé ; publication exercices bloque refs absentes sans copie implicite                                                                              | CRUD local vérifié ; activation distante fermée                                                  |
| 7. Flashcards                      | Édition Staging                                                              | Lot 1B ; aucun transfert en V1                                                                                                      | Permissions et validations testées ; pas de propagation implicite                                                                                            | CRUD/API/SQL locaux ; réception visuelle bloquée                                                 |
| 8. Statistiques et utilisateurs    | Indicateurs et consultations Production minimisées                           | Définitions métriques ; rôle PostgreSQL read-only techniquement réel ; décisions de confidentialité et accès nominatif              | Agrégats vérifiables, sources étiquetées, autorisations et minimisation testées                                                                              | Statistiques, compteurs D09, liste et fiches locaux qualifiés ; réception et Production ouvertes |
| 9. Mise en service                 | Hébergement, exploitation, accessibilité, performance et sécurité            | Lots concernés terminés ; hôte et secrets approuvés ; audit final                                                                   | Runbook, rollback, surveillance et revue sécurité acceptés                                                                                                   | À faire                                                                                          |

Les [fiches utilisateurs locales](user-detail.md) ajoutent ensuite SQL 67,
progression et historique synthétique avec permissions minimisées. Les preuves
SQL, PG/TLS, restauration et Auth/HTTP sont datées ; les constats advisors,
la réception navigateur et les portes distantes restent ouverts.

## Portes obligatoires avant la première migration

- Obtenir un diff complet structurel Production/Staging et réconcilier les fichiers `Novlearn/supabase/migrations/` aux versions distantes déclarées ; établir si des changements manuels existent.
- Valider l'unique repository propriétaire des migrations et publier une baseline seulement si le drift est compris.
- Le modèle `exercises` + `exercise_versions` et la publication sélective de leurs contenus métier sont **validés** (D01). Finaliser ses détails SQL, le mapping interbases et les évolutions compatibles des tentatives/duels, sans perdre les anciennes FK/données ni inventer leur version historique.
- Tester restauration backup/PITR et migrations locales sur copie sans données personnelles ; préparer compatibilité rétrograde, contrôles post-migration et rollback.
- Traiter les policies/RPC trop ouvertes et tester RLS/ACL sous les rôles API effectifs. Aucun accès Auth Admin ou Production avant ce garde-fou.
- Vérifier Engine/runtime et compatibilité de version entre Admin et application élève.

## Travaux documentaires sans risque

Le [dossier de réception et mise en service](local-handover.md) précise les
actions humaines restantes. Le [classement des constats SQL 71](sql-findings-triage.json)
distingue les 30 avertissements de performance et les 67 informations conservées,
sans nouvelle exécution, modification de policy/index ou certification globale.
La réception du parcours connecté est demandée ; aucun résultat humain n’est
présumé. Aucun lot distant n’est démarré.

Le [rapprochement par empreintes](lot-1a-hash-reconciliation.md) affine le Lot 1A
en lecture seule : sept fichiers ont un candidat distant après normalisation
documentée ; 25 entrées n'ont pas de SQL archivé. Aucun historique n'est réparé
et aucune équivalence de leurs effets n'est annoncée.

Le composant de [saisie MathLive](math-input.md) est préparé et exercé dans un
banc navigateur local indépendant. Il ne vaut pas livraison du Creator ou des
tests Engine, et n'ouvre aucune route ni écriture métier.

Le [dossier Lot 1A](lot-1a-preparation.md), son manifeste et ses requêtes de lecture sont disponibles. La sécurisation SQL, les tests locaux des correctifs et leur application restent à autoriser/réaliser. La séparation structure/contenu permet des migrations de compatibilité des autres tables sans jamais synchroniser leurs données. La décision D01 autorise seulement la mise à jour ciblée du CDC ; elle ne démarre pas le Lot 1B ni un autre lot fonctionnel.
