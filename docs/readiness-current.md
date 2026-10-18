# État de livraison — 18 octobre 2026

**NovLearn Admin n’est pas terminé.** Les fonctions de contenu disposent de
preuves locales, mais les statistiques/utilisateurs Production ne sont pas
opérationnels et plusieurs réceptions restent ouvertes. Le contrat et l’affichage
des statistiques sont [préparés sur exemple fictif](activity-statistics.md), sans
lecteur Production. Les [services locaux sont rétablis](local-recovery-2026-10-18.md) :
connexion, sauvegarde, reconnexion et Engine passent. Les fonctions Production
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

| Section | Exigence                  | État et preuve disponible                                                                                                                                                                                                    | Reste nécessaire                                                                                                                                                                            |
| ------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Audit initial             | CDC, schéma local et API Engine examinés ; décisions et historique dans [progression](progress.md) et [Lot 1A](lot-1a-preparation.md).                                                                                       | Réconcilier le schéma/historique distant avant application ; les relevés du 13 octobre ne prouvent pas l’état distant actuel.                                                               |
| 2       | Architecture              | Next, TypeScript strict, services serveur, contrats et package Engine verrouillés ; contrôle complet référencé dans [correctif de récupération](recovery-cleanup-proof.json).                                                | Capacité de lecture Production et hébergement à concevoir/qualifier ; aucune clé générale ne vaut un droit limité.                                                                          |
| 3       | Auth et sécurité          | Vrais comptes, session fraîche, sauvegarde et reconnexion après panne : [reprise locale](local-recovery-2026-10-18-proof.json). Refus/révocation antérieurs dans [Auth locale](local-admin-proof.json).                      | Expiration réelle, MFA, provision opérationnel et réception Staging non certifiés.                                                                                                          |
| 4       | Interface générale        | Identité [visuelle](visual-implementation.md), navigation, formulaires, retours d’erreur et essais sur 3140.                                                                                                                 | Réception visuelle/accessibilité actuelle ; aucun succès navigateur déduit de la compilation ou du SSR.                                                                                     |
| 5       | Gestion des exercices     | CRUD, conflits, versions, duplication et archivage dans [catalogue](catalogue-local-proof.json) et parcours Auth/REST réels.                                                                                                 | La fiche affiche la version active **Staging** ; l’indication courante de la version active **Production** reste à raccorder à une capacité autorisée.                                      |
| 6       | Creator visuel            | Édition canonique des vingt types, variables, contraintes, questions, politiques ; [Creator](creator-local-proof.json), [récupération](creator-recovery-proof.json).                                                         | Réception de la récupération en navigateur et avec la sauvegarde connectée ; courbes de formules non prises en charge faute de points calculés officiels.                                   |
| 7       | MathLive                  | Saisie et clavier existants ; [preuves Creator](creator-local-proof.json) et [aperçu](preview-local-proof.json) distinctes des captures serveur.                                                                             | Réception des interactions actuelles dans une session navigateur autorisée ; ne pas présenter les tests de chaînes LaTeX comme des clics de clavier exécutés.                               |
| 8       | Engine officiel           | [1 540 tests et qualification Linux](engine-numeric-cache-proof.json), [adoption](engine-admin-adoption-proof.json), puis huit contrôles natifs après [reprise](local-recovery-2026-10-18-proof.json).                       | Hôte de déploiement, compatibilité élève et nouvelle capacité de tracé de formules restent des portes séparées. La suite source Engine n’est pas relancée pendant la reprise.               |
| 9       | Aperçu et tests           | Seeds 0/42, génération/correction, projection et rapports signés : [Engine connecté](local-admin-engine-proof.json), adoption du 17 octobre.                                                                                 | Réception manuelle actuelle et tracés avancés encore ouverts ; conserver `indeterminate` et les diagnostics réels.                                                                          |
| 10      | Validation et publication | [Treize contrôles HTTP locaux](publication-http-connected-proof.json), transferts/retour, puis [huit contrôles après redémarrage](local-recovery-2026-10-18-proof.json). [Lots SQL](publication-batch-proof.json) distincts. | Parcours HTTP multi-exercices complet non exécuté ; première publication réelle interdite sans accord distinct. Les attestations synthétiques ne valent pas validation pédagogique humaine. |
| 11      | Chapitres                 | CRUD, références et permissions : [référentiel](taxonomy-local-proof.json).                                                                                                                                                  | Réception navigateur et mise en service Staging ; aucun transfert automatique Production.                                                                                                   |
| 12      | Compétences               | CRUD, filtres, points, références stables et conflits : [référentiel](taxonomy-local-proof.json).                                                                                                                            | Même réception ; ne pas déduire une couverture utilisateur actuelle des seules assertions SQL.                                                                                              |
| 13      | Flashcards                | CRUD, prévisualisation et permissions : [flashcards](flashcards-local-proof.json).                                                                                                                                           | Réception navigateur ouverte ; aucune synchronisation Production en V1.                                                                                                                     |
| 14      | Dashboard et statistiques | Agrégats **Staging** : [Dashboard](dashboard-local-proof.json). Contrat et affichage préparés sur [exemple fictif](activity-statistics-proof.json).                                                                          | Statistiques **Production à raccorder** : capacité read-only effective, calculs SQL, filtres pédagogiques, permissions et preuves sur copie puis environnement approuvé.                    |
| 15      | Utilisateurs              | Nom, e-mail et activité retenus par [D08](decisions.md). Aucun écran ni lecteur Production opérationnel n’est encore livré.                                                                                                  | Capacité bornée, liste/recherche/pagination, profils autorisés, progression, activité et historique synthétique à implémenter et qualifier.                                                 |
| 16      | Qualité et tests          | Suites unitaires/SSR, SQL, concurrence, sauvegarde/restauration et HTTP datés ; erreurs intermédiaires conservées.                                                                                                           | E2E navigateur, récupération connectée, expiration réelle et qualification distante non exécutés. Aucun test simulé ne remplace ces portes.                                                 |
| 17      | Organisation autonome     | Lots, preuves, décisions et commits locaux ; jalons de base `d17fbfa` et `30eefde`, correctif `4260d80`.                                                                                                                     | Continuer les travaux autorisés indépendants, puis s’arrêter aux frontières d’autorisation ; ne pas recommencer les qualifications inchangées.                                              |
| 18      | Points d’arrêt            | Aucune écriture SQL distante, push, déploiement ou publication réelle. [Reprise normale sans mise à jour](local-recovery-2026-10-18.md). NovLearn limité au SQL local, Engine aux corrections autorisées.                    | Autorisations distinctes pour futures opérations distantes, éventuelle mise à jour globale ou nouvelle capacité Engine hors D05.                                                            |
| 19      | Réussite complète         | **Non atteinte** : fonctions Production manquantes et P0 de réception/exploitation ouverts.                                                                                                                                  | Vérifier tous les critères initiaux avec des preuves correspondant à leur portée ; aucune clôture sur le seul nombre de tests.                                                              |
| 20      | Rapport et suivi          | [Progression](progress.md), [roadmap](roadmap.md), preuves et cette matrice.                                                                                                                                                 | Actualiser les résultats après chaque exécution ; garder séparés implémenté, exécuté, réceptionné et autorisé.                                                                              |

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

## Suite utile après reprise

La sauvegarde à froid, les services conservés et la reprise de publication
contre le relevé d’origine sont désormais vérifiés. Aucun environnement distant
n’est activé. Le prochain travail porte sur les fonctions et réceptions restantes :

1. Concevoir et qualifier sur copie la capacité de lecture Production ; préparer
   agrégations réelles, utilisateurs nom/e-mail/activité (D08) et version cible
   courante, avec permissions et minimisation vérifiées.
2. Exécuter le parcours HTTP multi-exercices complet ; réceptionner récupération,
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
