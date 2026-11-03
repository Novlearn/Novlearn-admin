# Réception mission 1 — 30 octobre 2026

Mission autorisée par l'utilisateur, avec modifications Admin et Engine,
préservation des travaux existants, pilotes limités à la préproduction et aucune
écriture Production. **Mission non terminée.** Ce dossier sera complété après
les portes distantes ; il ne vaut pas réception de NovLearn.

## Référence et inventaire actuels

Admin : branche `main`, HEAD `6f590aea96d19641bee74b28c69690c9b72aa7ef`.
Engine : branche `main`, HEAD `baa48c45e27a5b94459feaae090f7b252df4791a`.
Les deux dépôts contenaient des modifications avant la mission, conservées.
Les sources Engine 0.2.0 (sampling, protocole, tests et documentation) restent
présentes ; elles ne sont pas intégrées à l'archive retenue ici. Aucun commit
ou push implicite. NovLearn est consulté en lecture seule.

Lecture SQL réelle du projet `tksvbkvfusrnxulpahky` : 112 exercices, un archivé,
une révision canonique `draft`, zéro pointeur actif, huit chapitres et 28 compétences.
Difficultés historiques : 52 Facile, 46 Moyen, 13 Difficile et une valeur absente.
Il ne s'agit pas d'une estimation fondée sur une capture. Aucune donnée de compte,
tentative ou score n'a été extraite pour cet inventaire.

Les policies anon/authenticated masquent les canoniques sans actif par des
policies **restrictives**. En revanche, la RPC definer `get_random_exercise`
sélectionne actuellement toutes les lignes, sans filtre canonique. Le code
NovLearn charge aussi les exercices via des lecteurs à service role. Une insertion
de pilote reste interdite tant que l'exclusion n'est pas reçue sur tous les
sélecteurs utiles. La simple absence de `active_version_id` ne suffit pas à la RPC.

## Artefact et matrice du pilote

Archive retenue localement : `novlearn-exercise-engine@0.1.1`,
SHA256 `c7116f9310da49478deb43ca64e04b974efd34765b45a22294c13b5235bdf927`.
Voir [manifeste](../vendor/engine-release-0.1.1.json) et
[contrat](engine-library.md). L'ancienne archive 0.1.0 d4d3abc4… est conservée.
Schéma 5, pipeline 0.1.0, génération `mulberry32-rejection-v1`, canonisation
applicative `pg-jsonb-text-v1`. Les exports et les huit opérations host restent
ceux de 0.1.0, sans sampling. Les octets de présentation numérique peuvent changer :
rejeu avec l'artefact exact ; anciens reçus non réétiquetés.

Le défaut reproduit est une réponse officielle sérialisée avec des séparateurs
de groupes numériques, puis refusée par l'admission numérique. Le correctif
utilise la sérialisation Cortex `digitGroup: 0` dans les deux chemins numériques.
Les sources originales, AST, calculs et contrôles d'entrée restent conservés.
Le test rejette toujours une entrée groupée hors profil.

| Capacité                           | Pilotes / limite                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Validation, variables, contraintes | API publique et host ; contrainte impossible = échec explicite                   |
| Instanciation et rejeu             | Seeds 0, 1, 42 ; snapshot privé lié à l'artefact                                 |
| Projection                         | Sélection officielle, sans définition, attendu, politique ou génération          |
| Correction                         | Numérique exacte, polynôme univarié, QCM ; autres familles hors réception pilote |
| Indétermination                    | Conservée ; jamais assimilée à une réponse incorrecte                            |
| Rendu                              | Texte, expressions, QCM, tableau de valeurs ; courbes 0.2.0 non adoptées         |
| Distribution                       | Archive locale immuable et lock ; aucune dépendance au dossier voisin            |

## État des lots

| Lot | Réalisé / reste                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Références et inventaire SQL réels ; artefact et périmètre pilotes explicites                                                                                        |
| A2  | Correctif ciblé et archive distincte ; qualification Linux locale obtenue ; contrôles intégrés en cours                                                              |
| A3  | Banc Admin protégé préparé, garde d'édition Vercel conservée ; déploiement de qualification autorisé par l'utilisateur, mesure distante restante                     |
| A4  | Cases, niveaux, recherches paginées, conservation des références et contrôles serveur ; réception connectée, filtres étendus et conflits restants                    |
| A5  | Vérification regroupée, détails avancés, rapport lié à la définition, consignation masquée pendant une édition ; réception connectée/publication/flashcards restante |
| A6  | Cinq définitions et cas synthétiques versionnés ; qualification intégrée en cours                                                                                    |
| A7  | **Aucun pilote distant enregistré ni relu.** Exclusion et autorisation SQL nécessaires                                                                               |
| A8  | Dossier de passage en cours ; prompt de mission 2 conditionné à une réception réelle                                                                                 |

## Contrôles exécutés et limites

- Réception package Linux 0.1.1 : installation hors ligne dans un consommateur
  isolé, opérations publiques du host, rejeu privé, projection et disparition des
  workers. 384 Mio, swap 0, 64 pids, réseau coupé ; image Node 24.19.0 épinglée.
- Source candidate : build/types/lint passent. Le contrôle composé s'arrête au
  format d'un ancien document CDC présent dans la copie de référence ; ce document
  n'est pas modifié pour masquer l'échec. Suite séparée : 1 542 réussites et deux
  dépassements à cinq secondes pendant des builds concurrents. Relance du fichier
  algébrique complet sans build concurrent : **126/126**, délai inchangé. Ne pas
  présenter cette combinaison comme un unique `npm run check` vert.
- Stockage privé : SQL exécuté sur copie synthétique PostgreSQL 16, sans réseau.
  Propriétaire, lectures distinctes, TTL dix minutes, archive, refus anon/élève,
  accès direct interdit, quotas deux/propriétaire et 32 globaux ; rollback exécuté.
- Exclusion RPC : fuite historique reproduite sur copie, filtre des brouillons,
  filtres chapitre/difficulté, 100 sélections aléatoires et retour au corps SQL
  distant exact (`md5=14fac9361afb35bb7fa64df3649551eb`) reçus.
- API : 82 tests ciblés de permissions, références, aperçu et banc passent ;
  13 tests d'orchestration réelle Engine via transport simulé et dix tests
  d'adaptateur de stockage passent. Ces tests ne sont pas une session Supabase réelle.
- Premier build Admin : compilation réussie puis refus d'écriture Windows.
  Relance avec accès aux sorties : build et smoke HTTP réussis avant adoption
  finale du package ; contrôles finaux restant à consigner.
- Navigateur synthétique : difficulté, cases indépendantes, pagination 26 compétences,
  sélection au clavier, recherche par alias et conservation après changement de
  chapitre observées. Aucune sauvegarde connectée déduite de ce banc.

## Propositions SQL, non appliquées à distance

1. [Instantanés privés](../scripts/proposals/preview-snapshots.sql) : table privée
   et deux RPC Admin avec propriétaire issu de la session, TTL et quotas.
   [Retour arrière](../scripts/proposals/preview-snapshots-rollback.sql) reçu sur copie.
   L'adaptateur utilise le client de session ; pas de nouvelle clé privilégiée.
   La route le prévoit pour Vercel ; les opérations d'édition y restent fermées.
2. [Exclusion des pilotes](../scripts/proposals/exclude-unpublished-pilots.sql) :
   modification du seul corps de la RPC aléatoire, avec garde contre dérive.
   [Retour arrière](../scripts/proposals/exclude-unpublished-pilots-rollback.sql)
   exact reçu sur copie. Vérifier les lecteurs à privilèges et les en-têtes des
   brouillons avant insertion. Aucune activation élève incluse.

La sauvegarde de brouillon existante crée un parent avec contenu vide et conserve
les métadonnées dans la révision. Les nouveaux contrôles de références dans Admin
ne remplacent pas les validations SQL/RLS et éditoriales existantes.

## Manifeste des pilotes

Définitions : [corpus synthétique](../examples/admin-engine-pilots/definitions.json).
Références observées dans la base existante ; aucun nouveau référentiel créé.

| Convention de titre    | Référence                                        | Comportement                                     | IDs / révisions distants |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------ | ------------------------ |
| `[PILOTE ADMIN M1-01]` | Suites numériques / calculer_des_termes          | Fixe numérique exact                             | Aucun                    |
| `[PILOTE ADMIN M1-02]` | Suites numériques / calculer_des_termes          | Paramètre et contrainte                          | Aucun                    |
| `[PILOTE ADMIN M1-03]` | Dérivation et Fonctions / calculer_une_derivee   | Équivalence polynomiale sur les réels            | Aucun                    |
| `[PILOTE ADMIN M1-04]` | Suites numériques / reconnaitre_suites_arith_geo | Flash, QCM, sans calculatrice                    | Aucun                    |
| `[PILOTE ADMIN M1-05]` | Suites numériques / calculer_des_termes          | Calculatrice, deux questions, tableau de valeurs | Aucun                    |

Relance distante future : rechercher la convention de titre, vérifier l'empreinte
de définition et les références avant création ; aucun ID présumé libre. Conserver
le manifeste des IDs réellement retournés. Pas de retrait ou archivage automatique.

## Portes encore nécessaires

Le banc connecté a réellement tourné sur le déploiement autorisé
`dpl_9JmZiJD94mDNC24Ym9ig3wA5dED7` : Linux x64, Node 24.22.2,
Python attendu non exécutable, profil cgroup non lisible et refus `unavailable`
du host officiel dès `validateDefinition`. Voir la
[décision d'hôte à expliquer](engine-host-decision.md). Aucune incompatibilité
générale de Vercel n'est déduite de cette seule mesure.

L'utilisateur demande maintenant un prompt explicatif avant de décider de
l'hébergement. Aucune nouvelle installation ou qualification conteneurisée
distante n'est autorisée à ce stade. Les migrations, signatures et sauvegardes
de pilotes distants restent à recevoir séparément.

Contrôles finaux supplémentaires : **1 571 tests Admin / 84 fichiers passent** ;
types et lint passent (un avertissement historique sur l'image du banc) ; build
final et smoke HTTP passent. Deux consommateurs autonomes passent avec les cinq
pilotes sur trois seeds. Le host Linux exact Admin exécute **108 appels** pour
les cinq pilotes, quotas inchangés et arrêt des workers constaté. Le correctif
est aussi construit et testé (quatre tests ciblés) dans les sources Engine 0.2.0,
sans adoption de leurs autres travaux.

Le builder connecté a chargé le référentiel réel : pagination des 28 compétences,
sélection au clavier, alias de chapitre, cases indépendantes et conservation
d'une compétence après changement de chapitre observés. Aucun exercice enregistré
pendant ce contrôle. Les propositions SQL ne sont appliquées que sur copie.

Un correctif local ultérieur du lanceur de développement lit le manifeste courant
au lieu de conserver l'archive 0.1.0 en dur ; il ne change pas le déploiement de
qualification. La suite A4/A5 et la réception complète ne sont pas annoncées
terminées. Les pilotes seront enregistrés après les contrôles et la garantie
d'exclusion des anciens parcours.
