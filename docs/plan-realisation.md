# Plan de réalisation : Admin, Engine et NovLearn

**Ordre d'exécution actualisé :** [mission 1 Admin + Engine + pilotes](mission-admin-engine.md),
puis mission 2 NovLearn développement dans une conversation distincte, puis
livraison Production et conversion générale. Le [prompt de mission 1](prompt-mission-admin-engine.md)
définit les autorisations et exclusions ; les lots historiques ci-dessous sont
une référence de couverture, pas une invitation à commencer NovLearn maintenant.

Plan retenu le 21 octobre 2026. Il complète [l'état actuel](roadmap.md) et
[l'architecture](architecture.md), sans annoncer les étapes suivantes comme
implémentées ou réceptionnées. Le [CDC](../CDC_reference.md) reste inchangé.

Précisions produit du 30 octobre : consulter le [plan de simplification](plan-simplification.md)
pour le pilote de quatre/cinq exercices avant conversion générale, la publication
en préproduction puis la promotion sélective en production et le circuit direct
Production des flashcards. Ce dernier élargit le périmètre produit à formaliser
dans le CDC avant réalisation ; aucune écriture distante autorisée par ce plan.

## Objectif et architecture

Livrer un parcours complet : connexion Admin, création, validation Engine,
génération et correction, sauvegarde, réouverture, tests enregistrés, relecture,
publication contrôlée, réalisation dans NovLearn et reprise de tentative.

**NovLearn Engine est une bibliothèque TypeScript versionnée commune aux
serveurs Admin et NovLearn.** Elle porte contrats, validation, variables,
contraintes, génération, instanciation, projections, correction et diagnostics.
Les applications ne développent aucun calcul ou correcteur concurrent.

| Composant                      | Responsabilité                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Engine                         | Bibliothèque mathématique indépendante et host serveur borné                               |
| Admin                          | Édition, tests, relecture et publication ; appels Engine côté serveur                      |
| NovLearn classique             | Rendu public, parcours élèves et orchestration des tentatives ; appels Engine côté serveur |
| Supabase                       | Auth, permissions, définitions versionnées, instances privées, tentatives et journaux      |
| Application native, ultérieure | Rendu et consommation des API applicatives ; hors chemin critique                          |

La distribution en bibliothèque n'impose pas un microservice. Le serveur peut
appeler le host Engine qui exécute les opérations dans un worker isolé. La cible
Admin retenue est Vercel : qualifier d'abord l'exécution et les limites réelles
du package sur cet hôte. Si le profil requis n'y est pas réalisable, présenter
les alternatives : Admin et worker borné sur un même hôte Linux, ou transport
depuis Vercel vers un service Linux utilisant la même bibliothèque. Un service
séparé ajoute réseau, authentification et exploitation ; aucun nouvel hôte n'est
installé sans autorisation. Aucune variante ne relâche les quotas actuels.

Ne jamais lever le refus Vercel actuel par simple drapeau ni remplacer le host
officiel par un évaluateur dans le thread applicatif. Voir les contraintes et
preuves dans [Vérifications](verification.md) et [Déploiement](vercel.md).

## Ordre de réalisation

### 1. Fixer le périmètre et la référence

**Dépendance :** aucune.

- Confirmer les révisions Git des trois dépôts et préserver les modifications.
- Partir de l'archive Engine 0.1.0 actuellement épinglée et qualifiée ; ne pas
  adopter automatiquement la 0.2.0 et ses courbes.
- Lister les types et parcours à recevoir : Admin, exercice classique, DS et
  duels. Séparer le premier pilote du CDC complet.
- Prévoir une configuration opérationnelle lisible : un seul `.env` privé local,
  le modèle dans la documentation et les variables propres à chaque hébergement.
  Réduire les doublons sans fusionner les secrets Staging/Production ni retirer
  les contrôles de sécurité. Ce point n'autorise aucune suppression immédiate.

**Acceptation :** matrice fermée des fonctionnalités, rendus, consommateurs et
contrats à recevoir ; aucune fonction annoncée sur la seule présence d'un écran.

### 2. Stabiliser Engine comme bibliothèque distribuable

**Réception du 22 octobre :** [distribution de l'archive retenue](engine-library.md)
testée dans deux consommateurs minimaux indépendants ; API, manifeste et procédure
de mise à jour formalisés. Le raccordement applicatif NovLearn et la qualification
d'un nouvel hôte restent respectivement aux lots 6 et 3.

**Dépendance :** 1.

- Formaliser les exports publics, contrats, opérations et host serveur.
- Garder Next.js, Supabase, Auth, stockage et UI hors du cœur mathématique.
- Produire des artefacts immuables ; distinguer version du package, empreinte,
  schéma, pipeline de génération et canonisation.
- Conserver l'archive versionnée pour commencer ; choisir un registre privé
  seulement s'il simplifie les mises à jour. Pas de dépendance au chemin voisin.
- Documenter diagnostics, compatibilité et procédure de mise à jour coordonnée.

**Acceptation/tests :** installation dans un consommateur minimal, exports/types,
validation, génération, correction, projections, déterminisme et limites.
Admin et NovLearn doivent installer l'artefact retenu de façon reproductible.

### 3. Qualifier l'exécution serveur

**Dépendance :** 1–2 et choix d'hébergement.

- Qualifier Linux x64, Node, Python et cgroup v2 pour le package installé.
- Conserver les plafonds mémoire/processus, délais, tailles, files et protections.
- Isoler le worker des secrets Auth/DB et du réseau ; superviser arrêt/reprise.
- Commencer avec une instance Admin. Les aperçus et quotas actuels sont locaux
  au processus : plusieurs réplicas exigent une stratégie qualifiée distincte.

**Acceptation/tests :** calcul réel sous charge bornée, timeout, annulation,
saturation, pression mémoire, crash, absence d'orphelins et reprise. Aucun quota
augmenté pour obtenir un résultat positif. Le cgroup partagé avec Next, s'il
est retenu, doit aussi être testé avec le serveur actif.

### 4. Terminer Admin avec Engine

**Dépendance :** 2–3 ; permissions de l'étape 5 avant ouverture.

- Réutiliser catalogue, Creator, MathLive, révisions et routes existantes.
- Rétablir validation, génération par seed, projection et correction officielles.
- Afficher les diagnostics et invalider les résultats après modification.
- Recevoir les types retenus ; signaler explicitement tout rendu incomplet.
- Résoudre l'écart du CDC §16 sur la validation avant sauvegarde. Selon le CDC
  actuel, appeler Engine avant sauvegarde et refuser les définitions invalides.
  Une persistance de brouillons incomplets demande une exception décidée et
  tracée avant son implémentation, sans statut « testé » ou « validé » indu.

**Acceptation/tests :** bonnes/mauvaises réponses, formats invalides, équivalences,
rejeu, cycles, dépendances inconnues, contraintes impossibles et budgets épuisés.
Un exercice peut être créé, testé, sauvegardé et rouvert sans altération.

### 5. Recevoir permissions et cycle éditorial

**Dépendance :** commence après 1, accompagne 3–4 ; bloque toute ouverture.

- Vérifier session/rôle serveur, origine, tailles et accès directs SQL/RPC.
- Revoir RPC definer, grants historiques et notamment `get_random_exercise`.
- Préparer les corrections sur copie ; coordonner fermeture des lectures privées
  et adaptation des consommateurs pour éviter une rupture historique aveugle.
- Recevoir conflits, expiration, révocation, déconnexion et récupération.
- Provisionner explicitement la signature pour les rapports persistants et la
  relecture ; conserver les anciens reçus comme historiques.

**Acceptation/tests :** matrice anon/invité/élève/admin, deux propriétaires,
origines étrangères, accès directs/RPC et auto-attribution de rôle. Aucune
lecture d'attendu ou d'instance privée par l'élève. Une modification, une nouvelle
époque ou un changement d'artefact invalide l'attestation courante.

### 6. Raccorder NovLearn classique

**Dépendance :** 2–5 et autorisation de modifier NovLearn.

- Installer Engine côté serveur et charger une révision canonique autorisée.
- Instancier côté serveur, conserver le snapshot privé et projeter vers l'élève.
- Recevoir la réponse, retrouver l'instance et enregistrer le verdict Engine.
- Adapter le renderer au contrat public ; retirer génération et autorité de
  correction du navigateur pour les parcours convertis.
- Conserver FastAPI pour ses responsabilités existantes. Utiliser la partie
  serveur Node ou un pont local minimal pour Engine TypeScript, sans réécriture
  mathématique en Python ni nouveau backend Admin.

**Acceptation/tests :** même définition/seed/identité d'instance et même artefact,
mêmes résultats entre Admin et NovLearn. Refus des verdicts falsifiés et des
changements d'instance, de version ou de propriétaire. La tentative reprise
retrouve son snapshot initial. Le pilote peut employer une cible isolée publiée
par le mécanisme approuvé ; aucun brouillon rendu public pour faciliter l'essai.

### 7. Transition historique, DS et duels

**Dépendance :** 6.

- Classer les exercices : compatibles, adaptables, reprise manuelle nécessaire.
- Utiliser seulement l'adaptateur legacy isolé d'Engine lorsqu'il est justifié.
- Préserver identités et références ; ne pas inventer de version aux anciennes
  tentatives dépourvues de preuve.
- Retirer l'autorité de `is_correct` dans les DS et de `isCorrect` dans les duels.
- Fournir la même instance officielle aux participants d'un duel.
- Fermer progressivement les anciens accès aux contenus privés après réception
  des nouveaux consommateurs. Garder explicites les parcours non convertis.

**Acceptation/tests :** non-régression historique, reprise, instance commune,
doubles soumissions, verdict falsifié et absence de fuite de réponses privées.

### 8. Recevoir la publication Staging → Production

**Dépendance :** 5–7 ; autorisations et qualification propres aux deux cibles.

- Réconcilier schémas/migrations et recevoir sauvegarde/restauration.
- Réutiliser l'orchestration développée, avec identités SQL minimales séparées.
- Mapper par `catalog_id`, vérifier références/ressources et compatibilité Engine.
- Transférer uniquement le contenu métier approuvé des deux tables autorisées.
- Recevoir confirmation, journal, idempotence, issue incertaine et rollback.
- Déployer le consommateur compatible avant de lui proposer le nouveau contenu.

**Acceptation/tests :** révision modifiée, droits insuffisants, répétition,
interruption, échec partiel, observation de cible et réactivation d'une ancienne
version. Aucun transfert de profils, tentatives, Auth ou tables exclues ; aucune
réécriture des anciennes tentatives ni migration implicite lors d'une publication.

### 9. Mettre en service et compléter Admin

**Dépendance :** 4–8.

- Recevoir le parcours complet sur les domaines réels, puis chapitres,
  compétences, flashcards et dashboard.
- Raccorder statistiques/utilisateurs Production via des lecteurs minimaux
  distincts ; conserver minimisation et origine explicite des données.
- Recevoir accessibilité, MathLive, performances et erreurs.
- Documenter exploitation, supervision, rotation, sauvegarde/restauration et
  retour au build précédent ; exécuter les contrôles adaptés au delta final.
- Encadrer les mises à jour Engine : conserver l'ancien artefact nécessaire au
  rejeu ou prouver explicitement la compatibilité avant son retrait.

**Acceptation :** réception humaine et technique liée aux commits, artefacts et
hôtes réellement déployés. Aucune preuve historique présentée comme essai actuel,
aucune fonction simulée présentée comme opérationnelle.

### 10. Application native — extension hors chemin critique

**Dépendance :** contrats et parcours serveur web stabilisés.

- Réutiliser les API applicatives de création/reprise et de soumission.
- Construire rendu natif des projections publiques et saisie mathématique mobile.
- Conserver génération, attendus et correction sur les serveurs utilisant Engine.
- Ne pas imposer l'embarquement du runtime Engine dans l'application native.
  Un mode hors ligne demanderait une étude distincte.

**Acceptation/tests :** compatibilité des contrats, Auth, perte de réseau,
reprise, rendu et absence de données privées dans le client.

## Réception finale et limites à conserver

Parcours : **connexion → création → validation → génération/correction →
sauvegarde → réouverture → tests enregistrés → relecture → publication →
réalisation élève → reprise de tentative**. Tester au moins les seeds 0 et 42,
une réponse correcte, une incorrecte, un format invalide et un cas impossible.
Une réception sur cible isolée précède toute écriture Production autorisée.

Bornes actuelles : opération native 5 s file comprise, mémoire 384 Mio maximum,
heap 128 Mio, swap nul, 64 pids maximum, entrée 1 Mio, sortie 2 Mio, stderr
64 Kio ; host Admin 1 actif/4 en attente. JSON Admin 256 Kio ; aperçu/correction
20 s, tests 120 s, transport local 10 s. Tests : 1–5 seeds distinctes, 16 cas,
8 questions maximum. Snapshots : 10 min, 2/Admin, 32/processus, 512 Kio chacun ;
travaux 1/Admin et 2/processus. Toutes les autres gardes existantes restent
applicables, y compris signature et publication.

## Décisions et autorisations

- Choisir hôte, domaine, région, budget et responsable d'exploitation.
- Choisir la distribution du package ; conserver l'artefact actuel avant toute
  adoption d'une nouvelle version qualifiée.
- Décider explicitement l'exception de brouillon incomplet si souhaitée.
- Autoriser séparément les changements des dépôts voisins, les migrations et
  écritures par environnement, le provisionnement de signature et les déploiements.
- Le modèle à deux tables, le périmètre de publication et la place centrale
  d'Engine sont déjà fixés : ne pas rouvrir ces arbitrages sans besoin.

Ce plan n'engage aucun développement, installation, accès distant ou déploiement.
Chaque lot s'arrête à sa réception avant de démarrer le suivant.
