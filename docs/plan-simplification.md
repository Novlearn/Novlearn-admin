# Simplifier le catalogue, le builder et la publication

Pour l'exécution, suivre désormais le [découpage en missions](mission-admin-engine.md) :
Admin/Engine et sauvegarde des pilotes d'abord, NovLearn développement dans une
seconde conversation, conversion générale et Production ensuite. Les lots de ce
document décrivent la couverture complète, sans autoriser un démarrage de NovLearn
pendant la mission Admin.

Proposition du 30 octobre 2026. Analyse du code Admin, du package Engine installé
et de sources locales NovLearn en lecture seule. Intervention documentaire :
aucune fonctionnalité, base, archive Engine ou application voisine modifiée ;
aucun nouveau test applicatif exécuté. Le CDC reste inchangé.

## État constaté et incertitudes

- La capture affiche **112 exercices** ; « environ 120 » reste à réconcilier par
  inventaire. Elle ne démontre pas que toutes les pages sont historiques.
- Le [catalogue](../src/lib/catalogue.ts) distingue `legacy` (« Historique ») et
  `archived` (« Archivé »). La [fiche](../src/app/admin/exercises/[id]/page.tsx)
  passe en lecture seule sans version canonique chargée. Cela décrit la
  compatibilité avec le builder, pas l'activité de l'exercice dans NovLearn.
  La fonction SQL et l'état réel des versions distantes restent à inventorier.
- Le [builder](../src/components/draft-metadata-form.tsx) utilise un chapitre
  libre, des compétences séparées par virgules, une difficulté numérique minimum
  1 et un select Classique/Flash. La calculatrice est déjà une case.
- L'[API du référentiel](../src/app/api/admin/taxonomy/route.ts) possède recherche,
  pagination et filtrage des compétences par chapitre. La réutiliser.
- Engine 0.1.0 exige une difficulté entière positive. NovLearn utilise notamment
  `easy/medium/hard` et `0/1/2` dans `Novlearn/backend/recommandation.py` et
  `Novlearn/frontend/app/lib/competenceScore.ts` ; certaines chaînes françaises
  sont aussi reconnues. Les correspondances sont dispersées.
- L'adaptateur officiel `novlearn-exercise-engine/legacy` demande des recettes
  explicites : domaines, politiques de correction, réponses et arbitrage des
  flags contradictoires. Il ne garantit pas la conversion de tout le catalogue.
  Dans l'archive actuelle, il ne renseigne pas directement `catalogue.difficulty` :
  compléter cette correspondance éditoriale sans perdre la valeur d'origine.
- La [prévisualisation](../src/components/exercise-preview.tsx) expose seeds et
  cas de test. La [relecture](../src/components/editorial-review.tsx) impose un
  rapport courant, plusieurs seeds et des attestations séparées. La
  [publication](../src/components/publication-panel.tsx) possède déjà diff,
  confirmation, journal et reprise : réutiliser ce travail.
- Engine, relecture et publication sont indisponibles sur le profil Vercel
  actuel. Simplifier l'écran ne suffit pas à les activer.

## Catalogue cible

Séparer **compatibilité** (« Ancien format · à convertir ») et **état éditorial**
(Brouillon, Prêt à publier, Publié, Archivé). « Prêt » signifie contrôles et
approbation courants, jamais simple sauvegarde. Un exercice historique n'est pas
automatiquement déclaré publié ou archivé.

Afficher séparément la révision en préparation et la version effectivement active
dans NovLearn. Si la cible n'est pas lisible : « Publication non vérifiée ».
Ajouter les filtres chapitre, compétence, difficulté, Flash et compatibilité ;
proposer par ligne Ouvrir, Préparer la conversion, Corriger ou Publier.
Les outils de lots passent dans un mode dédié, toujours limité à cinq exercices.
Les archives restent consultables avec un filtre explicite. Harmoniser les
libellés « Préproduction » sans renommer les bases ou contrats pour un motif visuel.

## Builder cible et difficulté

- **Exercice flash** : case cochée → `flash`, décochée → `classic`. Cela concerne
  le mode de présentation, pas le type mathématique des réponses. Conserver
  **Calculatrice nécessaire** comme case indépendante. Aucun nouveau schéma requis.
- **Chapitre** : recherche nom/alias, sélection unique parmi les références.
- **Compétences** : recherche, sélection multiple, badges retirables, filtre par
  chapitre et identifiants existants. Changement de chapitre : signaler les
  incompatibilités, sans supprimer silencieusement les compétences sélectionnées.
- Une référence historique inconnue reste visible « à rapprocher ». Ne pas
  créer de chapitre ou compétence par simple saisie dans ce formulaire.
- L'UI manipule identifiant/libellé ; le serveur vérifie existence et association.
  Résoudre le chapitre vers la représentation contractuelle actuelle : ne pas
  remplacer aveuglément le texte de `catalogue.chapter` par un UUID. Vérifier
  SQL et consommateurs avant toute évolution de stockage ; aucun champ improvisé
  dans le contrat Engine.

Recommandation : trois choix **Facile / Moyen / Difficile**, sans nombre libre.

| Affichage | Ordinal Engine | Valeur historique | Indice NovLearn |
| --------- | -------------- | ----------------- | --------------- |
| Facile    | 1              | `easy`            | 0               |
| Moyen     | 2              | `medium`          | 1               |
| Difficile | 3              | `hard`            | 2               |

Zéro reste un indice applicatif, pas une difficulté Engine. Ne pas ajouter un
quatrième niveau sans besoin pédagogique et réception recommandations/DS/scores.
Une difficulté inconnue demande une décision, jamais un repli automatique sur
Facile. Choix obligatoire pour rendre publiable ; conserver l'incomplétude visible
d'un brouillon selon la décision CDC décrite plus bas.

## Parcours courant : enregistrer, vérifier, publier en préproduction

1. **Enregistrer** une révision de travail, en indiquant ses éventuels manques.
2. **Vérifier et prévisualiser** : orchestrer côté serveur les contrôles Engine et
   les références. Profil de seeds reproductible par défaut, par exemple les
   valeurs déjà proposées `0, 1, 42`. Masquer la saisie des seeds dans les options
   avancées ; proposer « Autre variante » pour l'aperçu courant.
3. Afficher un bilan simple : structure, génération/contraintes, correction,
   projection sans réponses privées et compatibilité. Automatiser les cas lorsque
   les contrats et fixtures approuvées le permettent. Un cas non automatisable
   exige un contrôle ciblé ; ne jamais fabriquer un succès ou un verdict.
4. **Relire** l'aperçu et confirmer explicitement énoncé, corrections et références
   en une action humaine regroupée, sans précochage ni approbation automatique.
   Une seconde personne n'est pas imposée par l'interface si les règles serveur
   existantes autorisent l'auteur à approuver ; vérifier ce point avant changement.
5. **Publier en préproduction** : récapitulatif métier court, cible et changements, puis une
   confirmation finale. Le serveur orchestre les transitions nécessaires et
   constate le résultat. « Publié » apparaît seulement après confirmation cible.
   Une issue incertaine déclenche la vérification de l'opération existante avant
   une nouvelle écriture, jamais un renvoi aveugle.

## Décision produit : préproduction, promotion et flashcards

Précision explicitement demandée par l'utilisateur après ce plan :

- **Exercices :** brouillon en préproduction → publié dans NovLearn préproduction
  → sélection de révisions reçues → **Promouvoir en production**. Ce dernier
  bouton est distinct et montre explicitement la cible élèves. Pas de sélecteur
  ambigu de destination sur un bouton « Publier » générique.
- Une publication en préproduction rend uniquement la révision sélectionnée
  disponible dans le catalogue de test de NovLearn, jamais les brouillons. Elle
  conserve une version active et ses anciennes révisions. Un contrôle serveur et
  une attestation courants restent requis ; aucun accès public général à la base.
- La promotion copie les révisions exactes testées, avec identités et références
  vérifiées. Aucun merge automatique de JSON ni copie de base. Le statut cible
  est distinct du statut préproduction : « Publié en préproduction », « À
  promouvoir », « Identique en production » ou « Production différente ».
- **Flashcards :** circuit séparé de publication directe vers la production,
  sans passage imposé par le catalogue de préproduction des exercices. Aperçu
  local puis action explicite **Publier en production** ; une saisie intermédiaire
  n'écrit pas automatiquement en production. Après publication, modification
  explicite et versionnée, contrôle de conflit, journal et retour arrière.
- Les flashcards utilisent une capacité serveur propre limitée à leurs opérations
  et aux références autorisées ; ne pas élargir le transfert des deux tables
  d'exercices. Vérifier que le chapitre existe réellement en production. Ne pas
  synchroniser implicitement chapitres, compétences ou autres données.

Réception flashcards distincte : aperçu → publication explicite → lecture dans
NovLearn production → modification avec conflit détecté → retour à l'état
précédent. Tester sur copie les refus anonymes/non-Admin, chapitre cible absent,
double envoi et panne ; le pilote distant demande son autorisation propre.

Ce circuit des flashcards **n'est pas celui implémenté actuellement** : les routes
utilisent le client de préproduction. Le CDC actuel prévoit aussi leur gestion
en Staging et exclut leur propagation du mécanisme exercices. L'accord produit
est tracé ici ; préparer une mise à jour ciblée et explicite du CDC avant
implémentation, sans prétendre que l'accès Production existe déjà. Cette décision
n'est pas une autorisation d'écrire dans la base pendant la planification.

## Adapter NovLearn avant la conversion générale

L'utilisateur demande un pilote de **quatre ou cinq exercices canoniques neufs**,
créés dans Admin puis publiés en préproduction. Les choisir pour représenter les
usages réellement visés : fixe/aléatoire, contraintes et équivalences, Flash et
calculatrice, types de réponses utilisés et rendu graphique s'il est supporté.
Ne pas prendre cinq exemples équivalents qui cacheraient les écarts de contrat.

Ordre retenu :

1. Préparer ces exercices avec le contrat et l'archive Engine retenus.
2. Adapter NovLearn sur la branche de développement, sur la base de préproduction :
   chargement de révision, génération serveur, snapshot privé, projection, rendu,
   soumission et correction Engine. Recevoir aussi recommandations, DS et duels
   dans leur périmètre réel ; un mode non raccordé n'est pas déclaré compatible.
3. Recevoir les quatre/cinq exercices de bout en bout. Ensuite seulement convertir
   des représentants historiques et préparer les familles du catalogue complet.
4. Préparer une livraison coordonnée code/contenu : contrat, archive, révisions
   exactes, références disponibles sur cible, résultats et procédure de retour.
5. Déployer d'abord un code compatible avec la bascule prévue, sans exposer les
   nouveaux exercices. Promouvoir le contenu testé puis vérifier/activer les
   versions prévues. Respecter le mécanisme de publication et ses cinq exercices
   maximum par lot. Réception et constat d'échec restent individuels.

Un merge Git, un déploiement et une écriture de contenu ne forment pas une
transaction commune. « Même livraison » ne signifie donc pas simultanéité
atomique de toute la base. Préparer les versions inactives lorsque le mécanisme
le permet ; sinon conserver l'ancien actif jusqu'à publication confirmée de
chaque exercice. Une activation globale serait un besoin distinct à concevoir,
pas un contournement des limites de lots actuelles. Aucun remplacement massif
ni promesse de conversion parfaite avant inventaire et réception.

Le code de transition peut lire les deux formats de façon explicitement isolée,
mais tous les nouveaux exercices canoniques utilisent Engine. Après conversion
et réception des parcours, retirer les anciens générateurs et correcteurs des
tentatives nouvelles. Les tentatives déjà engagées conservent leur version ;
les anciens snapshots restent interprétables, sans recalcul des scores.
Engine devient l'unique autorité mathématique, avec son adaptateur historique
isolé si encore nécessaire ; aucune correction de secours créée dans les clients.
Cela ne remplace pas Auth, FastAPI, stockage, rendu React ou les flashcards
statiques, qui gardent leurs responsabilités.

Les états internes, signatures et identifiants restent techniques. Les conserver
dans la première simplification : aucune nouvelle couche de certification ni
nouvelle clé pour un simple changement UI. Réutiliser le rapport courant de la
révision exacte ; toute modification invalide vérification et approbation.
Les détails restent consultables pour diagnostiquer un échec.

Conserver les limites actuelles : 1–5 seeds, au moins deux pour l'approbation,
16 cas, Engine 5 s, aperçu/correction 20 s, tests 120 s, mémoire et files bornées.
Si la couverture dépasse un budget, signaler la limite sans tronquer ni augmenter
silencieusement les quotas. Une réussite ne vaut que pour les cas exécutés.

Conserver permissions serveur/RLS, instantanés privés, conflits, compatibilité,
publication sélective, idempotence, journal et retour à une version précédente.
Production Vercel héberge Admin ; la base d'édition reste la préproduction et
la base élèves Production reste une cible distincte.

## Reprise des exercices existants

Une définition canonique par exercice sera nécessaire pour le nouveau builder et
Engine, mais **pas une ressaisie manuelle systématique**.

1. Inventorier en lecture seule IDs, versions, familles de contenus, domaines,
   réponses, flags, chapitre, compétences et difficulté. Classer : déjà canonique,
   convertible par recette connue, ambigu/non supporté. Chiffrer les catégories.
2. Préparer des recettes par famille avec l'adaptateur officiel. Arbitrer
   explicitement les domaines/politiques absents et les flags contradictoires ;
   isoler les cas bloqués pour reprise humaine.
3. Essayer sur copie des représentants de chaque famille : énoncé, contraintes,
   bonnes/mauvaises réponses, références et rendu. Ne pas promettre le rejeu
   identique de l'ancien générateur.
4. Après accord et sauvegarde restaurable, créer des révisions de travail sans
   remplacer les sources ni changer la version active. Préserver identité,
   correspondance `catalog_id` et liens des anciennes tentatives. Conversion
   relançable sans doublons, avec empreinte source, recette, archive et diagnostics.
5. Recevoir un pilote dans NovLearn, puis convertir les familles progressivement.
   Garder le parcours historique jusqu'à réception de son remplaçant. Aucun
   recalcul global des scores ni réinterprétation des anciennes réponses.

## Petits lots ordonnés

Ne pas commencer automatiquement le lot suivant. Les tests ciblés complètent les
suites existantes ; les contrôles globaux sont réservés aux changements intégrés
et à l'activation. Ne pas supprimer des tests de permissions ou de correction
pour simplifier l'interface.

| Lot / dépendances               | Périmètre                                                                                                                                 | Critères d'acceptation et tests                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · aucune                      | Inventaire réel en lecture seule ; décisions champs/statuts ; RPC distante et contrats consommateurs.                                     | Compte réconcilié, familles/anomalies listées, correspondances vérifiées ; aucune écriture ni réponse privée dans le rapport.                                                                            |
| 2 · 1                           | Cases, recherche du référentiel, difficulté à trois libellés et vocabulaire catalogue ; API existantes.                                   | Recherche paginée/clavier, multisélection, changement de chapitre, erreurs ; serveur refuse références inconnues ou incohérentes ; sauvegarde/réouverture sans perte. Tests UI/API et navigateur ciblés. |
| 3 · 1, parallèle possible de 2  | Qualifier Engine sur Vercel et conserver les aperçus privés entre requêtes ; décision d'hôte si incompatible.                             | Archive exacte, validation/génération/correction/projection, déterminisme, arrêt et quotas ; autre utilisateur refusé, expiration, requêtes sur instances différentes. Aucun simple retrait de garde.    |
| 4 · 2–3                         | Vérification unique, seeds par défaut, bilan/avancé, sauvegarde et relecture regroupées.                                                  | Réussite/échec/couverture incomplète, résultat obsolète après édition, faux rapport refusé, annulation, attestation explicite. Types/lint/build selon delta et tests ciblés.                             |
| 5 · 1–4                         | Quatre/cinq exercices canoniques neufs publiés en préproduction ; préparer les recettes historiques sur copie.                            | Représentants de chaque famille, ambiguïtés bloquées, métadonnées conservées, relance sans doublons ; source/actif/tentatives préservés.                                                                 |
| 6 · 3–5 + autorisation NovLearn | Adapter NovLearn sur le pilote neuf avant conversion générale ; recevoir ensuite un pilote historique et les correspondances éditoriales. | Même contrat/archive/définition/seed : résultats cohérents ; recommandations/DS/scores compatibles ; correction serveur et aucune fuite d'attendu.                                                       |
| 7 · 4–6 + cible autorisée       | Publication préproduction puis promotion sélective vers production ; flashcards directes par circuit séparé.                              | Version inchangée, références cible, confirmation, double clic, conflit, panne, issue incertaine, journal/rollback sur copie ; pilote distant autorisé sans transfert des autres tables.                 |
| 8 · pilote reçu                 | Conversion progressive, filtres finaux, lots et exploitation.                                                                             | Bilan convertis/bloqués, contrôle de chaque révision publiée, cinq maximum par lot et résultat individuel ; parcours final reçu.                                                                         |

## Réception finale

Connexion Supabase Admin → création → chapitre existant et compétences associées →
difficulté/Flash/calculatrice → sauvegarde → vérification Engine → aperçu et
réponses testées → réouverture → attestation humaine → récapitulatif/confirmation →
publication préproduction constatée → réception dans NovLearn préproduction → promotion sélective → version active dans NovLearn production → tentative et correction
serveur. Refaire avec un historique converti et une nouvelle révision d'un publié ;
l'ancienne version reste active jusqu'à publication confirmée.

Contrôler aussi anonymat, non-Admin, autre propriétaire, conflit et panne. Bancs
sur copies, puis pilote distant avec contenu d'essai explicitement autorisé et
retour arrière. Les preuves anciennes ne valent pas réception de ce nouveau flux.

## Décisions et autorisations

- Cases Flash/calculatrice et recherche de références répondent à la demande.
  Trois niveaux et nouveaux libellés d'état restent des recommandations à arrêter
  au lot 1 ; aucune renumérotation globale effectuée.
- La sauvegarde incomplète diverge du CDC §16 : décision traçable avant réalisation.
  Confronter la relecture regroupée au CDC §§9 et 11 ; toute suppression d'exigence
  demande une évolution explicitement approuvée. Aucun changement silencieux ici.
- Modifier Engine ou NovLearn, créer une infrastructure, migrer SQL, convertir à
  distance et publier vers les élèves sont des autorisations distinctes, sur un
  résultat concret revu. Ce plan n'en réalise aucune et ne présume aucun secret.
- L'application native reste hors chemin critique : API serveur NovLearn,
  projections publiques et versions cohérentes ; aucun attendu privé ni verdict
  faisant autorité dans le client mobile.

Ce plan complète le [plan de réalisation](plan-realisation.md) sans remplacer ses
dépendances de sécurité et compatibilité. Périmètre actuel : planification.
