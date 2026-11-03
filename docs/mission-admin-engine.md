# Mission 1 : terminer Admin, Engine et les pilotes de préproduction

Découpage demandé le 30 octobre 2026. Ce document ordonne l'exécution future du
[plan de simplification](plan-simplification.md) et du
[plan général](plan-realisation.md). Cette conversation prépare les documents,
sans commencer l'implémentation. Les états et résultats antérieurs restent des
preuves datées, pas une réception de cette mission.

## Trois missions et leurs frontières

| Mission                    | Résultat attendu                                                                                                                                                   | Hors périmètre                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1 · Admin + Engine         | Builder corrigé, bibliothèque et exécution qualifiées, parcours Admin complet, quatre/cinq pilotes sauvegardés et relus en préproduction, dossier de raccordement. | Modification de NovLearn, conversion globale, publication élèves, infrastructure non autorisée. |
| 2 · NovLearn développement | Consommation des pilotes par le frontend et FastAPI existants, orchestration serveur Engine, rendu et parcours élèves reçus en préproduction.                      | Mise en production générale, modification massive des exercices, application native.            |
| 3 · Livraison et catalogue | Conversion historique progressive, livraison coordonnée code/contenu, promotion sélective, circuit Production des flashcards reçu.                                 | Copie globale de base, réécriture des anciennes tentatives, correcteur concurrent.              |

La mission 1 n'annonce pas une compatibilité NovLearn reçue : elle prépare les
contrats et exemples, puis la mission 2 les vérifie dans l'application réelle.

## Décisions de travail

- Admin reste sur Vercel, avec la base Supabase de préproduction existante
  (`tksvbkvfusrnxulpahky`). Un seul `.env` privé à la racine ; modèle dans la
  documentation, mêmes noms nécessaires dans Vercel, aucun secret versionné.
- Engine est une bibliothèque TypeScript/ESM commune, installée depuis un
  artefact immuable et un lockfile. Pas de dépendance vers le dossier voisin.
  Contrats, validation, génération, contraintes, instances, projections,
  correction et diagnostics restent dans Engine ; l'orchestration métier reste
  dans les applications. Aucun calcul de secours dans Admin ou les clients.
- Cases indépendantes Flash et calculatrice ; recherche du chapitre et des
  compétences existants, références contrôlées au serveur. Difficulté proposée
  à trois libellés, ordinals Engine 1/2/3 et indices NovLearn 0/1/2 selon la
  correspondance documentée. Valeurs inconnues signalées, jamais corrigées au hasard.
- Brouillon en préproduction → publication dans NovLearn préproduction →
  promotion de révisions choisies vers Production. En mission 1, préparer le
  premier mécanisme et les pilotes ; ne pas les activer dans l'ancien parcours
  NovLearn tant que son lecteur canonique n'est pas reçu en mission 2.
- Flashcards : aperçu puis publication directe Production par circuit dédié.
  En mission 1, préparer code, UI et tests sur copie, sans activer ni utiliser
  une écriture distante Production. Ce circuit ne passe pas par le transfert
  limité aux deux tables d'exercices.
- Sauvegarde explicite d'un brouillon incomplet possible, sans statut vérifié
  ni publication. Toute publication nécessite les contrôles Engine et références,
  l'approbation humaine et la compatibilité courants. Regrouper les actions et
  masquer les paramètres techniques, sans suppression implicite des contrôles.
- Préparer les modifications ciblées du CDC correspondant à ces décisions,
  visibles dans le diff, avant de réaliser les nouveaux comportements. Ne pas
  réécrire le reste du CDC. Tout autre changement de contrat produit est explicite.

## Ordre d'exécution de la mission 1

### A1 · Établir les références

Lire les AGENTS applicables dans chaque dépôt avant d'y travailler, le CDC et les
documents actuels. Relever Git/diffs/branches dans Admin et Engine ; préserver
les modifications existantes. Consulter NovLearn en lecture seule pour ses
contrats, sa difficulté, ses références et son chargement des exercices.

Comparer l'archive Engine installée avec les sources voisines, notamment le
travail 0.2.0 déjà présent : opérations, exports/types, génération, sampling,
diagnostics, tests et preuves. Ne pas confondre sources plus récentes et package
qualifié ; aucune adoption/reconstruction silencieuse de 0.1.0.

Inventorier le catalogue et le référentiel en lecture seule si l'accès autorisé
est disponible : compte réel, versions, formats, difficultés, correspondances,
RPC et permissions. Sinon documenter les limites et utiliser des fixtures
locales ; ne pas déclarer un inventaire distant accompli.

**Fin de lot :** choix d'artefact explicite, matrice opérations/types/limites et
écarts, périmètre des pilotes fixé. Aucune écriture dans le catalogue existant.

### A2 · Stabiliser la bibliothèque Engine nécessaire à la V1

Réutiliser les opérations publiques et le host officiels. Corriger dans Engine
les défauts démontrés nécessaires au parcours retenu, y compris les fonctions
déjà promises par le builder ; signaler clairement toute capacité non supportée.
Pas de refonte générale ni d'ajout de fonctions sans besoin du parcours.

Si l'artefact doit changer : nouvelle version, archive distincte, empreinte,
exports, schéma, pipeline et canonisation documentés séparément ; mise à jour du
manifeste/lock Admin après qualification. Conserver l'ancien artefact utile au
rejeu. Fournir le même artefact à la mission NovLearn, pas une copie de code.

**Acceptation :** installation autonome reproductible, exports/types, validation,
génération et contraintes, instanciation, projection, correction
correcte/incorrecte/invalide/indéterminée, déterminisme et erreurs de versions.
Cas adverses et limites réellement exécutés ; aucun verdict inventé.

### A3 · Qualifier l'exécution sur Vercel et les aperçus privés

Vérifier la documentation officielle actuelle et les caractéristiques du projet
avant tout diagnostic hébergement. Préparer un banc serveur protégé à entrées
synthétiques, sans base réelle, puis qualifier le lanceur officiel dans le
runtime visé. Collecter la cause exacte d'un échec ; ne pas déduire une
impossibilité Vercel d'une simple garde applicative ou d'un échec Windows.

Conserver les budgets actuels : Engine 5 s file comprise, mémoire 384 Mio,
heap 128 Mio, 1 actif/4 en attente, limites entrée/sortie et processus du host.
Consulter les autres bornes dans le plan général. Un timeout de Promise ne
préempte pas un calcul synchrone. Ne pas enlever une garde avant d'avoir une
exécution de remplacement équivalente reçue. Ne pas relâcher les quotas pour
obtenir un résultat positif.

Recevoir les instantanés privés entre requêtes et instances : propriété,
expiration, correction depuis le snapshot serveur, références opaques. Réutiliser
le stockage adapté existant ; aucune réponse privée dans le navigateur, les
logs publics ou une table lisible par les élèves. Garder la disponibilité du
serveur sous charge et l'arrêt effectif des travaux hors budget.

**Fin de lot :** fonctionnement démontré ou incompatibilité précisément étayée.
Si une infrastructure Linux ou un coût nouveau est indispensable, présenter
l'option minimale concrète et obtenir l'autorisation avant installation.
Un service séparé n'est pas présumé obligatoire ; Engine reste une bibliothèque.
La mission ne peut être déclarée complète avec Engine encore inutilisable.

### A4 · Corriger le builder et le catalogue

Réutiliser le référentiel et ses API paginées pour les sélecteurs recherchables.
Gérer clavier, multi-sélection, chargement/erreur, valeurs historiques inconnues
et changement de chapitre sans suppression silencieuse. Vérifier les références
au serveur. Respecter leur représentation dans le contrat actuel.

Mettre les deux cases et les difficultés nommées ; séparer origine historique,
statut éditorial et état de publication par cible. Harmoniser Préproduction.
Une version active non vérifiée n'est jamais annoncée comme publiée.
Ne pas convertir les exercices pour faire fonctionner ces écrans.

**Acceptation :** rendu et navigation, validation de références incohérentes,
sauvegarde/réouverture, nouvelle révision, conflit, récupération et absence de
perte des métadonnées. Tests ciblés composants/API, puis navigateur.

### A5 · Raccorder le parcours Admin complet

Créer → enregistrer → vérifier/prévisualiser → tester une réponse → rouvrir →
approuver pour les essais en préproduction. Utiliser les routes, rapports et
transitions existants ; un résultat correspond à la révision exacte.

Un bouton lance les contrôles et un profil de seeds reproductible (par défaut
0, 1, 42 si approprié). Réserver paramètres et rapports détaillés au mode avancé.
Automatiser seulement les cas dont la construction est justifiée ; demander une
vérification ciblée des autres. Conserver couverture et bornes (1–5 seeds,
16 cas, minimum deux seeds pour l'approbation, aperçu/correction 20 s, tests 120 s).
Toute modification invalide le résultat courant ; aucune approbation implicite.

Préparer les actions distinctes Publier en préproduction / Promouvoir en
production et le circuit flashcards. Les parties Production sont testées sur
copie et restent désactivées à distance en mission 1. Éviter toute nouvelle
couche ou variable d'environnement si les services existants suffisent.

**Acceptation :** parcours connecté complet, diagnostics lisibles, refus
anonyme/non-Admin/autre propriétaire/origine invalide, faux verdict et rapport
obsolète refusés. Publication sur copie : confirmation, double clic, interruption,
issue incertaine, idempotence, observation cible et rollback.

### A6 · Préparer cinq exercices pilotes locaux

| Pilote | Comportement à couvrir                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------- |
| 1      | Exercice fixe, réponse numérique et correction exacte.                                                  |
| 2      | Variables aléatoires, contraintes et rejeu de plusieurs seeds.                                          |
| 3      | Réponse symbolique/équivalence avec domaine et politique explicites.                                    |
| 4      | Flash, sans calculatrice, avec un autre type de réponse réellement supporté.                            |
| 5      | Classique avec calculatrice et plusieurs questions ; figure si son rendu et son contrat sont supportés. |

Adapter les thèmes aux vrais chapitres/compétences. Pas de nouveau référentiel
pour faire passer un exemple. Fixtures versionnées, attendus de test dans les
bancs privés appropriés, définitions et versions reproductibles. Un rendu non
supporté ne passe pas grâce à une image ou à un calcul de secours masquant l'écart.

**Acceptation :** Engine + Admin passent les cas corrects/incorrects/invalides,
les contraintes et le rejeu ; un consommateur minimal installe l'artefact et
consomme les projections, sans prétendre avoir testé NovLearn réel.

### A7 · Intégrer les pilotes en préproduction

Seulement après qualification locale et contrôle de la cible : sauvegarder les
quatre/cinq pilotes via les opérations Admin autorisées, puis les relire via le
parcours connecté. Utiliser un marqueur d'identification existant ou une
convention de titre et un manifeste externe ; ne pas modifier le schéma Engine
pour ajouter un tag de test. Réexécution sans doublons, aucun ID supposé libre.

L'intégration se limite aux pilotes et aux relations indispensables existantes.
Si une évolution SQL additive est nécessaire, présenter le diff exact, ses effets
et son retour arrière ; l'essayer sur copie avant toute application autorisée.
Pas de suppression, restauration globale, conversion du catalogue ou modification
des comptes/tentatives/scores. Aucune écriture élèves Production.

Tant que NovLearn développement n'est pas adapté, les pilotes restent sauvegardés
et vérifiables dans Admin sans entrer dans les recommandations, DS ou duels de
l'ancien consommateur. Si cette exclusion n'est pas garantie par le mécanisme
actuel, résoudre le problème sur copie avant insertion distante. Ne pas confondre
« enregistré en préproduction » et « reçu/publié dans NovLearn préproduction ».

**Preuve :** cible, IDs et révisions, empreintes, références, archive Engine,
résultats des contrôles et relecture confirmée. Aucun mot de passe ni attendu
privé dans la documentation publique. Prévoir retrait/archivage contrôlé des seuls
pilotes ; ne pas supprimer automatiquement des données à la fin du test.

### A8 · Fermer la mission et transmettre à NovLearn développement

Exécuter les contrôles appropriés au delta intégré : suites Engine, installation
autonome, tests Admin, types/lint, build et smoke ; réception navigateur connectée
et relecture distante des pilotes. Séparer les échecs antérieurs, vérifications
locales, simulations et parcours distants réellement exécutés.

Fournir un dossier de passage contenant :

- commits/branches et modifications restantes des deux dépôts, sans push implicite ;
- artefact exact, lockfiles, contrats et procédure d'installation/mise à jour ;
- liste des cinq pilotes, révisions, références et limites d'activation ;
- entrées/sorties de l'API serveur, stockage/propriété/expiration des instances ;
- opérations Engine nécessaires, résultats et limites réellement reçus ;
- difficultés et métadonnées attendues par NovLearn, rendus encore manquants ;
- étapes de raccordement FastAPI/React, recommandation/DS/duels, tests et rollback ;
- prompt complet de mission 2 fondé sur cet état final, à exécuter séparément.

## Critère de fin et blocages

La mission 1 est terminée seulement si Engine fonctionne sur l'hôte retenu,
Admin réalise le parcours complet et quatre/cinq exercices sont effectivement
sauvegardés puis relus dans la bonne base, sans exposer les anciens parcours.
Une dépendance d'accès, d'hébergement ou d'autorisation manquante est un blocage
explicite ; les fixtures ou un formulaire actif ne remplacent pas cette preuve.
Terminer les parties indépendantes, présenter les éléments concrets à approuver,
sans inventer un succès ni commencer la mission 2.

## Suite : missions 2 et 3

Mission 2 : lire les AGENTS NovLearn ; auditer l'état réellement laissé par la
mission 1 ; utiliser l'artefact exact ; adapter les serveurs et rendus existants,
préserver FastAPI et Supabase Auth, recevoir les cinq pilotes de bout en bout.
Instanciation et correction côté serveur, projection seule au client ; aucune
autorité pour `is_correct`/`isCorrect` venant des clients. Recevoir chaque mode
retenu, la reprise et les tentatives en cours. Ne pas migrer toute la base pour
réussir le pilote. L'application native viendra ensuite consommer ces API.

Mission 3 : recettes historiques qualifiées par famille et migrations sur copie,
sélection des révisions, code compatible d'abord puis promotion/activation
contrôlée du contenu ; cinq maximum par lot. Un merge Git et les écritures DB ne
sont pas atomiques. Garder anciens actifs et mécanisme de retour jusqu'au constat
de réussite. Reprendre les flashcards via leur circuit dédié, après réception
des permissions et autorisation Production. Retirer progressivement l'ancienne
autorité mathématique pour les nouvelles tentatives, sans altérer l'historique.
