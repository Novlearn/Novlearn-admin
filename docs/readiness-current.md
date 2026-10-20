# État de livraison — 20 octobre 2026

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

**Blocage précisé :** un [crash Docker Desktop sur son socket interne](local-recovery-2026-10-20.md)
empêche le moteur Linux de démarrer. La fermeture normale utilisateur est
demandée ; les protections et données restent préservées. Le nouveau banc de
préconditions/restauration SQL 70 passe syntaxe, format et lint uniquement ;
aucun nouveau succès PostgreSQL, Engine ou HTTP connecté n’est annoncé.

**Contrôle complet du 20 octobre réussi :** 1 387 tests / 72 fichiers, types,
lint, format, build et smoke ; le [lecteur cible reste en préparation](active-version-readonly.md).
L’[aperçu 3140](http://127.0.0.1:3140/) est accessible avec des exemples fictifs,
sans Auth, base ou Engine. Le relevé 11:43 UTC confirme 3150/3152 arrêtés et
Docker absent ; aucune connexion réelle actuelle n’est déclarée réussie.

**Disponibilité actuelle :** Docker n’est plus joignable et les ports 3150/3152
refusent les connexions au relevé utilisateur du 20 octobre, 11:33 UTC. Les
preuves de disponibilité du 19 octobre sont historiques. Le nouvel [indicateur
de version active](active-version-readonly.md) est préparé et fermé par défaut :
70 migrations rejouées, copie peuplée préservée, six observations et 16 refus
natifs, 103 tests ciblés réussis. Qualification PG/TLS, HTTP réel et activation
locale restent ouvertes ; aucune réception distante ou navigateur n’est déduite.

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

## Reprise et qualifications locales — 19 octobre 2026

Les [services conservés sont disponibles](local-recovery-2026-10-19.md) après
intervention utilisateur sur Docker. Connexion réelle, huit contrôles Engine
(18 anciens reçus conservés), SQL 68, restauration, 56 assertions historiques,
19 groupes PG/TLS et 16 Auth/HTTP passent. Les [advisors](reader-policies.md)
confirment treize avertissements supprimés ; 32 WARN et 65 INFO restent ouverts.
Le [parcours HTTP de publication par lot](publication-batch-http-proof.json)
passe sept groupes avec trois transferts locaux, arrêt sur réponse perdue et
reprise sans doublon. Les échecs initiaux restent documentés. Aucun distant
activé ; réception navigateur et objectifs restants du CDC toujours ouverts.

**NovLearn Admin n’est pas terminé.** Les fonctions de contenu disposent de
preuves locales, mais les statistiques/utilisateurs Production ne sont pas
opérationnels et plusieurs réceptions restent ouvertes. Le contrat et l’affichage
des statistiques sont [préparés sur exemple fictif](activity-statistics.md), sans
lecteur Production. La [page/API SQL locale](activity-http.md) est depuis
raccordée et qualifiée sur une source synthétique séparée. Les [services locaux sont rétablis](local-recovery-2026-10-18.md) :
connexion, sauvegarde, reconnexion et Engine passent. La [liste utilisateurs
locale](users-readonly.md) dispose maintenant de preuves SQL, PG/TLS et Auth/HTTP ;
les [fiches locales](user-detail.md) ajoutent détails, progression et historique.
Les fonctions Production
manquantes restent à réaliser et qualifier.

Cette matrice couvre les vingt sections de la demande `/goal` jointe. Elle
renvoie aux preuves datées, sans les convertir en une qualification du système
actuel sans en élargir la portée. Le [relevé machine](readiness-current.json) conserve les
références et leurs empreintes ; sa couverture documentaire n’est pas un test
fonctionnel réussi.

Le [relevé distant du 18 octobre](lot-1a-remote-reconciliation-current.md)
actualise les seules métadonnées : 70 entrées de migration par projet, 25 sans
statements, et absence d’`exercise_versions`. Les colonnes, policies et
contraintes sélectionnées correspondent ; trois fonctions gardent des hashes
bruts différents mais des corps rapprochés après normalisation documentée.
Aucune écriture ni qualification globale des deux bases n’en est déduite.

## Correspondance avec la demande initiale

| Section | Exigence                  | État et preuve disponible                                                                                                                                                                                                                                                                                 | Reste nécessaire                                                                                                                                                                                                            |
| ------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Audit initial             | CDC, schéma local et API Engine examinés ; décisions et historique dans [progression](progress.md) et [Lot 1A](lot-1a-preparation.md).                                                                                                                                                                    | Réconcilier le schéma/historique distant avant application ; les relevés du 13 octobre ne prouvent pas l’état distant actuel.                                                                                               |
| 2       | Architecture              | Next, TypeScript strict, services serveur, contrats et package Engine verrouillés ; contrôle complet référencé dans [correctif de récupération](recovery-cleanup-proof.json).                                                                                                                             | Capacité de lecture Production et hébergement à concevoir/qualifier ; aucune clé générale ne vaut un droit limité.                                                                                                          |
| 3       | Auth et sécurité          | Vrais comptes, session fraîche, sauvegarde et reconnexion après panne : [reprise locale](local-recovery-2026-10-18-proof.json). Refus/révocation antérieurs dans [Auth locale](local-admin-proof.json).                                                                                                   | Expiration réelle, MFA, provision opérationnel et réception Staging non certifiés.                                                                                                                                          |
| 4       | Interface générale        | Identité [visuelle](visual-implementation.md), navigation, formulaires, retours d’erreur et essais sur 3140.                                                                                                                                                                                              | Réception visuelle/accessibilité actuelle ; aucun succès navigateur déduit de la compilation ou du SSR.                                                                                                                     |
| 5       | Gestion des exercices     | CRUD, conflits, versions, duplication et archivage dans [catalogue](catalogue-local-proof.json) et parcours Auth/REST réels. [Version cible préparée](active-version-readonly-proof.json) : 70 migrations, copie peuplée, six observations/16 refus natifs et 103 tests ciblés.                           | Indicateur de cible fermé par défaut ; login/TLS et Auth/HTTP réels restent à qualifier avant activation locale. L’accès Production et sa mise en service restent soumis aux portes distinctes.                             |
| 6       | Creator visuel            | Édition canonique des vingt types, variables, contraintes, questions, politiques ; [Creator](creator-local-proof.json), [récupération](creator-recovery-proof.json).                                                                                                                                      | Réception de la récupération en navigateur et avec la sauvegarde connectée ; courbes de formules non prises en charge faute de points calculés officiels.                                                                   |
| 7       | MathLive                  | Saisie et clavier existants ; [preuves Creator](creator-local-proof.json) et [aperçu](preview-local-proof.json) distinctes des captures serveur.                                                                                                                                                          | Réception des interactions actuelles dans une session navigateur autorisée ; ne pas présenter les tests de chaînes LaTeX comme des clics de clavier exécutés.                                                               |
| 8       | Engine officiel           | [1 540 tests et qualification Linux](engine-numeric-cache-proof.json), [adoption](engine-admin-adoption-proof.json), puis huit contrôles natifs après [reprise](local-recovery-2026-10-18-proof.json).                                                                                                    | Hôte de déploiement, compatibilité élève et nouvelle capacité de tracé de formules restent des portes séparées. La suite source Engine n’est pas relancée pendant la reprise.                                               |
| 9       | Aperçu et tests           | Seeds 0/42, génération/correction, projection et rapports signés : [Engine connecté](local-admin-engine-proof.json), adoption du 17 octobre.                                                                                                                                                              | Réception manuelle actuelle et tracés avancés encore ouverts ; conserver `indeterminate` et les diagnostics réels.                                                                                                          |
| 10      | Validation et publication | [Treize contrôles HTTP locaux](publication-http-connected-proof.json), transferts/retour, puis [huit contrôles après redémarrage](local-recovery-2026-10-18-proof.json). [Lots SQL](publication-batch-proof.json) distincts.                                                                              | Parcours HTTP par lot local qualifié (trois exercices, réponse perdue et reprise). Réception navigateur et première publication distante soumises à validation ; relecture synthétique sans validation pédagogique humaine. |
| 11      | Chapitres                 | CRUD, références et permissions : [référentiel](taxonomy-local-proof.json).                                                                                                                                                                                                                               | Réception navigateur et mise en service Staging ; aucun transfert automatique Production.                                                                                                                                   |
| 12      | Compétences               | CRUD, filtres, points, références stables et conflits : [référentiel](taxonomy-local-proof.json).                                                                                                                                                                                                         | Même réception ; ne pas déduire une couverture utilisateur actuelle des seules assertions SQL.                                                                                                                              |
| 13      | Flashcards                | CRUD, prévisualisation et permissions : [flashcards](flashcards-local-proof.json).                                                                                                                                                                                                                        | Réception navigateur ouverte ; aucune synchronisation Production en V1.                                                                                                                                                     |
| 14      | Dashboard et statistiques | Dashboard Staging et activité générale locale qualifiés. Filtres pédagogiques, regroupements/tri, lecture TLS minimisée et page/API Auth réels : [raccordement pédagogique](pedagogy-connected-proof.json). [Plans/charge synthétique et vrai pool simultané](pedagogy-performance-proof.json) qualifiés. | Source/activation Production, métriques restantes, volumétrie réelle/caches froids/hôte cible et réception navigateur restent ouverts.                                                                                      |
| 15      | Utilisateurs              | [Liste](users-readonly-proof.json) et [fiche détaillée](user-detail-proof.json) locales : identité minimisée, progression, historique, permissions SQL/TLS/HTTP.                                                                                                                                          | Source/identité Production et réception navigateur restent ouvertes ; données historiques non certifiées.                                                                                                                   |
| 16      | Qualité et tests          | Suites unitaires/SSR, SQL, concurrence, sauvegarde/restauration et HTTP datés ; erreurs intermédiaires conservées.                                                                                                                                                                                        | E2E navigateur, récupération connectée, expiration réelle et qualification distante non exécutés. Aucun test simulé ne remplace ces portes.                                                                                 |
| 17      | Organisation autonome     | Lots, preuves, décisions et commits locaux ; jalons de base `d17fbfa` et `30eefde`, correctif `4260d80`.                                                                                                                                                                                                  | Continuer les travaux autorisés indépendants, puis s’arrêter aux frontières d’autorisation ; ne pas recommencer les qualifications inchangées.                                                                              |
| 18      | Points d’arrêt            | Aucune écriture SQL distante, push, déploiement ou publication réelle. [Reprise normale sans mise à jour](local-recovery-2026-10-18.md). NovLearn limité au SQL local, Engine aux corrections autorisées.                                                                                                 | Autorisations distinctes pour futures opérations distantes, éventuelle mise à jour globale ou nouvelle capacité Engine hors D05.                                                                                            |
| 19      | Réussite complète         | **Non atteinte** : fonctions Production manquantes et P0 de réception/exploitation ouverts.                                                                                                                                                                                                               | Vérifier tous les critères initiaux avec des preuves correspondant à leur portée ; aucune clôture sur le seul nombre de tests.                                                                                              |
| 20      | Rapport et suivi          | [Progression](progress.md), [roadmap](roadmap.md), preuves et cette matrice.                                                                                                                                                                                                                              | Actualiser les résultats après chaque exécution ; garder séparés implémenté, exécuté, réceptionné et autorisé.                                                                                                              |

## Nature des blocages

**Docker : reprise locale vérifiée.** Après l’erreur sur `sailor-ingest.sock`,
l’arrêt complet est confirmé, les disques/paramètres sauvegardés à froid et
un démarrage normal réussit. Les services conservés, Auth, 3150/3152 et les
workers Linux sont rétablis sans mise à jour ni modification de protection.
La [preuve de reprise](local-recovery-2026-10-18-proof.json) conserve les résultats
et leurs limites ; le défaut de 4.90 n’est pas réputé définitivement corrigé.

**Navigateur : restriction de pilotage distincte.** Le refus de politique
antérieur reste respecté. Aucun autre navigateur, capture ou contrôleur n’est
utilisé pour obtenir les tests interdits. Une personne peut ouvrir normalement
l’aperçu et fournir ses observations. Le HTTP/SSR ne prouve pas le rendu visuel.

**Courbes : capacité Engine absente.** Le contrat `DisplayElementData` dit
explicitement « no ... graph sampling » ; les fonctions publiques et les huit
opérations du host ne fournissent pas d’échantillonnage. Les fonctions et suites
explicites/récurrentes portent `formulaDomain: unverified`. Le rendu des points
prescrits, vecteurs et figures existe ; le tracé d’une formule ne peut pas être
inventé dans Admin. D05 porte sur des corrections/certifications, pas sur une
extension implicite de ce contrat. Une proposition de capacité doit être revue
et autorisée avant toute modification de l’Engine.

**Production : lecteur et capacités applicatives encore manquants.** Le [rôle et
les premiers agrégats SQL](activity-readonly.md) sont qualifiés sur copies, y
compris refus, droits PUBLIC et restauration. Le [login TLS et lecteur serveur](activity-pg.md)
passent depuis sur copie synthétique ; la [page/API locale](activity-http.md) est
maintenant raccordée. La [liste nominative locale](users-readonly.md) est aussi
qualifiée ; les [fiches locales](user-detail.md) ajoutent progression et historique.
Production et filtres/métriques restants restent à réaliser. Les advisors locaux
(SQL 67 : 0 erreur, 45 avertissements, 65 informations) restent à traiter avant
une certification SQL globale. Un compte privilégié général ne devient pas limité par convention.

Les métriques doivent aussi distinguer leurs sources et leur fiabilité. Le
schéma local utilise `exercise_attempts.attempted_at` et
`duel_attempts.submitted_at` ; compter des profils ne prouve pas le nombre de
comptes Auth et un `is_correct` historique ne prouve pas un verdict Engine.
Les [limites des statistiques historiques](lot-1a-local-statistics-guard.md)
doivent rester visibles. Aucun résultat passé ne sera réattribué à une version,
recalculé ou présenté comme certifié sans preuve.

## Suite utile après reprise

La sauvegarde à froid, les services conservés et la reprise de publication
contre le relevé d’origine sont désormais vérifiés. Aucun environnement distant
n’est activé. Le prochain travail porte sur les fonctions et réceptions restantes :

1. Compléter filtres et métriques autour de la page/API SQL locale qualifiée,
   réception des fiches/progression/historique locaux (D08), constats advisors et
   version cible courante, avec permissions et minimisation vérifiées.
2. Réceptionner le parcours de récupération,
   MathLive et navigation dans un navigateur autorisé. Le HTTP ne prouve pas
   les effets du stockage navigateur.
3. Qualifier expiration, MFA et exploitation ; traiter séparément toute nouvelle
   capacité Engine proposée.
4. Avant application distante : réconciliation SQL, sauvegarde/restauration/PITR,
   compatibilité élève, identités/secrets séparés, hébergement approuvé et accord
   explicite. Publication et déploiement gardent leurs points d’arrêt distincts.

L’application connectée sur `http://127.0.0.1:3150/` permet les essais progressifs
avec les comptes conservés. L’aperçu sur `http://127.0.0.1:3140/` reste distinct,
sans base ni calcul Engine. Aucune date de livraison complète n’est établie
tant que les fonctions et réceptions ci-dessus restent ouvertes.
