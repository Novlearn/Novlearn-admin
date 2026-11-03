# Engine : bibliothèque distribuable

L'Admin consomme l'archive **0.1.8**. Elle poursuit la série 0.1.x et ajoute
l'échantillonnage optionnel de courbes dans la projection publique ; les sources
du travail principal 0.2.0 ne sont pas adoptées. L'archive 0.1.1 et son
[correctif ciblé](../vendor/engine-0.1.1.patch), ainsi que l'archive 0.1.0,
restent conservés pour l'historique et le rejeu. Le
[dossier de réception](mission-admin-engine-reception.md) distingue les nouveaux
contrôles locaux et le déploiement de qualification autorisé de l'activation Engine.

## Artefact et responsabilités

Le [manifeste de distribution](../vendor/engine-release.json) identifie le package,
les exports, dépendances, opérations du protocole et les 169 fichiers de l'archive.
Chaque fichier a son SHA256. La racine portable ne dépend que de CortexJS ; le
graphe des 27 modules ESM est contrôlé. Next.js, React, Supabase, Auth, stockage,
MathLive et rendu restent hors de ce cœur. `legacy` et le host sont des sous-chemins
explicites, absents du graphe portable.

| Identité                 | Valeur et portée                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Package ESM              | `novlearn-exercise-engine`, version `0.1.8`, Node `>=24.19.0 <25`, npm `>=11.17.0 <12`                                 |
| Artefact                 | `vendor/novlearn-exercise-engine-0.1.8.tgz`, SHA256 `82e499726db2da454627903ed65802eaa2ab3e7185f7f6cb3c84c1cbdbde3cea` |
| Schéma                   | `5` : définition, instance et soumission                                                                               |
| Pipeline                 | `0.1.0`, champ `engineVersion` des instances ; distinct de la version npm                                              |
| Génération               | `mulberry32-rejection-v1` ; champ `generation.version` du snapshot                                                     |
| Contrat applicatif       | `schema-5;engine-0.1.0`                                                                                                |
| Canonisation Admin/SQL   | `pg-jsonb-text-v1` : empreintes de stockage, pas une opération du cœur Engine                                          |
| Host privé               | Protocole JSON `1`, non exposé librement au navigateur                                                                 |
| Dépendances verrouillées | CortexJS `0.151.0`, `@arnog/colors` `0.7.3`, `complex.js` `2.4.3`                                                      |

Le numéro npm seul ne suffit pas : des archives historiques 0.1.0 différentes
existent. L'identité d'artefact est le couple version/empreinte du manifeste.
Conserver cette archive, ne pas la remplacer par un nouveau `npm pack` des
sources courantes. Les futurs correctifs demandent une nouvelle version et un
nouvel artefact, avec qualification coordonnée. Les empreintes détectent des
changements mais ne remplacent pas une provenance Git revue ou l'autorisation.

## API publique retenue

Les déclarations TypeScript distribuées dans l'archive sont l'autorité sur les
signatures et unions. Seuls les trois points d'entrée déclarés dans `exports`
sont supportés ; aucun import profond `dist/...`, objet boxed CortexJS ou
module interne ne fait partie de l'API.

| Import                               | Exports JavaScript et responsabilité                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `novlearn-exercise-engine`           | `validateDefinition`, `validateSubmission`, `parseMathInput`, `generateVariables`, `instantiateExercise`, `projectPublicInstance`, `gradeAnswer` |
| `novlearn-exercise-engine/node-host` | `createNodeHost` ; orchestration native bornée, sans serveur HTTP ni accès DB                                                                    |
| `novlearn-exercise-engine/legacy`    | `adaptLegacyExercise` ; adaptation historique explicite, jamais conversion silencieuse dans les applications                                     |

Les types publics couvrent notamment `ExerciseDefinition`, `ExerciseInstance`,
`PublicInstance`, `AnswerSubmission`, `CorrectionResult`, diagnostics et résultats
discriminés ; `NodeHost`, `HostResult`, `HostError`, `HostLimits`, `EngineOperation`
appartiennent au sous-chemin host. L'exemple [contract.ts](../examples/engine-consumer/contract.ts)
compile les imports publics et refuse un import profond.

| Opération racine        | Entrée / résultat et limite                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `validateDefinition`    | Définition inconnue → `ok/value` ou `ok:false/diagnostics` ; validation structurelle, pas preuve mathématique de générabilité             |
| `validateSubmission`    | Soumission inconnue → union de validation ; ne prouve ni identité ni propriété d'instance                                                 |
| `parseMathInput`        | Source, contexte et profil → parsing/diagnostics ; conserver source, domaine et forme, sans lui attribuer une preuve de correction        |
| `generateVariables`     | **GenerationDefinition**, options seed/version → valeurs/replay ou diagnostics ; ne pas passer l'exercice complet                         |
| `instantiateExercise`   | ExerciseDefinition + seed + instanceId → snapshot privé détaché ou diagnostics ; génération et contraintes restent dans Engine            |
| `projectPublicInstance` | Snapshot officiel serveur → sélection publique ; `sampleGraphs: true` ajoute des points de courbe approximatifs ; ne valide pas la provenance d'un snapshot client |
| `gradeAnswer`           | Snapshot officiel + soumission → `correct`, `incorrect`, `invalid`, `indeterminate` ou `error` ; aucune décision depuis un verdict client |

Ces fonctions synchrones ne sont pas préemptées par une Promise ou un timeout de
test. Les appels directs du consommateur minimal ci-dessous utilisent uniquement
des fixtures synthétiques de confiance. Les entrées d'édition non fiables passent
par le host borné officiel ; ne pas substituer les appels directs aux protections
de `engine-runtime.ts`.

## Host serveur et diagnostics

`host.run(json, { signal })` accepte une enveloppe exacte : `protocolVersion`,
`requestId`, `operation`, `payload`. Le protocole utilise une seed uint32 ; son
contrat de transport est plus restreint que les options de la bibliothèque.

| Opération host          | Champs exacts du payload                    |
| ----------------------- | ------------------------------------------- |
| `validateDefinition`    | `definition`                                |
| `validateSubmission`    | `submission`                                |
| `parseMathInput`        | `source`, `context`, `profile`              |
| `generateVariables`     | `definition` (GenerationDefinition), `seed` |
| `instantiateExercise`   | `definition`, `seed`, `instanceId`          |
| `projectPublicInstance` | `official`                                  |
| `gradeAnswer`           | `official`, `submission`                    |
| `adaptLegacyExercise`   | `source`, `sourceFormat`, `recipe`          |

Un succès de transport `ok:true` contient `value`, lequel peut être un échec
métier Engine. Un échec de host ne constitue jamais une réponse incorrecte.
`HostError` distingue notamment requête invalide, entrée/sortie trop grande,
`busy`, `timeout`, `aborted`, `unavailable`, `crash`, `protocol-error`,
`worker-error` et `closed`. Ne pas réessayer sans borne ni réduire ces états à
une réussite. `close()` termine le host ; `stats()` décrit sa file locale.

Les diagnostics métiers comportent `path`, `code`, `message`, et selon le stade
`stage`, `elementId` ou `questionId`. Préserver ces codes ; ne pas en déduire un
verdict mathématique à partir du message traduit. Une contrainte indéterminée
ou une génération épuisée reste un échec explicite. Une égalité non prouvée ne
devient pas `incorrect`. Les versions inconnues de snapshot sont refusées.

Le manifeste indique le **profil Admin** : 5 s file comprise, mémoire 384 Mio,
heap 128 Mio, 1 actif/4 en attente, entrée 1 Mio, sortie 2 Mio, stderr 64 Kio,
file 4 Mio. Ce profil est choisi explicitement ; les valeurs par défaut de
concurrence du host sont 2 actifs/8 en attente. Linux x64 exige Python >=3.11,
cgroup v2 existant et borné, swap nul et au plus 64 pids, avec les protections
du lanceur. Aucune limite ni garde Vercel/Windows n'est modifiée ici.

## Installation reproductible sans dépôt voisin

L'Admin garde sa dépendance `file:vendor/novlearn-exercise-engine-0.1.8.tgz` et son
lockfile. `npm run verify:engine` contrôle désormais tous les fichiers installés,
les exports, le graphe portable, le manifeste et les versions des dépendances,
en cohérence avec `certifiedEngineIdentity`. Le tarball conserve aussi son
intégrité SHA512 npm. Aucun chemin vers les sources Engine n'est requis.

Pour préparer un consommateur autonome, choisir un dossier **nouveau** dont le
parent existe ; le préparateur refuse d'écraser un dossier existant :

```powershell
node scripts/prepare-engine-consumer.mjs C:/chemin/parent/engine-consumer
cd C:/chemin/parent/engine-consumer
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd test
```

Le dossier contient package/lock, archive, manifeste, vérificateur, fixture,
smoke et contrat TypeScript ; il peut être déplacé hors des trois dépôts. Les
quatre packages sont verrouillés par version et intégrité. Le registre npm est
nécessaire pour leurs tarballs tant que le cache est froid ; `--offline` ne
fonctionne qu'avec un cache préalablement alimenté. Aucun script d'installation
de dépendance n'est exécuté. Le compilateur TypeScript appartient à l'outillage
de test, pas aux dépendances du cœur.

Le banc automatique prépare **deux consommateurs minimaux indépendants** nommés
Admin et NovLearn, les installe avec `npm ci`, compile `contract.ts` en NodeNext
strict et `types:[]`, puis exécute les smokes. Il compare artefact et empreinte du
lock et refuse leur modification par l'installation :

```powershell
npm.cmd run test:engine:distribution
# Même banc, cache alimenté, sans réseau :
node scripts/test-engine-distribution.mjs --offline
```

Pour l'adoption dans NovLearn, copier la même archive et le manifeste dans son
propre `vendor/`, installer le chemin local avec un lock de consommateur revu et
exécuter ces contrôles avec Node compatible. Ne pas copier tout le lock Admin
dans une application existante. Le frontend NovLearn déclare actuellement Node

> =20 : aligner le runtime réellement choisi sur l'exigence Engine avant
> intégration. **Ce lot ne modifie ni ce frontend ni ses parcours élèves** : les
> consommateurs prouvent la distribution, pas le raccordement applicatif du lot 6.

## Mise à jour coordonnée et retour arrière

La release 0.1.1 utilise les mêmes exports, schéma et pipeline, mais une
présentation numérique sans groupement pour permettre le rejeu des attendus
par l'admission inchangée. L'empreinte d'archive, le manifeste et les locks sont
mis à jour ensemble. Package et pipeline ont des champs distincts dans Admin,
y compris pour vérifier un rapport de publication. Un rapport 0.1.0 n'est pas
requalifié par changement de son étiquette. La configuration SQL distante des
reçus devra être reçue séparément ; aucune clé de signature n'est provisionnée ici.

1. Revoir le delta Engine ; distinguer changement d'API, de schéma, de pipeline,
   génération et politique de canonisation applicative. Une nouvelle version
   de package ne prouve pas à elle seule une compatibilité de snapshots.
2. Produire un nouvel artefact immuable et son inventaire ; préserver l'ancien.
   Requalifier cœur/package/host nécessaires, avec mêmes délais et quotas.
3. Installer l'artefact candidat dans les deux consommateurs ; comparer leurs
   vecteurs seed, snapshots, projections et corrections, y compris les erreurs.
4. Mettre à jour explicitement dépendance, lock, manifeste et identité applicative.
   Coordonner reçus/signatures et contrats SQL par procédure distincte autorisée ;
   ne pas réécrire ni réétiqueter les anciens rapports.
5. Déployer les consommateurs compatibles avant de publier des définitions qui
   exigent le nouvel artefact. Conserver snapshots et artefacts nécessaires aux
   anciennes tentatives ; aucune migration implicite à la lecture.
6. En cas de retour arrière, rétablir l'ancien ensemble artefact/lock/identité
   approuvé. Un rollback de code ne restaure pas une base ni une tentative.

## Contrôles réalisés et portée

**30 octobre, mission 1 :** deux consommateurs autonomes installent 0.1.1 avec
le même lock, compilent les exports/types et exécutent les cinq pilotes sur
0, 1 et 42. Le banc officiel Linux du tarball passe sous 384 Mio, swap nul,
64 pids et sans réseau. La suite source, les relances, les premières erreurs
et les limites du contrôle composé restent explicités dans le dossier de
réception. Ces preuves ne qualifient ni l'application NovLearn ni Vercel.

**Historique du lot du 22 octobre (archive 0.1.0) :**

Le 22 octobre 2026, Node 24.19.0 : inventaire courant Admin vérifié, six tests
de protection de distribution réussis (archive modifiée, intégrité divergente,
chemins dangereux, fichier installé modifié/supplémentaire, installation courante,
substitution de dépendance dans le lock).
Deux installations minimales indépendantes par `npm ci --offline` passent avec
le même lock. Chaque consommateur compile les types stricts et teste exports,
validation, parsing, variables, instanciation, rejeu, contraintes impossibles,
projection sans données privées, corrections correcte/incorrecte/invalide,
versions inconnues et refus du host avant lancement natif.

Les premières tentatives restent distinctes : cache incomplet `ENOTCACHED`,
écriture npm refusée par le bac `EPERM`, puis erreur du fixture de smoke qui
passait un exercice complet à `generateVariables`, corrigée sans modification
du moteur. Elles ne sont pas annoncées comme réussies. L'installation avec le
lock a alimenté le cache, puis le banc autonome a été exécuté avec les droits
d'écriture prévus. Aucun contrôle OS contourné.

Les résultats détaillés restent dans `.local/engine-distribution-*/proof.json`.
Le [bilan de distribution](archives/engine-distribution-2026-10-22.json) conserve
les résultats publics et leur portée. Types Admin et lint des fichiers modifiés
passent également ; le contrôle complet Next n'est pas revendiqué.
Ils ne certifient pas une nouvelle exécution native positive, le profil Linux
d'un hébergeur, un build Next, une base ou une réception élève. Aucun nouveau
tarball ni changement du cœur, de clé, de schéma SQL ou d'environnement distant.
