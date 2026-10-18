# État de livraison — 18 octobre 2026

**NovLearn Admin n’est pas terminé.** Les fonctions de contenu disposent de
preuves locales, mais les statistiques/utilisateurs Production ne sont pas
implémentés et plusieurs réceptions restent ouvertes. Le démarrage Docker
empêche actuellement les essais connectés ; il n’explique pas à lui seul les
fonctionnalités manquantes.

Cette matrice couvre les vingt sections de la demande `/goal` jointe. Elle
renvoie aux preuves datées, sans les convertir en une qualification du système
actuellement arrêté. Le [relevé machine](readiness-current.json) conserve les
références et leurs empreintes ; sa couverture documentaire n’est pas un test
fonctionnel réussi.

Le [relevé distant du 18 octobre](lot-1a-remote-reconciliation-current.md)
actualise les seules métadonnées : 70 entrées de migration par projet, 25 sans
statements, et absence d’`exercise_versions`. Les colonnes, policies et
contraintes sélectionnées correspondent ; trois fonctions gardent des hashes
bruts différents mais des corps rapprochés après normalisation documentée.
Aucune écriture ni qualification globale des deux bases n’en est déduite.

## Correspondance avec la demande initiale

| Section | Exigence                  | État et preuve disponible                                                                                                                                                                                      | Reste nécessaire                                                                                                                                                                                                          |
| ------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Audit initial             | CDC, schéma local et API Engine examinés ; décisions et historique dans [progression](progress.md) et [Lot 1A](lot-1a-preparation.md).                                                                         | Réconcilier le schéma/historique distant avant application ; les relevés du 13 octobre ne prouvent pas l’état distant actuel.                                                                                             |
| 2       | Architecture              | Next, TypeScript strict, services serveur, contrats et package Engine verrouillés ; contrôle complet référencé dans [correctif de récupération](recovery-cleanup-proof.json).                                  | Capacité de lecture Production et hébergement à concevoir/qualifier ; aucune clé générale ne vaut un droit limité.                                                                                                        |
| 3       | Auth et sécurité          | Vrais comptes locaux, rôle serveur frais, refus et révocation dans [Auth locale](local-admin-proof.json) et [relecture](local-admin-review-proof.json).                                                        | Reprise des services ; expiration réelle, MFA, provision opérationnel et réception Staging non certifiés.                                                                                                                 |
| 4       | Interface générale        | Identité [visuelle](visual-implementation.md), navigation, formulaires, retours d’erreur et essais sur 3140.                                                                                                   | Réception visuelle/accessibilité actuelle ; aucun succès navigateur déduit de la compilation ou du SSR.                                                                                                                   |
| 5       | Gestion des exercices     | CRUD, conflits, versions, duplication et archivage dans [catalogue](catalogue-local-proof.json) et parcours Auth/REST réels.                                                                                   | La fiche affiche la version active **Staging** ; l’indication courante de la version active **Production** reste à raccorder à une capacité autorisée.                                                                    |
| 6       | Creator visuel            | Édition canonique des vingt types, variables, contraintes, questions, politiques ; [Creator](creator-local-proof.json), [récupération](creator-recovery-proof.json).                                           | Réception de la récupération en navigateur et avec la sauvegarde connectée ; courbes de formules non prises en charge faute de points calculés officiels.                                                                 |
| 7       | MathLive                  | Saisie et clavier existants ; [preuves Creator](creator-local-proof.json) et [aperçu](preview-local-proof.json) distinctes des captures serveur.                                                               | Réception des interactions actuelles dans une session navigateur autorisée ; ne pas présenter les tests de chaînes LaTeX comme des clics de clavier exécutés.                                                             |
| 8       | Engine officiel           | [1 540 tests et qualification Linux](engine-numeric-cache-proof.json), puis [adoption locale](engine-admin-adoption-proof.json) de l’archive exacte d4d3abc4…a582f9.                                           | Docker indisponible aujourd’hui ; aucun nouveau calcul natif revendiqué. Qualification de l’hôte de déploiement et compatibilité élève restent des portes séparées.                                                       |
| 9       | Aperçu et tests           | Seeds 0/42, génération/correction, projection et rapports signés : [Engine connecté](local-admin-engine-proof.json), adoption du 17 octobre.                                                                   | Réception manuelle actuelle et tracés avancés encore ouverts ; conserver `indeterminate` et les diagnostics réels.                                                                                                        |
| 10      | Validation et publication | Relecture réelle locale ; [13 contrôles HTTP](publication-http-connected-proof.json), deux révisions, retour et conservation des historiques. [Lots](publication-batch-proof.json) qualifiés dans leur portée. | Reprise après redémarrage et parcours HTTP multi-exercices complet non exécutés ; première publication réelle interdite sans accord distinct. Les attestations synthétiques ne valent pas validation pédagogique humaine. |
| 11      | Chapitres                 | CRUD, références et permissions : [référentiel](taxonomy-local-proof.json).                                                                                                                                    | Réception navigateur et mise en service Staging ; aucun transfert automatique Production.                                                                                                                                 |
| 12      | Compétences               | CRUD, filtres, points, références stables et conflits : [référentiel](taxonomy-local-proof.json).                                                                                                              | Même réception ; ne pas déduire une couverture utilisateur actuelle des seules assertions SQL.                                                                                                                            |
| 13      | Flashcards                | CRUD, prévisualisation et permissions : [flashcards](flashcards-local-proof.json).                                                                                                                             | Réception navigateur ouverte ; aucune synchronisation Production en V1.                                                                                                                                                   |
| 14      | Dashboard et statistiques | Agrégats **Staging** : [Dashboard](dashboard-local-proof.json).                                                                                                                                                | Statistiques **Production à implémenter** : capacité read-only effective, métriques, agrégations, filtres, permissions et preuves sur copie puis environnement approuvé.                                                  |
| 15      | Utilisateurs              | Aucun écran ni lecteur Production opérationnel n’est livré ; la navigation ne propose pas de page vide.                                                                                                        | Liste/recherche/pagination, champs de profil autorisés, progression, activité et historique synthétique à implémenter après cadrage de la capacité et des données minimales.                                              |
| 16      | Qualité et tests          | Suites unitaires/SSR, SQL, concurrence, sauvegarde/restauration et HTTP datés ; erreurs intermédiaires conservées.                                                                                             | E2E navigateur, récupération connectée, expiration réelle et qualification distante non exécutés. Aucun test simulé ne remplace ces portes.                                                                               |
| 17      | Organisation autonome     | Lots, preuves, décisions et commits locaux ; jalons de base `d17fbfa` et `30eefde`, correctif `4260d80`.                                                                                                       | Continuer les travaux autorisés indépendants, puis s’arrêter aux frontières d’autorisation ; ne pas recommencer les qualifications inchangées.                                                                            |
| 18      | Points d’arrêt            | Aucune écriture SQL distante ; ni push, ni déploiement, ni publication réelle. NovLearn limité au SQL local, Engine aux corrections autorisées.                                                                | Accord pour une réparation logicielle globale ; autorisations distinctes pour les futures opérations distantes ou une nouvelle capacité Engine hors D05.                                                                  |
| 19      | Réussite complète         | **Non atteinte** : fonctions Production manquantes et P0 de réception/exploitation ouverts.                                                                                                                    | Vérifier tous les critères initiaux avec des preuves correspondant à leur portée ; aucune clôture sur le seul nombre de tests.                                                                                            |
| 20      | Rapport et suivi          | [Progression](progress.md), [roadmap](roadmap.md), preuves et cette matrice.                                                                                                                                   | Actualiser les résultats après chaque exécution ; garder séparés implémenté, exécuté, réceptionné et autorisé.                                                                                                            |

## Nature des blocages

**Docker : erreur technique observée.** Le journal du 18 octobre décrit l’échec
de démarrage sur `sailor-ingest.sock`. Les ports 3150/3152 et les API Auth locales
ne répondent pas dans les derniers contrôles. La mise à jour officielle avec
sauvegarde a été proposée, sans installation. L’arrêt complet requis pour
sauvegarder les disques n’a pas encore été obtenu. Ce n’est pas une preuve
d’une nouvelle interdiction Smart App Control. Voir [diagnostic et reprise](publication-http-connected.md).

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

**Production : implémentation et capacité encore manquantes.** La lecture
analytique doit rester distincte de l’identité de publication et de la session
Auth Staging. Il faut limiter techniquement colonnes/fonctions, tester les
privilèges effectifs et les droits hérités de PUBLIC, TLS, refus d’écriture,
timeouts et pagination avant activation. Un nom de clé ou une transaction
`READ ONLY` ne suffit pas à rendre un login compromis inoffensif.

Les métriques doivent aussi distinguer leurs sources et leur fiabilité. Le
schéma local utilise `exercise_attempts.attempted_at` et
`duel_attempts.submitted_at` ; compter des profils ne prouve pas le nombre de
comptes Auth et un `is_correct` historique ne prouve pas un verdict Engine.
Les [limites des statistiques historiques](lot-1a-local-statistics-guard.md)
doivent rester visibles. Aucun résultat passé ne sera réattribué à une version,
recalculé ou présenté comme certifié sans preuve.

## Ordre de reprise utile

1. Après accord pour la réparation globale : arrêt normal complet, sauvegarde
   vérifiée des disques/configurations, mise à jour officielle vérifiée et
   remise en route de Docker. Aucune réinitialisation, suppression de volume,
   désactivation de protection ou modification manuelle de socket.
2. Redémarrer **les services conservés**, puis 3150 avec Engine/relecture et le
   banc de publication 3152. Garder les mêmes clés, données et comptes.
   Ne pas recréer les copies pour éviter de tester la conservation.
3. Exécuter la reprise préparée contre son relevé d’origine, puis les nouveaux
   essais connectés de récupération et le scénario HTTP multi-exercices.
4. Concevoir et qualifier la capacité de lecture Production sur copie ; préparer
   statistiques, utilisateurs et indication de version cible courante avec des
   champs minimisés et des états d’indisponibilité explicites.
5. Réceptionner les parcours dans un navigateur autorisé, qualifier les sessions
   et l’exploitation ; traiter séparément toute extension Engine proposée.
6. Avant toute application distante : réconciliation SQL réelle, sauvegarde et
   restauration/PITR, compatibilité élève, identités/secrets séparés, hébergement
   approuvé et autorisation explicite. Publication et déploiement sont des
   opérations différentes, chacune avec son point d’arrêt.

L’aperçu `http://127.0.0.1:3140/` permet les retours d’interface pendant la panne,
sans Auth, sauvegarde ni Engine. Les essais connectés peuvent reprendre avant
la fin du projet dès que leurs services sont rétablis et vérifiés. Aucune date
de disponibilité complète n’est établie tant que les travaux et portes ci-dessus
ne sont pas réalisés.
